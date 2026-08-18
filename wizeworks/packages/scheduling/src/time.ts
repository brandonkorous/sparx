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
// (minutes from local midnight); bookings are stored as UTC instants.
//
// THESE NOW LIVE IN @wizeworks/time. They were written here because scheduling was
// the only thing that needed them; CRM service-level agreements (docs/144 §7.3)
// are the second consumer, and a DST bug fixed in one copy of this arithmetic
// would still be a DST bug in the other. Re-exported rather than moved-and-
// rewritten so every existing `from './time'` import keeps working.

export { tzOffsetMs, localWallToUtc, localCalendarParts, eachLocalDay } from '@wizeworks/time';
