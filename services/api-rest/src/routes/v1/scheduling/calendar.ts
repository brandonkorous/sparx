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
import { CreateIcalFeedInput } from '@sparx/scheduling-schemas';
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
import {
  assertPublicHttpsUrl,
  CalendarFeedError,
  syncIcalConnection,
} from '../../../lib/scheduling-calendar-sync.js';

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

  app.post('/v1/scheduling/calendar/connections/:id/sync', async (request) => {
    await requireSchedulingModule(request);
    requireRole(request, 'editor');
    const { tenantId } = toSchedulingContext(request);
    const { id } = PathId.parse(request.params);
    await getCalendarConnection(tenantId, id); // 404s a missing/foreign connection
    const outcome = await syncIcalConnection(request.log, tenantId, id);
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
