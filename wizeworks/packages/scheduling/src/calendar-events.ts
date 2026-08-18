// PURE parse/build for Layer-3 provider calendar events (docs/79 §8.3). No network,
// no DB, no clock: the api-rest oauth-client fetches the JSON (paged) and persists,
// these functions only translate provider shapes ↔ the engine's `Interval` busy
// model + sparx's outbound event payload. Fully unit-tested.
//
//   · parseGoogleBusy / parseMicrosoftBusy — provider events → busy Interval[]
//     (skip cancelled + free/transparent; clip to the window), so the existing
//     availability merge (availability.ts) blocks sparx slots.
//   · googleSyncTokenFrom / microsoftDeltaLinkFrom — pull the next incremental
//     cursor out of a page response (stored as the connection's syncToken).
//   · buildGoogleImportEvent — a sparx booking → a Google `events.import` body keyed
//     on the booking's stable iCalUID, so re-importing UPDATES (never duplicates):
//     idempotent outbound by construction.

import type { Interval } from './time';

const DAY_MS = 24 * 60 * 60 * 1000;

export interface BusyWindow {
  windowStart: number; // epoch ms, inclusive
  windowEnd: number; // epoch ms, exclusive
  defaultDurationMs?: number; // span for an event missing an end
}

/** Clip an interval to the window; null when it falls outside or is empty. */
function clip(startMs: number, endMs: number, w: BusyWindow): Interval | null {
  const start = Math.max(startMs, w.windowStart);
  const end = Math.min(endMs, w.windowEnd);
  return end > start ? { start, end } : null;
}

function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === 'object' ? (v as Record<string, unknown>) : {};
}

// ── Google Calendar API (events.list / incremental sync) ─────────────────────

/** A Google event time is `{ dateTime }` (timed, RFC3339) or `{ date }` (all-day,
 *  `YYYY-MM-DD`). Returns [startMs, endMs] or null. */
function googleSpan(
  start: Record<string, unknown>,
  end: Record<string, unknown>,
  defaultDurationMs: number
): [number, number] | null {
  const sDt = typeof start.dateTime === 'string' ? Date.parse(start.dateTime) : NaN;
  const eDt = typeof end.dateTime === 'string' ? Date.parse(end.dateTime) : NaN;
  if (Number.isFinite(sDt)) {
    const endMs = Number.isFinite(eDt) ? eDt : sDt + defaultDurationMs;
    return [sDt, endMs];
  }
  // All-day: `date` is UTC-midnight; Google's `end.date` is exclusive already.
  const sD = typeof start.date === 'string' ? Date.parse(`${start.date}T00:00:00Z`) : NaN;
  if (Number.isFinite(sD)) {
    const eD = typeof end.date === 'string' ? Date.parse(`${end.date}T00:00:00Z`) : NaN;
    return [sD, Number.isFinite(eD) ? eD : sD + DAY_MS];
  }
  return null;
}

/** Google `events.list` items → busy intervals. Skips cancelled events and
 *  `transparency: 'transparent'` (free) ones — they don't block. */
export function parseGoogleBusy(items: unknown[], window: BusyWindow): Interval[] {
  const defaultDurationMs = window.defaultDurationMs ?? 60 * 60 * 1000;
  const out: Interval[] = [];
  for (const raw of items) {
    const ev = asRecord(raw);
    if (ev.status === 'cancelled' || ev.transparency === 'transparent') continue;
    const span = googleSpan(asRecord(ev.start), asRecord(ev.end), defaultDurationMs);
    if (!span) continue;
    const clipped = clip(span[0], span[1], window);
    if (clipped) out.push(clipped);
  }
  return out;
}

/** The incremental cursor for the next sync (`nextSyncToken`), or null on a page
 *  that only carries `nextPageToken` (the caller keeps paging first). */
export function googleSyncTokenFrom(pageJson: unknown): string | null {
  const o = asRecord(pageJson);
  return typeof o.nextSyncToken === 'string' && o.nextSyncToken ? o.nextSyncToken : null;
}

export function googleNextPageTokenFrom(pageJson: unknown): string | null {
  const o = asRecord(pageJson);
  return typeof o.nextPageToken === 'string' && o.nextPageToken ? o.nextPageToken : null;
}

export function googleItemsFrom(pageJson: unknown): unknown[] {
  const o = asRecord(pageJson);
  return Array.isArray(o.items) ? o.items : [];
}

// ── Microsoft Graph (calendarView / delta) ───────────────────────────────────

/** A Graph dateTime is `{ dateTime, timeZone }`. We request `Prefer:
 *  outlook.timezone="UTC"`, so `dateTime` is UTC wall time with no offset suffix —
 *  parse it as UTC. */
function graphInstant(node: Record<string, unknown>): number {
  const dt = typeof node.dateTime === 'string' ? node.dateTime : '';
  if (!dt) return NaN;
  // Already-zoned (ends in Z or ±hh:mm) → parse as-is; otherwise pin to UTC.
  const normalized = /[zZ]|[+-]\d{2}:?\d{2}$/.test(dt) ? dt : `${dt.replace(/\.\d+$/, '')}Z`;
  return Date.parse(normalized);
}

/** Graph `calendarView`/`delta` value[] → busy intervals. Skips cancelled events,
 *  `showAs: 'free'`, and `@removed` delta tombstones. */
export function parseMicrosoftBusy(value: unknown[], window: BusyWindow): Interval[] {
  const defaultDurationMs = window.defaultDurationMs ?? 60 * 60 * 1000;
  const out: Interval[] = [];
  for (const raw of value) {
    const ev = asRecord(raw);
    if (ev['@removed'] || ev.isCancelled === true || ev.showAs === 'free') continue;
    const startMs = graphInstant(asRecord(ev.start));
    if (!Number.isFinite(startMs)) continue;
    const endRaw = graphInstant(asRecord(ev.end));
    const endMs = Number.isFinite(endRaw) ? endRaw : startMs + defaultDurationMs;
    const clipped = clip(startMs, endMs, window);
    if (clipped) out.push(clipped);
  }
  return out;
}

/** Graph delta cursor (`@odata.deltaLink`) for the next incremental sync, or null
 *  when a page only carries `@odata.nextLink` (the caller keeps paging first). */
export function microsoftDeltaLinkFrom(pageJson: unknown): string | null {
  const o = asRecord(pageJson);
  const link = o['@odata.deltaLink'];
  return typeof link === 'string' && link ? link : null;
}

export function microsoftNextLinkFrom(pageJson: unknown): string | null {
  const o = asRecord(pageJson);
  const link = o['@odata.nextLink'];
  return typeof link === 'string' && link ? link : null;
}

export function microsoftValueFrom(pageJson: unknown): unknown[] {
  const o = asRecord(pageJson);
  return Array.isArray(o.value) ? o.value : [];
}

// ── Outbound: a sparx booking → a Google event (idempotent by iCalUID) ───────

export interface OutboundBookingEvent {
  bookingId: string;
  start: Date;
  end: Date;
  summary: string;
  description?: string | null;
  location?: string | null;
  cancelled: boolean;
}

/** The stable cross-system identity for a sparx booking — the SAME UID the outbound
 *  `.ics` feed (lib/scheduling-ical.ts) uses, so a booking never appears twice even
 *  if a tenant runs both the feed subscription and the API push. */
export function bookingICalUid(bookingId: string): string {
  return `${bookingId}@sparx.works`;
}

/** Build a Google `events.import` request body. `import` keys on `iCalUID`, so the
 *  same booking re-imported just updates its event — outbound can run every sync
 *  tick without ever duplicating. A cancelled booking imports as `status:
 *  cancelled` (Google removes it from the visible calendar). */
export function buildGoogleImportEvent(e: OutboundBookingEvent): Record<string, unknown> {
  const body: Record<string, unknown> = {
    iCalUID: bookingICalUid(e.bookingId),
    summary: e.summary,
    start: { dateTime: e.start.toISOString() },
    end: { dateTime: e.end.toISOString() },
    status: e.cancelled ? 'cancelled' : 'confirmed',
    source: { title: 'sparx', url: 'https://sparx.works' },
    extendedProperties: { private: { sparxBookingId: e.bookingId } },
  };
  if (e.description) body.description = e.description;
  if (e.location) body.location = e.location;
  return body;
}
