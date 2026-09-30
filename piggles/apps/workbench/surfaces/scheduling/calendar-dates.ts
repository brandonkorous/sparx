'use client';

// The diary's calendar arithmetic and headings, split out of calendar-data.ts.
// Columns are the viewer's calendar dates; a booking's own clock is calendar-zone's.

import type { RangeQuery } from './calendar-data';

/* ── Dates: the diary's navigation ──────────────────────────────────────── */

const DAY_MS = 24 * 60 * 60 * 1000;

/** Midnight at the start of a date, on the operator's own clock. */
export function startOfDay(date: Date): Date {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

/** Monday 00:00 of the week a date falls in. Weeks start Monday — the working
 *  week most diaries are read by. */
export function startOfWeek(date: Date): Date {
  const start = startOfDay(date);
  // getDay(): 0=Sun..6=Sat. Shift so Monday is the origin.
  const shift = (start.getDay() + 6) % 7;
  start.setDate(start.getDate() - shift);
  return start;
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS);
}

export function addWeeks(date: Date, weeks: number): Date {
  return addDays(date, weeks * 7);
}

/** The seven day-starts of the week a date falls in. */
export function weekDays(anchor: Date): Date[] {
  const start = startOfWeek(anchor);
  return Array.from({ length: 7 }, (_unused, index) => addDays(start, index));
}

export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function isToday(date: Date): boolean {
  return isSameDay(date, new Date());
}

/** The [from, to) ISO window a day view reads. */
export function dayWindow(anchor: Date): RangeQuery {
  const from = startOfDay(anchor);
  return { from: from.toISOString(), to: addDays(from, 1).toISOString() };
}

/** The [from, to) ISO window a week view reads. */
export function weekWindow(anchor: Date): RangeQuery {
  const from = startOfWeek(anchor);
  return { from: from.toISOString(), to: addDays(from, 7).toISOString() };
}

/* ── Dates: labels ──────────────────────────────────────────────────────── */

/** The heading for a day, e.g. "Monday, 12 May 2026". */
export function dayLabel(date: Date): string {
  return new Intl.DateTimeFormat(undefined, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date);
}

/**
 * The heading for a week, e.g. "Aug 17 – 23, 2026" or "Apr 28 – May 4, 2026".
 *
 * `formatRange` rather than three hand-assembled branches. The branches put the
 * day before the month and pasted the pieces together, which is right in one
 * locale and wrong in the runtime's actual one: en-US produced "17–Aug 23, 2026"
 * for every same-month week — the start month simply gone, four weeks in five.
 * Intl already knows where each locale puts the parts and which parts a range
 * may share, so it is asked instead of guessed at.
 */
export function weekLabel(anchor: Date): string {
  const start = startOfWeek(anchor);
  return new Intl.DateTimeFormat(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).formatRange(start, addDays(start, 6));
}

/** A short column heading for a week day, e.g. "Mon 12". */
export function weekdayHeading(date: Date): { weekday: string; day: string } {
  return {
    weekday: new Intl.DateTimeFormat(undefined, { weekday: 'short' }).format(date),
    day: new Intl.DateTimeFormat(undefined, { day: 'numeric' }).format(date),
  };
}

/** An hour mark for the time gutter, e.g. "9 AM". */
export function hourLabel(hour: number): string {
  const date = new Date();
  date.setHours(hour, 0, 0, 0);
  return new Intl.DateTimeFormat(undefined, { hour: 'numeric' }).format(date);
}
