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

/** Pixels per 15-minute slot. An hour is four of these. */
export const SLOT_PX = 16;
/** Minutes in one slot. */
export const SLOT_MIN = 15;

/**
 * The vertical offset of a block, as `top-[Npx]`, indexed by how many slots down
 * from the top of the window it sits. Literal strings so Tailwind emits them.
 */
export const TOP_PX: readonly string[] = [
  'top-[0px]',
  'top-[16px]',
  'top-[32px]',
  'top-[48px]',
  'top-[64px]',
  'top-[80px]',
  'top-[96px]',
  'top-[112px]',
  'top-[128px]',
  'top-[144px]',
  'top-[160px]',
  'top-[176px]',
  'top-[192px]',
  'top-[208px]',
  'top-[224px]',
  'top-[240px]',
  'top-[256px]',
  'top-[272px]',
  'top-[288px]',
  'top-[304px]',
  'top-[320px]',
  'top-[336px]',
  'top-[352px]',
  'top-[368px]',
  'top-[384px]',
  'top-[400px]',
  'top-[416px]',
  'top-[432px]',
  'top-[448px]',
  'top-[464px]',
  'top-[480px]',
  'top-[496px]',
  'top-[512px]',
  'top-[528px]',
  'top-[544px]',
  'top-[560px]',
  'top-[576px]',
  'top-[592px]',
  'top-[608px]',
  'top-[624px]',
  'top-[640px]',
  'top-[656px]',
  'top-[672px]',
  'top-[688px]',
  'top-[704px]',
  'top-[720px]',
  'top-[736px]',
  'top-[752px]',
  'top-[768px]',
  'top-[784px]',
  'top-[800px]',
  'top-[816px]',
  'top-[832px]',
  'top-[848px]',
  'top-[864px]',
  'top-[880px]',
  'top-[896px]',
  'top-[912px]',
  'top-[928px]',
  'top-[944px]',
  'top-[960px]',
  'top-[976px]',
  'top-[992px]',
  'top-[1008px]',
  'top-[1024px]',
  'top-[1040px]',
  'top-[1056px]',
  'top-[1072px]',
  'top-[1088px]',
  'top-[1104px]',
  'top-[1120px]',
  'top-[1136px]',
  'top-[1152px]',
  'top-[1168px]',
  'top-[1184px]',
  'top-[1200px]',
  'top-[1216px]',
  'top-[1232px]',
  'top-[1248px]',
  'top-[1264px]',
  'top-[1280px]',
  'top-[1296px]',
  'top-[1312px]',
  'top-[1328px]',
  'top-[1344px]',
  'top-[1360px]',
  'top-[1376px]',
  'top-[1392px]',
  'top-[1408px]',
  'top-[1424px]',
  'top-[1440px]',
  'top-[1456px]',
  'top-[1472px]',
  'top-[1488px]',
  'top-[1504px]',
  'top-[1520px]',
  'top-[1536px]',
];

/** The height of a block (or the whole column), as `h-[Npx]`, indexed by slots. */
export const HEIGHT_PX: readonly string[] = [
  'h-[0px]',
  'h-[16px]',
  'h-[32px]',
  'h-[48px]',
  'h-[64px]',
  'h-[80px]',
  'h-[96px]',
  'h-[112px]',
  'h-[128px]',
  'h-[144px]',
  'h-[160px]',
  'h-[176px]',
  'h-[192px]',
  'h-[208px]',
  'h-[224px]',
  'h-[240px]',
  'h-[256px]',
  'h-[272px]',
  'h-[288px]',
  'h-[304px]',
  'h-[320px]',
  'h-[336px]',
  'h-[352px]',
  'h-[368px]',
  'h-[384px]',
  'h-[400px]',
  'h-[416px]',
  'h-[432px]',
  'h-[448px]',
  'h-[464px]',
  'h-[480px]',
  'h-[496px]',
  'h-[512px]',
  'h-[528px]',
  'h-[544px]',
  'h-[560px]',
  'h-[576px]',
  'h-[592px]',
  'h-[608px]',
  'h-[624px]',
  'h-[640px]',
  'h-[656px]',
  'h-[672px]',
  'h-[688px]',
  'h-[704px]',
  'h-[720px]',
  'h-[736px]',
  'h-[752px]',
  'h-[768px]',
  'h-[784px]',
  'h-[800px]',
  'h-[816px]',
  'h-[832px]',
  'h-[848px]',
  'h-[864px]',
  'h-[880px]',
  'h-[896px]',
  'h-[912px]',
  'h-[928px]',
  'h-[944px]',
  'h-[960px]',
  'h-[976px]',
  'h-[992px]',
  'h-[1008px]',
  'h-[1024px]',
  'h-[1040px]',
  'h-[1056px]',
  'h-[1072px]',
  'h-[1088px]',
  'h-[1104px]',
  'h-[1120px]',
  'h-[1136px]',
  'h-[1152px]',
  'h-[1168px]',
  'h-[1184px]',
  'h-[1200px]',
  'h-[1216px]',
  'h-[1232px]',
  'h-[1248px]',
  'h-[1264px]',
  'h-[1280px]',
  'h-[1296px]',
  'h-[1312px]',
  'h-[1328px]',
  'h-[1344px]',
  'h-[1360px]',
  'h-[1376px]',
  'h-[1392px]',
  'h-[1408px]',
  'h-[1424px]',
  'h-[1440px]',
  'h-[1456px]',
  'h-[1472px]',
  'h-[1488px]',
  'h-[1504px]',
  'h-[1520px]',
  'h-[1536px]',
];

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
}

/** Anything with a start and end instant — the only shape the geometry needs. */
export interface Span {
  startAt: string;
  endAt: string;
}

function clamp(value: number, low: number, high: number): number {
  return Math.min(Math.max(value, low), high);
}

/** Local minutes past midnight for an instant, on the operator's own clock. */
export function minutesOfDay(iso: string): number {
  const date = new Date(iso);
  return date.getHours() * 60 + date.getMinutes();
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

function sameCalendarDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
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
    const start = new Date(span.startAt);
    const end = new Date(span.endAt);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) continue;
    const localStart = minutesOfDay(span.startAt);
    const localEnd = sameCalendarDay(start, end) ? minutesOfDay(span.endAt) || 24 * 60 : 24 * 60;
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

  const sorted = [...items].sort(
    (a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime()
  );

  // Partition into clusters of transitive overlap.
  const clusters: T[][] = [];
  let current: T[] = [];
  let clusterEnd = -Infinity;
  for (const item of sorted) {
    const start = new Date(item.startAt).getTime();
    const end = new Date(item.endAt).getTime();
    if (current.length > 0 && start >= clusterEnd) {
      clusters.push(current);
      current = [];
      clusterEnd = -Infinity;
    }
    current.push(item);
    clusterEnd = Math.max(clusterEnd, end);
  }
  if (current.length > 0) clusters.push(current);

  const out: { item: T; placement: Placement }[] = [];
  for (const cluster of clusters) {
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

function startOfLocalDay(iso: string): number {
  const date = new Date(iso);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

function place(span: Span, windowStartMin: number, laneCount: number, lane: number): Placement {
  const rawStart = minutesOfDay(span.startAt);
  const startMs = new Date(span.startAt).getTime();
  const dayStart = startOfLocalDay(span.startAt);
  // A booking that began on a previous day is pinned to the top of today.
  const startMin = startMs < dayStart ? windowStartMin : floorSlot(rawStart);
  const endSameDay = new Date(span.endAt);
  const spansPastMidnight = endSameDay.getTime() >= dayStart + 24 * 60 * 60 * 1000;
  const endMin = spansPastMidnight ? 24 * 60 : ceilSlot(minutesOfDay(span.endAt) || 24 * 60);

  const topSlots = clamp((startMin - windowStartMin) / SLOT_MIN, 0, 96);
  const spanSlots = clamp((endMin - startMin) / SLOT_MIN, 1, 96 - topSlots);

  return {
    topClass: TOP_PX[topSlots] ?? 'top-[0px]',
    heightClass: HEIGHT_PX[spanSlots] ?? 'h-[16px]',
    widthClass: LANE_WIDTH[laneCount - 1] ?? 'w-full',
    leftClass: (LANE_LEFT[laneCount - 1] ?? LANE_LEFT[0])?.[lane] ?? 'left-0',
  };
}
