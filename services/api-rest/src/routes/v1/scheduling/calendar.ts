// Calendar connections (docs/79 §8) — the dashboard-authed CRUD for a resource's
// linked calendars. Slice 2 ships the inbound iCal feed (Layer 2); OAuth/CalDAV
// (Layer 3) extends the same routes. Secrets (the feed URL) are encrypted at rest;
// the response view NEVER includes ciphertext.
//
//   GET    /v1/scheduling/calendar/connections?resourceId=     → list (safe view)
//   POST   /v1/scheduling/calendar/connections/ical            → add an iCal feed
//   POST   /v1/scheduling/calendar/connections/:id/sync        → resync now
//   DELETE /v1/scheduling/calendar/connections/:id             → remove

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import type { CalendarConnection } from '@sparx/db';
import { ok } from '@sparx/api-core/envelope';
import { badRequest } from '@sparx/api-core/errors';
import { requireRole } from '@sparx/api-core/auth';
import {
  CompleteCalendarOAuthInput,
  CreateCaldavConnectionInput,
  CreateIcalFeedInput,
  StartCalendarOAuthInput,
} from '@sparx/scheduling-schemas';
import {
  createCalendarConnection,
  deleteCalendarConnection,
  getCalendarConnection,
  listCalendarConnections,
} from '@sparx/scheduling';

import { requireSchedulingModule, toSchedulingContext } from '../../../lib/scheduling-context.js';
import {
  encryptCalendarSecret,
  isCalendarCryptoConfigured,
} from '../../../lib/scheduling-calendar-crypto.js';
import { assertPublicHttpsUrl, CalendarFeedError } from '../../../lib/scheduling-url-guard.js';
import { syncCalDavConnection, syncIcalConnection } from '../../../lib/scheduling-calendar-sync.js';
import {
  beginOAuthConnection,
  completeOAuthConnection,
} from '../../../lib/scheduling-calendar-oauth-sync.js';
import {
  isOAuthProviderConfigured,
  verifyCalendarOAuthState,
} from '../../../lib/scheduling-calendar-oauth.js';
import { APPLE_ICLOUD_CALDAV } from '../../../lib/caldav-client.js';

const PathId = z.object({ id: z.string().uuid() });
const ListQuery = z.object({ resourceId: z.string().uuid().optional() });

/** Public-safe projection — never the encrypted credential columns. */
function connectionView(c: CalendarConnection) {
  return {
    id: c.id,
    resourceId: c.resourceId,
    provider: c.provider,
    connectionKind: c.connectionKind,
    credentialSource: c.credentialSource,
    direction: c.direction,
    fidelity: c.fidelity,
    status: c.status,
    externalCalendarId: c.externalCalendarId,
    lastSyncedAt: c.lastSyncedAt?.toISOString() ?? null,
    lastError: c.lastError,
    createdAt: c.createdAt.toISOString(),
  };
}

// eslint-disable-next-line @typescript-eslint/require-await -- FastifyPluginAsync type demands async; route registration is sync.
const schedulingCalendarConnectionRoutes: FastifyPluginAsync = async (app) => {
  app.get('/v1/scheduling/calendar/connections', async (request) => {
    await requireSchedulingModule(request);
    const { tenantId } = toSchedulingContext(request);
    const { resourceId } = ListQuery.parse(request.query);
    const rows = await listCalendarConnections(tenantId, resourceId);
    return ok(rows.map(connectionView));
  });

  app.post('/v1/scheduling/calendar/connections/ical', async (request, reply) => {
    await requireSchedulingModule(request);
    requireRole(request, 'editor');
    const { tenantId } = toSchedulingContext(request);
    if (!isCalendarCryptoConfigured()) {
      throw badRequest(
        'Calendar sync is not configured on this deployment (SCHEDULING_CALENDAR_TOKEN_KEY).'
      );
    }
    const input = CreateIcalFeedInput.parse(request.body);
    // Validate + normalize BEFORE persisting (rejects private/SSRF URLs up front).
    let normalized: string;
    try {
      normalized = (await assertPublicHttpsUrl(input.icalUrl)).toString();
    } catch (err) {
      throw badRequest(err instanceof CalendarFeedError ? err.message : 'Invalid calendar URL.');
    }

    const connection = await createCalendarConnection(tenantId, {
      resourceId: input.resourceId,
      provider: input.provider,
      connectionKind: 'ical_feed',
      credentialSource: 'tenant_byo',
      direction: 'in',
      fidelity: 'stale_feed',
      icalUrlEnc: encryptCalendarSecret(normalized),
    });

    // First sync inline so the dashboard immediately reflects imported busy + status.
    const outcome = await syncIcalConnection(request.log, tenantId, connection.id);
    const fresh = await getCalendarConnection(tenantId, connection.id);
    return reply.code(201).send(ok({ ...connectionView(fresh), sync: outcome }));
  });

  app.post('/v1/scheduling/calendar/connections/caldav', async (request, reply) => {
    await requireSchedulingModule(request);
    requireRole(request, 'editor');
    const { tenantId } = toSchedulingContext(request);
    if (!isCalendarCryptoConfigured()) {
      throw badRequest(
        'Calendar sync is not configured on this deployment (SCHEDULING_CALENDAR_TOKEN_KEY).'
      );
    }
    const input = CreateCaldavConnectionInput.parse(request.body);
    // Apple defaults to iCloud; a generic CalDAV connection must name its server.
    const serverRaw =
      input.serverUrl ?? (input.provider === 'apple_caldav' ? APPLE_ICLOUD_CALDAV : null);
    if (!serverRaw) throw badRequest('A CalDAV server URL is required for generic CalDAV.');
    let serverUrl: string;
    try {
      serverUrl = (await assertPublicHttpsUrl(serverRaw)).toString();
    } catch (err) {
      throw badRequest(
        err instanceof CalendarFeedError ? err.message : 'Invalid CalDAV server URL.'
      );
    }

    const connection = await createCalendarConnection(tenantId, {
      resourceId: input.resourceId,
      provider: input.provider,
      connectionKind: 'caldav',
      credentialSource: 'tenant_byo',
      direction: 'in',
      fidelity: 'stale_feed',
      caldavUsername: input.username,
      appPasswordEnc: encryptCalendarSecret(input.appPassword),
      caldavUrl: serverUrl,
    });

    // First sync inline so a bad password / unreachable server surfaces immediately.
    const outcome = await syncCalDavConnection(request.log, tenantId, connection.id);
    const fresh = await getCalendarConnection(tenantId, connection.id);
    return reply.code(201).send(ok({ ...connectionView(fresh), sync: outcome }));
  });

  // Which OAuth providers the platform app is configured for (drives the dashboard's
  // "Connect Google / Microsoft" buttons; BYO works regardless of platform config).
  app.get('/v1/scheduling/calendar/oauth/providers', async (request) => {
    await requireSchedulingModule(request);
    return ok({
      cryptoConfigured: isCalendarCryptoConfigured(),
      google: isOAuthProviderConfigured('google'),
      microsoft: isOAuthProviderConfigured('microsoft'),
    });
  });

  // Begin an OAuth connect: creates the token-less connection row + returns the
  // provider consent URL the dashboard redirects the browser to.
  app.post('/v1/scheduling/calendar/connections/oauth/start', async (request) => {
    await requireSchedulingModule(request);
    requireRole(request, 'editor');
    const { tenantId, userId } = toSchedulingContext(request);
    const input = StartCalendarOAuthInput.parse(request.body);
    const result = await beginOAuthConnection(tenantId, userId, input);
    return ok(result);
  });

  // Complete an OAuth connect: the dashboard callback posts the provider `code` +
  // signed `state`; we verify state (CSRF — the tenant must match the caller),
  // exchange the code, store the encrypted tokens, and run the first sync.
  app.post('/v1/scheduling/calendar/connections/oauth/complete', async (request) => {
    await requireSchedulingModule(request);
    requireRole(request, 'editor');
    const { tenantId } = toSchedulingContext(request);
    const { code, state } = CompleteCalendarOAuthInput.parse(request.body);
    const decoded = await verifyCalendarOAuthState(state);
    if (decoded.tenantId !== tenantId) {
      throw badRequest('This calendar connect link belongs to a different account.');
    }
    const conn = await completeOAuthConnection(request.log, decoded, code);
    return ok({
      ...connectionView(conn),
      sync: { ok: conn.status === 'active', error: conn.lastError ?? undefined },
    });
  });

  app.post('/v1/scheduling/calendar/connections/:id/sync', async (request) => {
    await requireSchedulingModule(request);
    requireRole(request, 'editor');
    const { tenantId } = toSchedulingContext(request);
    const { id } = PathId.parse(request.params);
    const conn = await getCalendarConnection(tenantId, id); // 404s a missing/foreign connection
    const outcome =
      conn.connectionKind === 'caldav'
        ? await syncCalDavConnection(request.log, tenantId, id)
        : await syncIcalConnection(request.log, tenantId, id);
    const fresh = await getCalendarConnection(tenantId, id);
    return ok({ ...connectionView(fresh), sync: outcome });
  });

  app.delete('/v1/scheduling/calendar/connections/:id', async (request) => {
    await requireSchedulingModule(request);
    requireRole(request, 'editor');
    const { tenantId } = toSchedulingContext(request);
    const { id } = PathId.parse(request.params);
    await deleteCalendarConnection(tenantId, id);
    return ok({ id, deleted: true });
  });
};

export default schedulingCalendarConnectionRoutes;
