// Inbound iCal busy-import sync (docs/79 §8.2) — the orchestration the engine
// can't do: decrypt the feed URL, fetch it (SSRF-guarded), parse busy intervals
// (the pure engine parser), and replace the resource's external_busy_blocks. Runs
// on demand (create / "sync now") and on a background tick across all tenants.
//
// Layer 2 is explicitly low-fidelity: a connection that fails flips to `status:
// error`, raises `calendar.sync_failed`, and the resource simply falls back to
// sparx-only data — a stale feed never weakens the DB-level no-overlap guard (§8.4).

import { ADVISORY_LOCKS, withAdvisoryTickLock } from '@wizeworks/db';
import type { FastifyBaseLogger } from 'fastify';
import { prisma } from '@wizeworks/db';
import {
  getCalendarConnection,
  parseBusyIntervals,
  replaceExternalBusyBlocks,
  updateConnectionSyncState,
} from '@wizeworks/scheduling';

import { decryptCalendarSecret, isCalendarCryptoConfigured } from './scheduling-calendar-crypto.js';
import { publishBookingEvent } from './scheduling-events.js';
import { assertPublicHttpsUrl, CalendarFeedError } from './scheduling-url-guard.js';
import { APPLE_ICLOUD_CALDAV, fetchCalDavBusyIcs } from './caldav-client.js';
import { syncOAuthConnection } from './scheduling-calendar-oauth-sync.js';

const CALENDAR_SYNC_LOCK_KEY = ADVISORY_LOCKS.SCHEDULING_CALENDAR_SYNC;
const DEFAULT_INTERVAL_MS = 300_000; // tick every 5 min
const STALE_SECONDS = 3600; // refresh a feed at most ~hourly (upstream caches 12–24h anyway)
const PAST_MS = 2 * 24 * 60 * 60 * 1000; // import a little history…
const FUTURE_MS = 120 * 24 * 60 * 60 * 1000; // …and ~4 months ahead
const DEFAULT_EVENT_MS = 60 * 60 * 1000; // span for an event with no end
const FETCH_TIMEOUT_MS = 12_000;
const MAX_BYTES = 8 * 1024 * 1024;
const MAX_REDIRECTS = 3;

interface FetchResult {
  status: number;
  body: string | null;
  etag: string | null;
}

/** Fetch the feed with a timeout, size cap, conditional GET, and manual redirect
 *  following that re-validates every hop (so a redirect can't escape the SSRF guard). */
async function fetchIcs(initial: URL, etag: string | null): Promise<FetchResult> {
  let url = initial;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    let res: Response;
    try {
      res = await fetch(url, {
        method: 'GET',
        redirect: 'manual',
        signal: controller.signal,
        headers: {
          Accept: 'text/calendar, text/plain;q=0.9, */*;q=0.5',
          'User-Agent': 'sparx-calendar-sync/1',
          ...(etag ? { 'If-None-Match': etag } : {}),
        },
      });
    } finally {
      clearTimeout(timer);
    }

    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get('location');
      if (!location)
        throw new CalendarFeedError(`Feed redirect without a location (${res.status}).`);
      url = await assertPublicHttpsUrl(new URL(location, url).toString());
      continue;
    }
    if (res.status === 304) return { status: 304, body: null, etag };
    if (!res.ok) throw new CalendarFeedError(`The calendar feed responded ${res.status}.`);

    const declared = Number(res.headers.get('content-length') ?? '0');
    if (declared > MAX_BYTES) throw new CalendarFeedError('That calendar feed is too large.');
    const body = await res.text();
    if (body.length > MAX_BYTES) throw new CalendarFeedError('That calendar feed is too large.');
    return { status: 200, body, etag: res.headers.get('etag') };
  }
  throw new CalendarFeedError('The calendar feed redirected too many times.');
}

export interface CalendarSyncOutcome {
  ok: boolean;
  count?: number;
  notModified?: boolean;
  error?: string;
}

/** Sync one ical_feed connection. Updates the connection's status either way;
 *  failures are recorded + raise calendar.sync_failed but never throw. */
export async function syncIcalConnection(
  logger: FastifyBaseLogger,
  tenantId: string,
  connectionId: string
): Promise<CalendarSyncOutcome> {
  const conn = await getCalendarConnection(tenantId, connectionId).catch(() => null);
  if (!conn) return { ok: false, error: 'not_found' };
  if (conn.connectionKind !== 'ical_feed') return { ok: false, error: 'unsupported_kind' };
  if (!isCalendarCryptoConfigured() || !conn.icalUrlEnc) {
    await updateConnectionSyncState(tenantId, connectionId, {
      status: 'error',
      lastError: 'Calendar sync is not configured.',
      lastSyncedAt: new Date(),
    });
    return { ok: false, error: 'not_configured' };
  }

  const now = Date.now();
  try {
    const url = await assertPublicHttpsUrl(decryptCalendarSecret(conn.icalUrlEnc));
    const res = await fetchIcs(url, conn.syncToken ?? null);
    if (res.status === 304) {
      await updateConnectionSyncState(tenantId, connectionId, {
        status: 'active',
        lastError: null,
        lastSyncedAt: new Date(now),
      });
      return { ok: true, notModified: true };
    }
    const blocks = parseBusyIntervals(res.body ?? '', {
      windowStart: now - PAST_MS,
      windowEnd: now + FUTURE_MS,
      defaultDurationMs: DEFAULT_EVENT_MS,
    });
    const count = await replaceExternalBusyBlocks(tenantId, connectionId, conn.resourceId, blocks);
    await updateConnectionSyncState(tenantId, connectionId, {
      status: 'active',
      lastError: null,
      lastSyncedAt: new Date(now),
      syncToken: res.etag,
    });
    return { ok: true, count };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Calendar sync failed.';
    await updateConnectionSyncState(tenantId, connectionId, {
      status: 'error',
      lastError: message,
      lastSyncedAt: new Date(now),
    }).catch(() => undefined);
    await publishBookingEvent('calendar.sync_failed', tenantId, null, {
      connectionId,
      resourceId: conn.resourceId,
      error: message,
    }).catch(() => undefined);
    logger.warn({ tenantId, connectionId, err }, 'calendar-sync: ical feed sync failed');
    return { ok: false, error: message };
  }
}

/** Sync one CalDAV connection (Apple iCloud app-password, or generic CalDAV).
 *  Decrypts the app-password, discovers the account's calendars over the network
 *  (SSRF-guarded), pulls busy VEVENTs, and replaces the resource's busy blocks.
 *  Same contract as the iCal path: records status either way, never throws. */
export async function syncCalDavConnection(
  logger: FastifyBaseLogger,
  tenantId: string,
  connectionId: string
): Promise<CalendarSyncOutcome> {
  const conn = await getCalendarConnection(tenantId, connectionId).catch(() => null);
  if (!conn) return { ok: false, error: 'not_found' };
  if (conn.connectionKind !== 'caldav') return { ok: false, error: 'unsupported_kind' };
  if (!isCalendarCryptoConfigured() || !conn.appPasswordEnc || !conn.caldavUsername) {
    await updateConnectionSyncState(tenantId, connectionId, {
      status: 'error',
      lastError: 'Calendar sync is missing its credentials or is not configured.',
      lastSyncedAt: new Date(),
    });
    return { ok: false, error: 'not_configured' };
  }

  const now = Date.now();
  try {
    const password = decryptCalendarSecret(conn.appPasswordEnc);
    const { ics } = await fetchCalDavBusyIcs({
      serverUrl: conn.caldavUrl ?? APPLE_ICLOUD_CALDAV,
      auth: { username: conn.caldavUsername, password },
      windowStart: now - PAST_MS,
      windowEnd: now + FUTURE_MS,
    });
    const blocks = parseBusyIntervals(ics, {
      windowStart: now - PAST_MS,
      windowEnd: now + FUTURE_MS,
      defaultDurationMs: DEFAULT_EVENT_MS,
    });
    const count = await replaceExternalBusyBlocks(tenantId, connectionId, conn.resourceId, blocks);
    await updateConnectionSyncState(tenantId, connectionId, {
      status: 'active',
      lastError: null,
      lastSyncedAt: new Date(now),
    });
    return { ok: true, count };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Calendar sync failed.';
    await updateConnectionSyncState(tenantId, connectionId, {
      status: 'error',
      lastError: message,
      lastSyncedAt: new Date(now),
    }).catch(() => undefined);
    await publishBookingEvent('calendar.sync_failed', tenantId, null, {
      connectionId,
      resourceId: conn.resourceId,
      error: message,
    }).catch(() => undefined);
    logger.warn({ tenantId, connectionId, err }, 'calendar-sync: caldav sync failed');
    return { ok: false, error: message };
  }
}

interface DueConnection {
  id: string;
  tenant_id: string;
  resource_id: string;
  provider: string;
  connection_kind: string;
}

export interface CalendarSyncTickResult {
  acquired: boolean;
  processed: number;
  errors: number;
}

export async function runCalendarSyncTick(
  logger: FastifyBaseLogger
): Promise<CalendarSyncTickResult> {
  const SKIPPED: CalendarSyncTickResult = { acquired: false, processed: 0, errors: 0 };
  return withAdvisoryTickLock(CALENDAR_SYNC_LOCK_KEY, SKIPPED, async () => {
    const due = await prisma.$queryRaw<DueConnection[]>`
      SELECT id, tenant_id, resource_id, provider, connection_kind
      FROM find_due_calendar_connections(${STALE_SECONDS}::int, 100)
    `;
    if (due.length === 0) return { acquired: true, processed: 0, errors: 0 };
    logger.info({ count: due.length }, 'calendar-sync: refreshing due connections');

    let processed = 0;
    let errors = 0;
    for (const row of due) {
      // ical_feed (Layer 2) polls; caldav + oauth (Layer 3) pull/refresh here. OAuth
      // rows surface only once the migration broadens this scan (push + inline-connect
      // sync work without it); this tick is the renewal + safety-net poll.
      let outcome: CalendarSyncOutcome | null = null;
      if (row.connection_kind === 'ical_feed') {
        outcome = await syncIcalConnection(logger, row.tenant_id, row.id);
      } else if (row.connection_kind === 'caldav') {
        outcome = await syncCalDavConnection(logger, row.tenant_id, row.id);
      } else if (row.connection_kind === 'oauth') {
        outcome = await syncOAuthConnection(logger, row.tenant_id, row.id);
      }
      if (!outcome) continue;
      if (outcome.ok) processed += 1;
      else errors += 1;
    }
    return { acquired: true, processed, errors };
  });
}

export function startCalendarSyncLoop(
  logger: FastifyBaseLogger,
  intervalMs: number = DEFAULT_INTERVAL_MS
): () => void {
  let stopped = false;
  let timer: NodeJS.Timeout | null = null;

  const tick = async (): Promise<void> => {
    if (stopped) return;
    try {
      await runCalendarSyncTick(logger);
    } catch (err) {
      logger.error({ err }, 'calendar-sync: tick threw — will retry next interval');
    }
    if (stopped) return;
    timer = setTimeout(() => void tick(), intervalMs);
  };

  timer = setTimeout(() => void tick(), intervalMs);
  logger.info({ intervalMs }, 'calendar-sync: loop started');

  return () => {
    stopped = true;
    if (timer) clearTimeout(timer);
    logger.info('calendar-sync: loop stopped');
  };
}
