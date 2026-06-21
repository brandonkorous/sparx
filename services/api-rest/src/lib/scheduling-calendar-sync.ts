// Inbound iCal busy-import sync (docs/79 §8.2) — the orchestration the engine
// can't do: decrypt the feed URL, fetch it (SSRF-guarded), parse busy intervals
// (the pure engine parser), and replace the resource's external_busy_blocks. Runs
// on demand (create / "sync now") and on a background tick across all tenants.
//
// Layer 2 is explicitly low-fidelity: a connection that fails flips to `status:
// error`, raises `calendar.sync_failed`, and the resource simply falls back to
// sparx-only data — a stale feed never weakens the DB-level no-overlap guard (§8.4).

import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

import type { FastifyBaseLogger } from 'fastify';
import { prisma } from '@sparx/db';
import {
  getCalendarConnection,
  parseBusyIntervals,
  replaceExternalBusyBlocks,
  updateConnectionSyncState,
} from '@sparx/scheduling';

import { decryptCalendarSecret, isCalendarCryptoConfigured } from './scheduling-calendar-crypto.js';
import { publishBookingEvent } from './scheduling-events.js';

const CALENDAR_SYNC_LOCK_KEY = 4242_4246;
const DEFAULT_INTERVAL_MS = 300_000; // tick every 5 min
const STALE_SECONDS = 3600; // refresh a feed at most ~hourly (upstream caches 12–24h anyway)
const PAST_MS = 2 * 24 * 60 * 60 * 1000; // import a little history…
const FUTURE_MS = 120 * 24 * 60 * 60 * 1000; // …and ~4 months ahead
const DEFAULT_EVENT_MS = 60 * 60 * 1000; // span for an event with no end
const FETCH_TIMEOUT_MS = 12_000;
const MAX_BYTES = 8 * 1024 * 1024;
const MAX_REDIRECTS = 3;

/** A user-facing feed error — the message lands in `last_error` + the dashboard. */
export class CalendarFeedError extends Error {}

function isPrivateAddress(ip: string): boolean {
  if (isIP(ip) === 4) {
    const [a, b] = ip.split('.').map(Number);
    if (a === undefined || b === undefined) return true;
    if (a === 0 || a === 10 || a === 127) return true;
    if (a === 169 && b === 254) return true; // link-local incl. cloud metadata 169.254.169.254
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
    return false;
  }
  const lower = ip.toLowerCase();
  if (lower === '::1' || lower === '::') return true;
  if (lower.startsWith('fc') || lower.startsWith('fd')) return true; // ULA fc00::/7
  if (lower.startsWith('fe80')) return true; // link-local
  if (lower.startsWith('::ffff:')) return isPrivateAddress(lower.slice('::ffff:'.length));
  return false;
}

/** Validate a feed URL is a public HTTPS endpoint (defeats SSRF: localhost, private
 *  ranges, cloud-metadata, DNS-rebinding). `webcal://` is normalized to https. */
export async function assertPublicHttpsUrl(raw: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    throw new CalendarFeedError('That does not look like a valid calendar URL.');
  }
  if (url.protocol === 'webcal:') url.protocol = 'https:';
  if (url.protocol !== 'https:') throw new CalendarFeedError('Calendar feed URLs must use https.');
  const host = url.hostname.toLowerCase();
  if (host === 'localhost' || host.endsWith('.local') || host.endsWith('.internal')) {
    throw new CalendarFeedError('That calendar URL is not allowed.');
  }
  const addresses = isIP(host)
    ? [host]
    : (await lookup(host, { all: true }).catch(() => [])).map((a) => a.address);
  if (addresses.length === 0) throw new CalendarFeedError('That calendar host could not be found.');
  for (const addr of addresses) {
    if (isPrivateAddress(addr)) throw new CalendarFeedError('That calendar URL is not allowed.');
  }
  return url;
}

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
  const lock = await prisma.$queryRaw<{ acquired: boolean }[]>`
    SELECT pg_try_advisory_lock(${CALENDAR_SYNC_LOCK_KEY}::int) AS acquired
  `;
  if (!lock[0]?.acquired) return { acquired: false, processed: 0, errors: 0 };

  try {
    const due = await prisma.$queryRaw<DueConnection[]>`
      SELECT id, tenant_id, resource_id, provider, connection_kind
      FROM find_due_calendar_connections(${STALE_SECONDS}::int, 100)
    `;
    if (due.length === 0) return { acquired: true, processed: 0, errors: 0 };
    logger.info({ count: due.length }, 'calendar-sync: refreshing due connections');

    let processed = 0;
    let errors = 0;
    for (const row of due) {
      // Slice 2 handles ical_feed; caldav/oauth pull lands with Layer 3.
      if (row.connection_kind !== 'ical_feed') continue;
      const outcome = await syncIcalConnection(logger, row.tenant_id, row.id);
      if (outcome.ok) processed += 1;
      else errors += 1;
    }
    return { acquired: true, processed, errors };
  } finally {
    await prisma.$queryRaw`SELECT pg_advisory_unlock(${CALENDAR_SYNC_LOCK_KEY}::int)`;
  }
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
