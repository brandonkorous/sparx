'use client';

// ══════════════════════════════════════════════════════════════════════════
// CALENDAR GEOMETRY — turning times into a grid, WITHOUT an inline style.
//
// A time block is positioned by a continuous value (its start minute, its
// duration). The house rule bans `style={{ top, height }}` outright — it is the
// crack hand-painted controls climb through. So we do what `BAR_HEIGHT` does in
// sites/traffic.tsx: QUANTISE to a finite set of literal Tailwind classes the
// compiler can actually see.
//
// The unit is a 15-minute SLOT rendered 16px tall (an hour is 64px). A
// booking snaps to slot boundaries — its start floored, its end ceiled, never
// below one slot — so every top offset and every height is a whole number of
// slots, and the whole day is at most 96 of them. That makes the position
// classes a lookup, not a computation: TOP_PX[slotsFromTop] and HEIGHT_PX[slots].
//
// Concurrent bookings (two staff booked at ten, a double-booked pooled bay) are
// laid side by side in LANES, and lane width/offset quantise the same way — to
// standard halves, thirds and quarters. Four abreast is the cap; past that the
// diary is telling you something a calendar cannot fix.
// ══════════════════════════════════════════════════════════════════════════

import { HEIGHT_PX, SLOT_MIN, TOP_PX } from './calendar-scale';
import { zoned } from './calendar-zone';

export { SLOT_MIN, SLOT_PX, TOP_PX, HEIGHT_PX } from './calendar-scale';

/** Lane width by how many lanes share the cluster (1–4). */
const LANE_WIDTH = ['w-full', 'w-1/2', 'w-1/3', 'w-1/4'] as const;

/** Lane left-offset, indexed [laneCount-1][laneIndex]. Standard fractions only. */
const LANE_LEFT: readonly (readonly string[])[] = [
  ['left-0'],
  ['left-0', 'left-1/2'],
  ['left-0', 'left-1/3', 'left-2/3'],
  ['left-0', 'left-1/4', 'left-1/2', 'left-3/4'],
];

/** A block's placement in one column: where it sits, how tall, and which lane. */
export interface Placement {
  /** `top-[Npx]` for the block's top edge. */
  topClass: string;
  /** `h-[Npx]` for the block's height. */
  heightClass: string;
  /** `w-*` for the block's width within its cluster. */
  widthClass: string;
  /** `left-*` for the block's horizontal offset. */
  leftClass: string;
  /** How many 15-minute slots tall the block is. The block reads this to decide
   *  how much it can SAY: three stacked lines need about fifty pixels and a
   *  half-hour booking is thirty-two, so a block that always drew three sliced
   *  the last two through the middle of the letters (issue 148). */
  slots: number;
}

/** Anything with a start and end instant — the only shape the geometry needs. */
export interface Span {
  startAt: string;
  endAt: string;
  /** The zone whose clock places it. The booking's own, never the viewer's. */
  timezone?: string | null;
}

function clamp(value: number, low: number, high: number): number {
  return Math.min(Math.max(value, low), high);
}

/** Minutes past midnight for an instant, on the clock of the zone given. */
export function minutesOfDay(iso: string, timezone?: string | null): number {
  return zoned(iso, timezone).minutes;
}

function floorSlot(minutes: number): number {
  return Math.floor(minutes / SLOT_MIN) * SLOT_MIN;
}

function ceilSlot(minutes: number): number {
  return Math.ceil(minutes / SLOT_MIN) * SLOT_MIN;
}

/** The hour span every column of a view shares — its top edge, bottom edge, and
 *  how many slots tall that makes each column. */
export interface TimeWindow {
  startMin: number;
  endMin: number;
  slots: number;
}

/**
 * The hour window a whole VIEW shares — one time axis for every day/resource
 * column so the gutter lines up across all of them.
 *
 * Opens on a sensible working span (08:00–18:00) and then STRETCHES to swallow
 * anything booked outside it — an early delivery, a late class — so nothing is
 * ever clipped off the top or bottom of the diary. It reads each event by its
 * local time-of-day (a span crossing midnight counts as running to midnight on
 * its start day), so it needs no per-day context. Whole hours, so the gutter
 * labels land on the lines.
 */
export function windowForEvents(spans: Span[]): TimeWindow {
  let startMin = 8 * 60;
  let endMin = 18 * 60;
  for (const span of spans) {
    const start = zoned(span.startAt, span.timezone);
    const end = zoned(span.endAt, span.timezone);
    if (start.dayKey === '' || end.dayKey === '') continue;
    const localStart = start.minutes;
    const localEnd = start.dayKey === end.dayKey ? end.minutes || 24 * 60 : 24 * 60;
    startMin = Math.min(startMin, Math.floor(localStart / 60) * 60);
    endMin = Math.max(endMin, Math.ceil(localEnd / 60) * 60);
  }
  startMin = clamp(startMin, 0, 23 * 60);
  endMin = clamp(endMin, startMin + 60, 24 * 60);
  return { startMin, endMin, slots: (endMin - startMin) / SLOT_MIN };
}

/** The hour marks inside a window — for the gutter labels and the faint lines. */
export function hourMarks(startMin: number, endMin: number): { hour: number; topClass: string }[] {
  const marks: { hour: number; topClass: string }[] = [];
  for (let m = startMin; m <= endMin; m += 60) {
    const slot = (m - startMin) / SLOT_MIN;
    marks.push({ hour: m / 60, topClass: TOP_PX[slot] ?? 'top-[0px]' });
  }
  return marks;
}

/** The pixel height class for a whole column of `slots` slots. */
export function columnHeightClass(slots: number): string {
  return HEIGHT_PX[clamp(slots, 1, 96)] ?? 'h-[1536px]';
}

/** Blocks partitioned into clusters of transitive overlap, in start order. */
function clustersOf<T extends Span>(items: T[]): T[][] {
  const sorted = [...items].sort(
    (a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime()
  );
  const clusters: T[][] = [];
  let current: T[] = [];
  let clusterEnd = -Infinity;
  for (const item of sorted) {
    const start = new Date(item.startAt).getTime();
    if (current.length > 0 && start >= clusterEnd) {
      clusters.push(current);
      current = [];
      clusterEnd = -Infinity;
    }
    current.push(item);
    clusterEnd = Math.max(clusterEnd, new Date(item.endAt).getTime());
  }
  if (current.length > 0) clusters.push(current);
  return clusters;
}

/**
 * Greedy lane assignment for one column's blocks, against a SHARED window.
 *
 * Blocks that overlap in time can't share a lane, so they fan out sideways.
 * Blocks are grouped into CLUSTERS of mutual overlap; within a cluster each gets
 * the first lane free at its start, and every block in the cluster is told the
 * cluster's total lane count so they all divide the width the same way. For an
 * exclusive resource (the DB forbids double-booking one) a column is a single
 * lane — the common, calm case. The window is passed in, not derived, so every
 * column of a view lines up on one time axis.
 */
export function placeEvents<T extends Span>(
  items: T[],
  window: TimeWindow
): { item: T; placement: Placement }[] {
  if (items.length === 0) return [];
  const out: { item: T; placement: Placement }[] = [];
  for (const cluster of clustersOf(items)) {
    // Assign each block the earliest lane whose last block has already ended.
    const laneEnds: number[] = [];
    const laneOf = new Map<T, number>();
    for (const item of cluster) {
      const start = new Date(item.startAt).getTime();
      const end = new Date(item.endAt).getTime();
      let lane = laneEnds.findIndex((laneEnd) => start >= laneEnd);
      if (lane === -1) {
        lane = laneEnds.length;
        laneEnds.push(end);
      } else {
        laneEnds[lane] = end;
      }
      laneOf.set(item, lane);
    }
    const laneCount = Math.min(laneEnds.length, 4);
    for (const item of cluster) {
      const lane = Math.min(laneOf.get(item) ?? 0, laneCount - 1);
      out.push({ item, placement: place(item, window.startMin, laneCount, lane) });
    }
  }
  return out;
}

function place(span: Span, windowStartMin: number, laneCount: number, lane: number): Placement {
  // On the booking's own clock, so the block sits where its text says it is.
  const start = zoned(span.startAt, span.timezone);
  const end = zoned(span.endAt, span.timezone);
  const startMin = floorSlot(start.minutes);
  // Running past midnight draws it to the bottom of the day it starts on.
  const endMin = end.dayKey !== start.dayKey ? 24 * 60 : ceilSlot(end.minutes || 24 * 60);

  const topSlots = clamp((startMin - windowStartMin) / SLOT_MIN, 0, 96);
  const spanSlots = clamp((endMin - startMin) / SLOT_MIN, 1, 96 - topSlots);

  return {
    topClass: TOP_PX[topSlots] ?? 'top-[0px]',
    heightClass: HEIGHT_PX[spanSlots] ?? 'h-[16px]',
    widthClass: LANE_WIDTH[laneCount - 1] ?? 'w-full',
    leftClass: (LANE_LEFT[laneCount - 1] ?? LANE_LEFT[0])?.[lane] ?? 'left-0',
    slots: spanSlots,
  };
}
