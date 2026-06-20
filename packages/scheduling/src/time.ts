// Pure time + interval math for the availability engine (docs/79 §7). No DB, no
// Date.now() inside the pure helpers — everything takes explicit instants so the
// algorithm is deterministic and unit-testable.
//
// Intervals are half-open [start, end) in epoch milliseconds — matching the
// tstzrange('[)') the DB-level no-overlap constraint uses, so app math and the
// DB guard agree on adjacency (11:00–12:00 does NOT overlap 10:00–11:00).

export interface Interval {
  start: number; // epoch ms, inclusive
  end: number; // epoch ms, exclusive
}

export function overlaps(a: Interval, b: Interval): boolean {
  return a.start < b.end && b.start < a.end;
}

/** Does `outer` fully contain `inner`? */
export function contains(outer: Interval, inner: Interval): boolean {
  return outer.start <= inner.start && inner.end <= outer.end;
}

/** Sort + merge overlapping/adjacent intervals into a minimal disjoint set. */
export function mergeIntervals(intervals: Interval[]): Interval[] {
  if (intervals.length <= 1) return [...intervals];
  const sorted = [...intervals].sort((a, b) => a.start - b.start);
  const out: Interval[] = [{ ...sorted[0]! }];
  for (let i = 1; i < sorted.length; i++) {
    const last = out[out.length - 1]!;
    const cur = sorted[i]!;
    if (cur.start <= last.end) {
      last.end = Math.max(last.end, cur.end);
    } else {
      out.push({ ...cur });
    }
  }
  return out;
}

/** `base` minus every interval in `cuts` — the core of free-time computation
 *  (availability windows minus exceptions / bookings / external busy). */
export function subtractIntervals(base: Interval[], cuts: Interval[]): Interval[] {
  const merged = mergeIntervals(cuts);
  let result = base.map((b) => ({ ...b }));
  for (const cut of merged) {
    const next: Interval[] = [];
    for (const seg of result) {
      if (!overlaps(seg, cut)) {
        next.push(seg);
        continue;
      }
      // Left remainder.
      if (seg.start < cut.start) next.push({ start: seg.start, end: cut.start });
      // Right remainder.
      if (cut.end < seg.end) next.push({ start: cut.end, end: seg.end });
    }
    result = next;
  }
  return result.filter((s) => s.end > s.start);
}

// ── Time-zone resolution ────────────────────────────────────────────────────
// Availability windows are authored in the resource's LOCAL wall-clock time
// (minutes from local midnight); bookings are stored as UTC instants. These two
// helpers bridge the two DST-correctly using the platform Intl tz database — no
// external date library.

/** Offset (ms) to ADD to a UTC instant to get the wall-clock reading in `tz`. */
export function tzOffsetMs(utcMs: number, tz: string): number {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const parts = dtf.formatToParts(new Date(utcMs));
  const get = (t: string): number => Number(parts.find((p) => p.type === t)?.value);
  let hour = get('hour');
  if (hour === 24) hour = 0; // some engines emit 24 for midnight
  const asIfUtc = Date.UTC(
    get('year'),
    get('month') - 1,
    get('day'),
    hour,
    get('minute'),
    get('second')
  );
  return asIfUtc - utcMs;
}

/** Convert a local wall time (calendar Y/M/D + minutes-from-midnight in `tz`) to
 *  the UTC epoch ms. Two-pass offset resolution handles DST except the ~1
 *  ambiguous/nonexistent hour at a transition (acceptable for v1 scheduling). */
export function localWallToUtc(
  year: number,
  month1: number, // 1-12
  day: number,
  minuteOfDay: number,
  tz: string
): number {
  const naiveUtc = Date.UTC(year, month1 - 1, day, Math.floor(minuteOfDay / 60), minuteOfDay % 60);
  const off1 = tzOffsetMs(naiveUtc, tz);
  const guess = naiveUtc - off1;
  const off2 = tzOffsetMs(guess, tz);
  return naiveUtc - off2;
}

/** The calendar Y/M/D + weekday (0=Sun..6=Sat) of a UTC instant, read in `tz`. */
export function localCalendarParts(
  utcMs: number,
  tz: string
): { year: number; month1: number; day: number; weekday: number } {
  const local = new Date(utcMs + tzOffsetMs(utcMs, tz));
  return {
    year: local.getUTCFullYear(),
    month1: local.getUTCMonth() + 1,
    day: local.getUTCDate(),
    weekday: local.getUTCDay(),
  };
}

/** Iterate calendar days (as local Y/M/D + weekday) spanned by [fromUtc, toUtc]
 *  in `tz`. Used to expand weekly availability windows over a query range. */
export function eachLocalDay(
  fromUtc: number,
  toUtc: number,
  tz: string
): { year: number; month1: number; day: number; weekday: number }[] {
  const out: { year: number; month1: number; day: number; weekday: number }[] = [];
  // Step a day at a time from the local date of `from` to the local date of `to`.
  const start = localCalendarParts(fromUtc, tz);
  let cursor = Date.UTC(start.year, start.month1 - 1, start.day);
  const endParts = localCalendarParts(toUtc, tz);
  const endUtcDay = Date.UTC(endParts.year, endParts.month1 - 1, endParts.day);
  // Guard against pathological ranges.
  let guard = 0;
  while (cursor <= endUtcDay && guard++ < 1000) {
    const d = new Date(cursor);
    out.push({
      year: d.getUTCFullYear(),
      month1: d.getUTCMonth() + 1,
      day: d.getUTCDate(),
      weekday: d.getUTCDay(),
    });
    cursor += 24 * 60 * 60 * 1000;
  }
  return out;
}
