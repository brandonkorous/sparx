// iCal (RFC 5545) PARSER for inbound calendar sync (docs/79 §8.2). PURE: no DB, no
// clock, no network. Given a `.ics` document and a busy window, returns the busy
// intervals — non-recurring VEVENTs plus expanded recurring ones (via rrule.ts) —
// so a staff member's outside commitments can block sparx slots. Deliberately
// low-fidelity (the doc labels this layer stale + non-authoritative): it reads the
// fields that matter for "is this person busy" (DTSTART/DTEND/DURATION/RRULE/
// EXDATE/STATUS/TRANSP), and ignores everything else.
//
// Time handling: a `Z` (UTC) or floating instant is read as UTC; a `;TZID=`
// parameter is resolved to UTC via Intl (DST-correct), falling back to UTC if the
// zone is unknown. All-day `VALUE=DATE` events span local midnight→midnight in UTC.

import { mergeIntervals, type Interval } from './time';
import { expandRecurrence, parseIcsInstant, parseRRule } from './rrule';

const DAY_MS = 24 * 60 * 60 * 1000;

interface RawProp {
  name: string;
  params: Record<string, string>;
  value: string;
}

/** Unfold (RFC 5545 §3.1: a CRLF/LF followed by space/tab continues the line),
 *  then split into logical lines. */
function unfold(text: string): string[] {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\n[ \t]/g, '')
    .split('\n');
}

function parseLine(line: string): RawProp | null {
  const colon = line.indexOf(':');
  if (colon === -1) return null;
  const left = line.slice(0, colon);
  const value = line.slice(colon + 1);
  const segs = left.split(';');
  const name = segs[0]!.toUpperCase();
  const params: Record<string, string> = {};
  for (const seg of segs.slice(1)) {
    const eq = seg.indexOf('=');
    if (eq === -1) continue;
    params[seg.slice(0, eq).toUpperCase()] = seg.slice(eq + 1).replace(/^"|"$/g, '');
  }
  return { name, params, value };
}

/** Resolve a date-time property to an epoch-ms instant. Handles `Z`, floating, an
 *  all-day `VALUE=DATE`, and a `TZID=` zone (via Intl). Null when unparseable. */
function resolveInstant(prop: RawProp): number | null {
  const raw = prop.value.trim();
  const isDate = prop.params.VALUE?.toUpperCase() === 'DATE' || /^\d{8}$/.test(raw);
  if (isDate) {
    const m = /^(\d{4})(\d{2})(\d{2})$/.exec(raw);
    if (!m) return null;
    return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  }
  const tzid = prop.params.TZID;
  if (tzid && !raw.endsWith('Z')) {
    const wall = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})$/.exec(raw);
    if (wall) {
      return wallTimeToUtc(
        Number(wall[1]),
        Number(wall[2]),
        Number(wall[3]),
        Number(wall[4]),
        Number(wall[5]),
        Number(wall[6]),
        tzid
      );
    }
  }
  return parseIcsInstant(raw);
}

/** A TZID wall-clock → UTC epoch ms, DST-correct, via Intl (no date library). */
function wallTimeToUtc(
  y: number,
  mo: number,
  d: number,
  hh: number,
  mm: number,
  ss: number,
  tz: string
): number {
  const utcGuess = Date.UTC(y, mo - 1, d, hh, mm, ss);
  try {
    const dtf = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
    const parts = dtf.formatToParts(new Date(utcGuess));
    const get = (t: string): number => Number(parts.find((p) => p.type === t)?.value ?? '0');
    const asInTz = Date.UTC(
      get('year'),
      get('month') - 1,
      get('day'),
      get('hour') % 24,
      get('minute'),
      get('second')
    );
    // `asInTz` is what the UTC guess reads as in `tz`; the gap is the zone offset.
    const offset = asInTz - utcGuess;
    return utcGuess - offset;
  } catch {
    return utcGuess; // unknown zone → treat as UTC (documented fallback)
  }
}

export interface BusyParseOptions {
  /** Only events overlapping [windowStart, windowEnd] are returned. */
  windowStart: number;
  windowEnd: number;
  /** Default span for an event missing DTEND/DURATION (ms). Default 0 → skip. */
  defaultDurationMs?: number;
}

/** Parse a `.ics` document into merged busy intervals over the window. Skips
 *  cancelled events and ones explicitly marked free (TRANSP:TRANSPARENT). */
export function parseBusyIntervals(ics: string, opts: BusyParseOptions): Interval[] {
  const lines = unfold(ics);
  const intervals: Interval[] = [];

  let inEvent = false;
  let dtStart: number | null = null;
  let dtEnd: number | null = null;
  let allDay = false;
  let durationMs: number | null = null;
  let rrule: string | null = null;
  let status: string | null = null;
  let transp: string | null = null;
  const exDates = new Set<number>();

  const reset = (): void => {
    dtStart = null;
    dtEnd = null;
    allDay = false;
    durationMs = null;
    rrule = null;
    status = null;
    transp = null;
    exDates.clear();
  };

  for (const line of lines) {
    const upper = line.toUpperCase();
    if (upper === 'BEGIN:VEVENT') {
      inEvent = true;
      reset();
      continue;
    }
    if (upper === 'END:VEVENT') {
      inEvent = false;
      collectEvent();
      continue;
    }
    if (!inEvent) continue;

    const prop = parseLine(line);
    if (!prop) continue;
    switch (prop.name) {
      case 'DTSTART':
        dtStart = resolveInstant(prop);
        allDay = prop.params.VALUE?.toUpperCase() === 'DATE' || /^\d{8}$/.test(prop.value.trim());
        break;
      case 'DTEND':
        dtEnd = resolveInstant(prop);
        break;
      case 'DURATION':
        durationMs = parseIcsDuration(prop.value);
        break;
      case 'RRULE':
        rrule = prop.value;
        break;
      case 'EXDATE': {
        for (const part of prop.value.split(',')) {
          const ms = resolveInstant({ ...prop, value: part });
          if (ms != null) exDates.add(ms);
        }
        break;
      }
      case 'STATUS':
        status = prop.value.trim().toUpperCase();
        break;
      case 'TRANSP':
        transp = prop.value.trim().toUpperCase();
        break;
      default:
        break;
    }
  }

  function collectEvent(): void {
    if (dtStart == null) return;
    if (status === 'CANCELLED') return;
    if (transp === 'TRANSPARENT') return; // explicitly "free" time

    let span = durationMs ?? (dtEnd != null ? dtEnd - dtStart : null);
    if (span == null || span <= 0) {
      span = allDay ? DAY_MS : (opts.defaultDurationMs ?? 0);
    }
    if (span <= 0) return;

    const rule = rrule ? parseRRule(rrule) : null;
    if (rule) {
      intervals.push(
        ...expandRecurrence(dtStart, span, rule, opts.windowStart, opts.windowEnd, exDates)
      );
    } else if (dtStart + span > opts.windowStart && dtStart < opts.windowEnd) {
      intervals.push({ start: dtStart, end: dtStart + span });
    }
  }

  return mergeIntervals(intervals);
}

/** Parse an RFC 5545 DURATION (`PT1H30M`, `P2D`, `-PT15M`) to ms. 0 when unparseable. */
export function parseIcsDuration(value: string): number {
  const m = /^([+-]?)P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/.exec(
    value.trim()
  );
  if (!m) return 0;
  const sign = m[1] === '-' ? -1 : 1;
  const [, , w, d, h, min, s] = m;
  const ms =
    (Number(w ?? 0) * 7 * 24 * 60 * 60 +
      Number(d ?? 0) * 24 * 60 * 60 +
      Number(h ?? 0) * 60 * 60 +
      Number(min ?? 0) * 60 +
      Number(s ?? 0)) *
    1000;
  return sign * ms;
}
