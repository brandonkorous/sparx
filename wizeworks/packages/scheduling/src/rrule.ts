// A focused RFC 5545 RRULE expander (docs/79 §7.6, §8.2). PURE: no DB, no clock.
//
// Used twice: (1) expanding an imported calendar's recurring VEVENTs into
// `external_busy_blocks` for low-fidelity inbound sync, and (2) materializing a
// `BookingSeries` into child bookings. It intentionally covers the rules real
// calendars actually emit — FREQ DAILY/WEEKLY/MONTHLY/YEARLY with INTERVAL, COUNT,
// UNTIL, weekly BYDAY, and EXDATE — not the full grammar (no BYSETPOS / BYMONTHDAY
// lists / nth-weekday); an unsupported part degrades to the base frequency rather
// than throwing.
//
// Occurrences step the UTC instant directly (start + k·period). For an event whose
// TZID observes DST, an occurrence can land an hour off its intended wall-clock
// time across a transition — acceptable for the documented low-fidelity busy
// import, and exact for the UTC/standard-time series the booking engine creates.

import type { Interval } from './time';

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;
const MAX_OCCURRENCES = 1000; // safety bound on a single recurring event

export type Frequency = 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY';

export interface RRuleParts {
  freq: Frequency;
  interval: number;
  count?: number;
  /** Inclusive UNTIL instant (epoch ms, UTC). */
  until?: number;
  /** Weekly BYDAY as 0=SU..6=SA. Empty → the weekday of DTSTART. */
  byDay: number[];
}

const WEEKDAY_INDEX: Record<string, number> = {
  SU: 0,
  MO: 1,
  TU: 2,
  WE: 3,
  TH: 4,
  FR: 5,
  SA: 6,
};

/** Parse an `RRULE:` value (with or without the leading `RRULE:`). Null when no
 *  recognizable FREQ is present. */
export function parseRRule(value: string): RRuleParts | null {
  const body = value.replace(/^RRULE:/i, '').trim();
  if (!body) return null;
  const parts: Record<string, string> = {};
  for (const seg of body.split(';')) {
    const eq = seg.indexOf('=');
    if (eq === -1) continue;
    parts[seg.slice(0, eq).toUpperCase()] = seg.slice(eq + 1);
  }
  const freq = parts.FREQ?.toUpperCase();
  if (freq !== 'DAILY' && freq !== 'WEEKLY' && freq !== 'MONTHLY' && freq !== 'YEARLY') {
    return null;
  }
  const interval = Math.max(1, Number(parts.INTERVAL ?? '1') || 1);
  const count = parts.COUNT ? Math.max(0, Number(parts.COUNT) || 0) : undefined;
  const until = parts.UNTIL ? parseIcsInstant(parts.UNTIL) : undefined;
  const byDay = (parts.BYDAY ?? '')
    .split(',')
    .map((d) => WEEKDAY_INDEX[d.trim().slice(-2).toUpperCase()])
    .filter((n): n is number => n !== undefined);
  return { freq, interval, count, until: until ?? undefined, byDay };
}

/** Parse an iCal instant used in UNTIL / EXDATE: `YYYYMMDD`, `YYYYMMDDTHHMMSS`, or
 *  the same with a trailing `Z`. A floating (no-Z) value is read as UTC — fine for
 *  the bounded comparisons here. Returns epoch ms, or null. */
export function parseIcsInstant(raw: string): number | null {
  const m = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2}))?Z?$/.exec(raw.trim());
  if (!m) return null;
  const [, y, mo, d, hh, mm, ss] = m;
  return Date.UTC(
    Number(y),
    Number(mo) - 1,
    Number(d),
    Number(hh ?? '0'),
    Number(mm ?? '0'),
    Number(ss ?? '0')
  );
}

function weekdayUtc(ms: number): number {
  return new Date(ms).getUTCDay();
}

/** Add `n` calendar months to a UTC instant, clamping the day (Jan 31 +1mo → Feb 28/29). */
function addMonthsUtc(ms: number, n: number): number {
  const d = new Date(ms);
  const targetMonth = d.getUTCMonth() + n;
  const targetYear = d.getUTCFullYear() + Math.floor(targetMonth / 12);
  const normMonth = ((targetMonth % 12) + 12) % 12;
  const lastDay = new Date(Date.UTC(targetYear, normMonth + 1, 0)).getUTCDate();
  const day = Math.min(d.getUTCDate(), lastDay);
  return Date.UTC(
    targetYear,
    normMonth,
    day,
    d.getUTCHours(),
    d.getUTCMinutes(),
    d.getUTCSeconds()
  );
}

/** Generate the occurrence START instants of a rule, in order, bounded by COUNT /
 *  UNTIL / `windowEnd` / the hard occurrence cap. */
function occurrenceStarts(start: number, rule: RRuleParts, windowEnd: number): number[] {
  const hardEnd = rule.until != null ? Math.min(windowEnd, rule.until) : windowEnd;
  const out: number[] = [];
  const limit = rule.count ?? MAX_OCCURRENCES;

  if (rule.freq === 'WEEKLY' && rule.byDay.length > 0) {
    // Walk week blocks; within each active block emit the listed weekdays.
    const days = [...rule.byDay].sort((a, b) => a - b);
    const startWeekday = weekdayUtc(start);
    // Anchor to the same time-of-day on the Sunday of DTSTART's week so INTERVAL
    // counts whole weeks; `weekStart + wd·day` then keeps that time-of-day.
    let weekStart = start - startWeekday * DAY_MS;
    let blocks = 0;
    while (out.length < limit && weekStart <= hardEnd && blocks <= MAX_OCCURRENCES) {
      for (const wd of days) {
        const occ = weekStart + wd * DAY_MS;
        if (occ < start || occ > hardEnd) continue; // skip pre-DTSTART days in week 1
        out.push(occ);
        if (out.length >= limit) break;
      }
      blocks += 1;
      weekStart += rule.interval * WEEK_MS;
    }
    return out.sort((a, b) => a - b).slice(0, limit);
  }

  let occ = start;
  let i = 0;
  while (occ <= hardEnd && out.length < limit && i < MAX_OCCURRENCES) {
    out.push(occ);
    i += 1;
    if (rule.freq === 'DAILY') occ = start + i * rule.interval * DAY_MS;
    else if (rule.freq === 'WEEKLY') occ = start + i * rule.interval * WEEK_MS;
    else if (rule.freq === 'MONTHLY') occ = addMonthsUtc(start, i * rule.interval);
    else occ = addMonthsUtc(start, i * rule.interval * 12); // YEARLY
  }
  return out;
}

/** Expand a recurring event into the concrete [start, end] intervals overlapping
 *  `[windowStart, windowEnd]`, dropping any whose start matches an EXDATE. */
export function expandRecurrence(
  start: number,
  durationMs: number,
  rule: RRuleParts,
  windowStart: number,
  windowEnd: number,
  exDates: ReadonlySet<number> = new Set()
): Interval[] {
  if (windowEnd <= windowStart || durationMs <= 0) return [];
  const out: Interval[] = [];
  for (const occStart of occurrenceStarts(start, rule, windowEnd)) {
    if (exDates.has(occStart)) continue;
    const occEnd = occStart + durationMs;
    // Overlaps the window? (half-open: a block ending exactly at windowStart is out)
    if (occEnd > windowStart && occStart < windowEnd) {
      out.push({ start: occStart, end: occEnd });
    }
  }
  return out;
}
