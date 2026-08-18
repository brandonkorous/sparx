// Layer-3 OAuth sync orchestration (docs/79 §8.3). Ties the pure helpers, the token
// lifecycle, and the provider REST calls together into the four flows the routes +
// tick need:
//   · beginOAuthConnection  — create the (token-less) connection row + the consent URL
//   · completeOAuthConnection — exchange the code, store tokens, run the first sync
//   · syncOAuthConnection   — refresh token → pull busy → replace blocks → (Google)
//                             push changed bookings outbound → ensure/renew push channel
//   · handleCalendarPush    — a provider webhook fired: debounced re-sync
//
// Busy import re-fetches the whole window each sync (a push only signals "something
// changed"); a stale/expired grant flips the connection to `expired`/`error` and the
// resource falls back to sparx-only data — a dead calendar never weakens the DB-level
// no-overlap guard (§8.4). Microsoft's outbound rides the Layer-1 `.ics` feed (Graph
// can't set an event's iCalUID, so stateless API push isn't possible); Google's
// outbound is the idempotent iCalUID import.

import type { FastifyBaseLogger } from 'fastify';
import { badRequest } from '@wizeworks/api-core/errors';
import type { CalendarConnection } from '@wizeworks/db';
import type { StartCalendarOAuthInput } from '@wizeworks/scheduling-schemas';
import {
  buildCalendarAuthorizeUrl,
  buildGoogleImportEvent,
  createCalendarConnection,
  deleteCalendarConnection,
  getCalendarConnection,
  listBookings,
  replaceExternalBusyBlocks,
  updateConnectionSyncState,
  type BusyWindow,
  type CalendarOAuthProvider,
} from '@wizeworks/scheduling';

import { env } from '../env.js';
import { encryptCalendarSecret, isCalendarCryptoConfigured } from './scheduling-calendar-crypto.js';
import { publishBookingEvent } from './scheduling-events.js';
import {
  exchangeAuthCode,
  ensureFreshAccessToken,
  isOAuthProviderConfigured,
  resolveOAuthClient,
  signCalendarOAuthState,
  signCalendarPushToken,
  type CalendarOAuthState,
} from './scheduling-calendar-oauth.js';
import {
  createMicrosoftSubscription,
  fetchGoogleBusy,
  fetchMicrosoftBusy,
  importGoogleEvent,
  registerGoogleWatch,
  renewMicrosoftSubscription,
} from './scheduling-calendar-providers.js';
import type { CalendarSyncOutcome } from './scheduling-calendar-sync.js';

const PAST_MS = 2 * 24 * 60 * 60 * 1000;
const FUTURE_MS = 120 * 24 * 60 * 60 * 1000;
const DEFAULT_EVENT_MS = 60 * 60 * 1000;
const PUSH_DEBOUNCE_MS = 8_000;
const RENEW_LEAD_MS = 24 * 60 * 60 * 1000; // re-register a channel with <24h left
const MS_SUB_TTL_MS = 2.5 * 24 * 60 * 60 * 1000; // < Graph's ~3-day calendar cap

const ACTIVE_BOOKING_STATUSES = [
  'requested',
  'confirmed',
  'in_progress',
  'completed',
  'cancelled',
  'no_show',
] as const;

function oauthBusyWindow(nowMs: number): BusyWindow {
  return {
    windowStart: nowMs - PAST_MS,
    windowEnd: nowMs + FUTURE_MS,
    defaultDurationMs: DEFAULT_EVENT_MS,
  };
}

/** The public HTTPS webhook the provider pushes to — null in dev / non-public, so
 *  push channels are skipped and the connection relies on the polling fallback. */
function pushNotificationUrl(): string | null {
  const base = env.SPARX_PUBLIC_API_REST_URL;
  if (!base) return null;
  try {
    if (new URL(base).protocol !== 'https:') return null;
  } catch {
    return null;
  }
  return `${base.replace(/\/$/, '')}/v1/public/scheduling/calendar/push`;
}

/** Register (or renew) the provider push channel so changes arrive in near-real-time.
 *  Best-effort: Google's watch needs a Search-Console-verified host (§8.5) and MS
 *  needs the webhook reachable — a failure just leaves the polling fallback. */
async function ensurePushChannel(
  logger: FastifyBaseLogger,
  tenantId: string,
  conn: CalendarConnection,
  accessToken: string,
  nowMs: number
): Promise<void> {
  const notifyUrl = pushNotificationUrl();
  if (!notifyUrl) return;
  const live =
    conn.channelId &&
    conn.channelExpiresAt &&
    conn.channelExpiresAt.getTime() > nowMs + RENEW_LEAD_MS;
  if (live) return;
  try {
    const pushToken = await signCalendarPushToken(tenantId, conn.id);
    if ((conn.provider as CalendarOAuthProvider) === 'google') {
      const ch = await registerGoogleWatch(
        accessToken,
        conn.externalCalendarId ?? 'primary',
        notifyUrl,
        pushToken
      );
      await updateConnectionSyncState(tenantId, conn.id, {
        channelId: ch.channelId,
        channelExpiresAt: ch.expiresAtMs ? new Date(ch.expiresAtMs) : null,
      });
      return;
    }
    const expiry = nowMs + MS_SUB_TTL_MS;
    if (conn.channelId) {
      const renewed = await renewMicrosoftSubscription(accessToken, conn.channelId, expiry).catch(
        () => null
      );
      if (renewed) {
        await updateConnectionSyncState(tenantId, conn.id, { channelExpiresAt: new Date(renewed) });
        return;
      }
    }
    const sub = await createMicrosoftSubscription(accessToken, notifyUrl, pushToken, expiry);
    await updateConnectionSyncState(tenantId, conn.id, {
      channelId: sub.subscriptionId,
      channelExpiresAt: sub.expiresAtMs ? new Date(sub.expiresAtMs) : null,
    });
  } catch (err) {
    logger.warn(
      { tenantId, connectionId: conn.id, err },
      'calendar-oauth: push channel setup failed — polling fallback'
    );
  }
}

/** Push sparx bookings changed since the last sync up to the Google calendar
 *  (idempotent by iCalUID). Best-effort per booking; a single failure never aborts
 *  the inbound sync. */
async function pushOutboundGoogle(
  logger: FastifyBaseLogger,
  tenantId: string,
  conn: CalendarConnection,
  accessToken: string,
  window: BusyWindow
): Promise<void> {
  const sinceMs = conn.lastSyncedAt?.getTime() ?? 0;
  const { rows } = await listBookings(tenantId, {
    resourceId: conn.resourceId,
    statusIn: [...ACTIVE_BOOKING_STATUSES],
    from: new Date(window.windowStart).toISOString(),
    to: new Date(window.windowEnd).toISOString(),
    order: 'asc',
    take: 250,
  });
  const changed = rows.filter((b) => (b.updatedAt?.getTime() ?? 0) > sinceMs).slice(0, 200);
  for (const b of changed) {
    const event = buildGoogleImportEvent({
      bookingId: b.id,
      start: b.startAt,
      end: b.endAt,
      summary: b.service.name,
      cancelled: b.status === 'cancelled' || b.status === 'no_show',
    });
    await importGoogleEvent(accessToken, conn.externalCalendarId ?? 'primary', event).catch((err) =>
      logger.warn({ tenantId, bookingId: b.id, err }, 'calendar-oauth: outbound import failed')
    );
  }
}

/** Sync one OAuth connection: refresh the token, re-pull the busy window into
 *  external_busy_blocks, push outbound (Google), and ensure the push channel is live.
 *  Records status either way; never throws. */
export async function syncOAuthConnection(
  logger: FastifyBaseLogger,
  tenantId: string,
  connectionId: string
): Promise<CalendarSyncOutcome> {
  const conn = await getCalendarConnection(tenantId, connectionId).catch(() => null);
  if (!conn) return { ok: false, error: 'not_found' };
  if (conn.connectionKind !== 'oauth') return { ok: false, error: 'unsupported_kind' };
  if (!isCalendarCryptoConfigured()) {
    await updateConnectionSyncState(tenantId, connectionId, {
      status: 'error',
      lastError: 'Calendar sync is not configured.',
      lastSyncedAt: new Date(),
    });
    return { ok: false, error: 'not_configured' };
  }

  const now = Date.now();
  try {
    const accessToken = await ensureFreshAccessToken(tenantId, conn, now);
    const window = oauthBusyWindow(now);
    const busy =
      (conn.provider as CalendarOAuthProvider) === 'google'
        ? await fetchGoogleBusy(accessToken, conn.externalCalendarId ?? 'primary', window)
        : await fetchMicrosoftBusy(accessToken, window);
    const count = await replaceExternalBusyBlocks(tenantId, connectionId, conn.resourceId, busy);
    if ((conn.provider as CalendarOAuthProvider) === 'google' && conn.direction !== 'in') {
      await pushOutboundGoogle(logger, tenantId, conn, accessToken, window).catch(() => undefined);
    }
    await ensurePushChannel(logger, tenantId, conn, accessToken, now);
    await updateConnectionSyncState(tenantId, connectionId, {
      status: 'active',
      lastError: null,
      lastSyncedAt: new Date(now),
    });
    return { ok: true, count };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Calendar sync failed.';
    const expired = /expired|invalid_grant|cannot be refreshed|no access token/i.test(message);
    await updateConnectionSyncState(tenantId, connectionId, {
      status: expired ? 'expired' : 'error',
      lastError: message,
      lastSyncedAt: new Date(now),
    }).catch(() => undefined);
    await publishBookingEvent('calendar.sync_failed', tenantId, null, {
      connectionId,
      resourceId: conn.resourceId,
      error: message,
    }).catch(() => undefined);
    logger.warn({ tenantId, connectionId, err }, 'calendar-oauth: sync failed');
    return { ok: false, error: message };
  }
}

export interface BeginOAuthResult {
  authorizeUrl: string;
  connectionId: string;
}

/** Create the (token-less) connection row and build the provider consent URL. A BYO
 *  tenant supplies their own client (encrypted onto the row); the platform path uses
 *  the verified WizeWorks app. The connection exists from here so the callback can
 *  carry just its id in the signed state (never the client secret through the
 *  browser). Throws + rolls the row back if the client can't be resolved. */
export async function beginOAuthConnection(
  tenantId: string,
  userId: string,
  input: StartCalendarOAuthInput
): Promise<BeginOAuthResult> {
  if (!isCalendarCryptoConfigured()) {
    throw badRequest('Calendar sync is not configured on this deployment.');
  }
  const byo = input.credentialSource === 'tenant_byo';
  if (byo && (!input.oauthClientId || !input.oauthClientSecret)) {
    throw badRequest('A BYO calendar connection needs its own client id + secret.');
  }
  if (!byo && !isOAuthProviderConfigured(input.provider)) {
    throw badRequest(
      `Connecting ${input.provider} calendars is not configured on this deployment.`
    );
  }

  const connection = await createCalendarConnection(tenantId, {
    resourceId: input.resourceId,
    provider: input.provider,
    connectionKind: 'oauth',
    credentialSource: input.credentialSource,
    // Google does true API two-way (idempotent import); Microsoft's outbound rides
    // the Layer-1 feed, so its OAuth connection is inbound-only.
    direction: input.provider === 'google' ? 'two_way' : 'in',
    fidelity: 'realtime',
    oauthClientId: byo ? input.oauthClientId : null,
    oauthClientSecretEnc:
      byo && input.oauthClientSecret ? encryptCalendarSecret(input.oauthClientSecret) : null,
  });

  const client = resolveOAuthClient(connection);
  if (!client) {
    await deleteCalendarConnection(tenantId, connection.id).catch(() => undefined);
    throw badRequest('Calendar OAuth client is not configured.');
  }
  const state = await signCalendarOAuthState({
    tenantId,
    userId,
    connectionId: connection.id,
    provider: input.provider,
    redirectUri: input.redirectUri,
  });
  const authorizeUrl = buildCalendarAuthorizeUrl({
    provider: input.provider,
    clientId: client.clientId,
    redirectUri: input.redirectUri,
    state,
    msTenant: client.msTenant,
    loginHint: input.loginHint ?? null,
  });
  return { authorizeUrl, connectionId: connection.id };
}

/** Exchange the authorization code, persist the encrypted tokens, then run the first
 *  sync (busy import + push-channel registration). Returns the fresh connection. */
export async function completeOAuthConnection(
  logger: FastifyBaseLogger,
  state: CalendarOAuthState,
  code: string
): Promise<CalendarConnection> {
  const conn = await getCalendarConnection(state.tenantId, state.connectionId);
  const client = resolveOAuthClient(conn);
  if (!client) throw badRequest('Calendar OAuth client is not configured.');

  const now = Date.now();
  const tokens = await exchangeAuthCode(client, state.provider, code, state.redirectUri, now);
  await updateConnectionSyncState(state.tenantId, conn.id, {
    status: 'active',
    lastError: null,
    accessTokenEnc: encryptCalendarSecret(tokens.accessToken),
    tokenExpiresAt: new Date(tokens.expiresAtMs),
    ...(tokens.refreshToken ? { refreshTokenEnc: encryptCalendarSecret(tokens.refreshToken) } : {}),
  });
  await publishBookingEvent('calendar.connected', state.tenantId, state.userId, {
    connectionId: conn.id,
    provider: state.provider,
    resourceId: conn.resourceId,
  }).catch(() => undefined);

  await syncOAuthConnection(logger, state.tenantId, conn.id);
  return getCalendarConnection(state.tenantId, conn.id);
}

/** A provider webhook fired for a connection — re-sync, debounced against a burst of
 *  notifications. */
export async function handleCalendarPush(
  logger: FastifyBaseLogger,
  tenantId: string,
  connectionId: string
): Promise<void> {
  const conn = await getCalendarConnection(tenantId, connectionId).catch(() => null);
  if (conn?.connectionKind !== 'oauth') return;
  if (conn.lastSyncedAt && Date.now() - conn.lastSyncedAt.getTime() < PUSH_DEBOUNCE_MS) return;
  await syncOAuthConnection(logger, tenantId, connectionId);
}
