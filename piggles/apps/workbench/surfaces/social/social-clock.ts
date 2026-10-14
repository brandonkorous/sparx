// The social module's clock: whose time a post is shown on, and which day it sits
// under (piggles persona issue 990).
//
// Every time in the social screens used to read on THIS COMPUTER's clock. A business in
// London, opened on a laptop set to Pacific time, saw a post going out at 09:00 London
// time as "1:00 AM", a post at half past midnight on her Sunday sat under Saturday on the
// calendar, and a time typed in a schedule box was read eight hours out. Articles, email
// campaigns and the version history were fixed the same way (issues 942, 984 and 987).
//
// Two kinds of value live here, and they are kept apart on purpose:
//   - an INSTANT (an ISO string), which is shown on a zone it is given;
//   - a CALENDAR DAY ("2026-10-11"), which belongs to no zone at all. The calendar grid
//     is built from these, and a post is placed on one by reading its instant on the
//     business's clock. Day arithmetic is done in UTC so this computer's clock never
//     moves a day.

import { clockName, isoToWallClock, wallClockToIso } from '../../lib/publish-clock';
import type { Post } from './data';

/* ── Showing an instant ─────────────────────────────────────────────────── */

interface Formats {
  when: Intl.DateTimeFormat;
  time: Intl.DateTimeFormat;
}

const formats = new Map<string, Formats>();

/** Built once per zone: `Intl` objects are expensive to construct per row. */
function formatsFor(zone: string): Formats {
  let found = formats.get(zone);
  if (!found) {
    try {
      found = {
        when: new Intl.DateTimeFormat(undefined, {
          timeZone: zone,
          day: 'numeric',
          month: 'short',
          hour: 'numeric',
          minute: '2-digit',
        }),
        time: new Intl.DateTimeFormat(undefined, {
          timeZone: zone,
          hour: 'numeric',
          minute: '2-digit',
        }),
      };
    } catch {
      // A zone this browser does not know: UTC, which is at least the same for every
      // reader, rather than whatever this computer is set to.
      return formatsFor('UTC');
    }
    formats.set(zone, found);
  }
  return found;
}

/** "Oct 11, 9:00 AM", on `zone`'s clock. Something that is not a time comes back as written. */
export function whenOn(iso: string, zone: string): string {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return iso;
  return formatsFor(zone).when.format(at);
}

/** "9:00 AM", on `zone`'s clock: a calendar chip, where the day is already implied. */
export function timeOn(iso: string, zone: string): string {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return iso;
  return formatsFor(zone).time.format(at);
}

/** The one date that matters for a post, plus a verb: the line under its words. */
export function whenLine(post: Post, zone: string): string {
  if (post.publishedAt) return `Posted ${whenOn(post.publishedAt, zone)}`;
  if (post.scheduledAt) return `Goes out ${whenOn(post.scheduledAt, zone)}`;
  return `Saved ${whenOn(post.createdAt, zone)}`;
}

/** The line that says whose clock a screen's times are on. */
export function timesNote(zone: string | null, device: string, at: Date): string {
  if (zone) return `Times are on your business's clock, ${clockName(zone, at)}.`;
  return `Times are on this computer's clock, ${clockName(device, at)}, because your business has no time zone yet. You can set one in Business details.`;
}

/** The line under the spreadsheet box: whose clock a time typed in the file is on. The
 *  server reads it on the business's clock, or on this computer's when it has none. */
export function importClockNote(zone: string | null, device: string, at: Date): string {
  if (zone) {
    return `Times in your file are read on your business's clock, ${clockName(zone, at)}, unless a time names its own zone.`;
  }
  return `Times in your file are read on this computer's clock, ${clockName(device, at)}, because your business has no time zone yet. You can set one in Business details.`;
}

/* ── Calendar days ──────────────────────────────────────────────────────── */

const DAY_MS = 86_400_000;
const DAY_KEY = /^(\d{4})-(\d{2})-(\d{2})$/;

/** A calendar day as UTC midnight, for arithmetic that no clock can move. */
function keyToUtc(key: string): number {
  const match = DAY_KEY.exec(key);
  if (!match) return Number.NaN;
  return Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

function utcToKey(ms: number): string {
  const at = new Date(ms);
  if (Number.isNaN(at.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${String(at.getUTCFullYear())}-${pad(at.getUTCMonth() + 1)}-${pad(at.getUTCDate())}`;
}

/** The calendar day an instant falls on, on `zone`'s clock. Null for something that is
 *  not a time. A post at 23:30 UTC on a Saturday is on Sunday in London and Saturday in
 *  Los Angeles. */
export function dayOn(iso: string, zone: string): string | null {
  const wall = isoToWallClock(iso, zone);
  return wall ? wall.slice(0, 10) : null;
}

/** Today, on `zone`'s clock. */
export function todayOn(zone: string, now: number = Date.now()): string {
  const at = new Date(now);
  return dayOn(at.toISOString(), zone) ?? '';
}

export function addDays(key: string, days: number): string {
  return utcToKey(keyToUtc(key) + days * DAY_MS);
}

/** 0 = Sunday ... 6 = Saturday. */
export function weekdayOf(key: string): number {
  return new Date(keyToUtc(key)).getUTCDay();
}

/** The date number a calendar cell shows: 11 for "2026-10-11". */
export function dateNumber(key: string): number {
  return Number(key.slice(8, 10));
}

/** "2026-10": which month a day is in, for dimming the spill-over days. */
export function monthOf(key: string): string {
  return key.slice(0, 7);
}

export function startOfMonth(key: string): string {
  return `${monthOf(key)}-01`;
}

/** The Sunday on or before `key`: the week a day belongs to. */
export function startOfWeek(key: string): string {
  return addDays(key, -weekdayOf(key));
}

/** The seven days of the week `cursor` is in. */
export function weekDays(cursor: string): string[] {
  const start = startOfWeek(cursor);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

/** The 42 cells (6 stable weeks) of the month around `cursor`, Sunday first. */
export function monthGrid(cursor: string): string[] {
  const start = startOfWeek(startOfMonth(cursor));
  return Array.from({ length: 42 }, (_, i) => addDays(start, i));
}

/** One month or one week on from `cursor`, forward or back. */
export function stepCursor(cursor: string, view: 'month' | 'week', direction: number): string {
  if (view === 'week') return addDays(startOfWeek(cursor), direction * 7);
  const at = new Date(keyToUtc(startOfMonth(cursor)));
  return utcToKey(Date.UTC(at.getUTCFullYear(), at.getUTCMonth() + direction, 1));
}

/** A calendar day's own name. Formatted on UTC because the key is UTC midnight: the
 *  day is already decided, and no clock may move it. */
function dayFormat(options: Intl.DateTimeFormatOptions): (key: string) => string {
  const format = new Intl.DateTimeFormat(undefined, { ...options, timeZone: 'UTC' });
  return (key) => {
    const at = keyToUtc(key);
    return Number.isNaN(at) ? key : format.format(new Date(at));
  };
}

/** "Sunday, October 11", for a day cell's label. */
export const dayLabel = dayFormat({ weekday: 'long', month: 'long', day: 'numeric' });
const monthYear = dayFormat({ month: 'long', year: 'numeric' });
const shortDay = dayFormat({ month: 'short', day: 'numeric' });
const shortDayYear = dayFormat({ month: 'short', day: 'numeric', year: 'numeric' });

/** The heading over the grid: "October 2026", or "Oct 11 – Oct 17, 2026" for a week. */
export function rangeLabel(view: 'month' | 'week', cursor: string): string {
  if (view === 'month') return monthYear(cursor);
  const start = startOfWeek(cursor);
  return `${shortDay(start)} – ${shortDayYear(addDays(start, 6))}`;
}

/** Group things under the calendar day their instant falls on, on `zone`'s clock. */
export function byDayOn<T>(
  items: readonly T[],
  instantOf: (item: T) => string | null,
  zone: string
): Map<string, T[]> {
  const out = new Map<string, T[]>();
  for (const item of items) {
    const iso = instantOf(item);
    if (!iso) continue;
    const key = dayOn(iso, zone);
    if (!key) continue;
    const list = out.get(key);
    if (list) list.push(item);
    else out.set(key, [item]);
  }
  return out;
}

/** The instant a calendar day starts, on `zone`'s clock. */
export function dayStartOn(key: string, zone: string): Date | null {
  const iso = wallClockToIso(`${key}T00:00`, zone);
  return iso ? new Date(iso) : null;
}

/* ── Starting and moving a post from the calendar ───────────────────────── */

/** A day at 9am, in the shape the composer's schedule box takes. Tapping a DAY carries
 *  no hour, so 9am is a sensible opening bid. */
export function seedForDay(key: string): string {
  return `${key}T09:00`;
}

/** An exact moment (a free posting time) as the composer's schedule box value, on the
 *  business's clock, so the hour that was clicked is the hour the box shows. */
export function seedForInstant(iso: string, zone: string): string {
  return isoToWallClock(iso, zone);
}

/**
 * Where a post dropped on a calendar day lands: the same time of day on the business's
 * clock, on the new day. A draft with no time yet goes at 9am. A time already past (an
 * earlier part of today) is nudged to an hour from now, because the server only takes a
 * time still to come.
 *
 * Null when nothing moves: dropped back on the day it already sits on, or a day that is
 * not a day.
 */
export function rescheduleOn(
  scheduledAt: string | null,
  key: string,
  zone: string,
  now: number = Date.now()
): string | null {
  const wall = scheduledAt ? isoToWallClock(scheduledAt, zone) : '';
  const time = wall ? wall.slice(11, 16) : '09:00';
  const iso = wallClockToIso(`${key}T${time}`, zone);
  if (iso === null) return null;
  const at = new Date(iso).getTime();
  if (scheduledAt && new Date(scheduledAt).getTime() === at) return null;
  if (at > now) return iso;
  const soon = new Date(now + 60 * 60 * 1000);
  return soon.toISOString();
}
