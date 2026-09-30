'use client';

// A booking sits on the clock of the zone it was made in, not the viewer's.
// Read on the viewer's, a 10:00 appointment drew at 3 AM seven hours away.
// Columns are plain calendar dates; the range read is padded a day each side.

/** A booking's position on the diary: which calendar day, and how far into it. */
export interface Zoned {
  /** `YYYY-MM-DD`, the day it falls on in its own zone. */
  dayKey: string;
  /** Minutes past midnight, on its own clock. */
  minutes: number;
}

const formatters = new Map<string, Intl.DateTimeFormat>();

const PARTS: Intl.DateTimeFormatOptions = {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
};

/** One formatter per zone. An unknown zone falls back to the viewer's clock
 *  rather than throwing: a block drawn a few hours off beats a blank diary. */
function partsFormatter(timezone?: string | null): Intl.DateTimeFormat {
  const key = timezone ?? '';
  const cached = formatters.get(key);
  if (cached) return cached;
  let made: Intl.DateTimeFormat;
  try {
    made = new Intl.DateTimeFormat('en-US', timezone ? { ...PARTS, timeZone: timezone } : PARTS);
  } catch {
    made = new Intl.DateTimeFormat('en-US', PARTS);
  }
  formatters.set(key, made);
  return made;
}

/** Where an instant falls, on the clock of the zone given (the viewer's if none). */
export function zoned(iso: string, timezone?: string | null): Zoned {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return { dayKey: '', minutes: 0 };
  const parts = partsFormatter(timezone).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((entry) => entry.type === type)?.value ?? '00';
  // Some engines spell midnight "24" even under h23.
  const hour = Number(part('hour')) % 24;
  return {
    dayKey: `${part('year')}-${part('month')}-${part('day')}`,
    minutes: hour * 60 + Number(part('minute')),
  };
}

/** A column's calendar date as `YYYY-MM-DD`. Columns are dates, not instants. */
export function localDayKey(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${String(date.getFullYear())}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** The clock part of an instant in its own zone, e.g. "10:00 AM". */
export function zonedClock(iso: string, timezone?: string | null): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const options: Intl.DateTimeFormatOptions = { hour: 'numeric', minute: '2-digit' };
  try {
    return new Intl.DateTimeFormat(
      undefined,
      timezone ? { ...options, timeZone: timezone } : options
    ).format(date);
  } catch {
    return new Intl.DateTimeFormat(undefined, options).format(date);
  }
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** A [from, to) read widened by a day each side, so a booking whose own day is
 *  in view is fetched even when the viewer's clock puts it outside the window. */
export function padRange(range: { from: string; to: string }): { from: string; to: string } {
  return {
    from: new Date(new Date(range.from).getTime() - DAY_MS).toISOString(),
    to: new Date(new Date(range.to).getTime() + DAY_MS).toISOString(),
  };
}

/** The events whose own day falls inside a [from, to) read. The other half of
 *  `padRange`: the padding fetches neighbours, this drops them again. Days are
 *  the viewer's calendar dates, since those are what the columns are. */
export function inRange<T extends { startAt: string; timezone?: string | null }>(
  events: T[],
  range: { from: string; to: string }
): T[] {
  const keys = new Set<string>();
  const day = new Date(range.from);
  const end = new Date(range.to).getTime();
  while (day.getTime() < end) {
    keys.add(localDayKey(day));
    day.setDate(day.getDate() + 1);
  }
  return events.filter((event) => keys.has(zoned(event.startAt, event.timezone).dayKey));
}
