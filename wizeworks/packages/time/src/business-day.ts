// The business's calendar day, for anything filed BY day.
//
// A figure kept per day (a day's sales, a day's payments, a day's profit) has
// to be filed on the day it happened IN THE SHOP. Every daily money figure was
// filed on the UTC date of the moment instead, so a shop in Denver had every
// sale between 6pm and midnight filed under tomorrow, and the last evening of a
// month filed under the next month (sparx persona issue 174). Invoices and
// statements already print the business's day (issues 145 and 146); this is
// the same rule for the figures, built on the zone math in `./tz`.
//
// Two kinds of value meet here and they must not be confused:
//
//   • A MOMENT (an order placed, a payment received, stock leaving) falls on
//     the business's calendar day: read it in the business's zone.
//   • A DATE (an expense's day, a report's "from", a rollup bucket) is already
//     a day. It travels as `YYYY-MM-DD` or as midnight UTC, and it means that
//     date as written. Reading it through a zone west of UTC would move it to
//     the day before.
//
// A business that has not said where it is (most have not) keeps UTC, and so
// does one whose zone the runtime does not know: an unknown zone must not stop
// a report.

import { formatLocalDate, localCalendarParts, localWallToUtc } from './tz';

const MS_PER_DAY = 86_400_000;
const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * The zone a business's calendar is read in: its own when the runtime knows it,
 * otherwise UTC.
 *
 * Also the value to hand to SQL's `AT TIME ZONE`, so the database and this
 * module always read the same zone.
 */
export function calendarZone(timeZone: string | null | undefined): string {
  const zone = timeZone?.trim() ?? '';
  if (zone === '') return 'UTC';
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: zone });
    return zone;
  } catch {
    return 'UTC';
  }
}

/** `YYYY-MM-DD` of a date-only value as written: the UTC date of a midnight-UTC Date. */
export function dateKeyOf(day: Date): string {
  return day.toISOString().slice(0, 10);
}

/** A `YYYY-MM-DD` date as the midnight-UTC Date a `DATE` column round-trips as. */
export function dateOfKey(key: string): Date {
  const match = DATE_ONLY.exec(key);
  if (!match) throw new RangeError(`Not a calendar date: ${key}`);
  return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
}

/** A calendar date moved by whole days. Pure calendar arithmetic: no zone. */
export function shiftDateKey(key: string, days: number): string {
  return dateKeyOf(new Date(dateOfKey(key).getTime() + Math.trunc(days) * MS_PER_DAY));
}

/** The business's calendar day a moment fell on, as `YYYY-MM-DD`. */
export function businessDateKey(at: Date, timeZone: string | null | undefined): string {
  return formatLocalDate(localCalendarParts(at.getTime(), calendarZone(timeZone)));
}

/**
 * `businessDateKey` for many moments in one zone, as a function.
 *
 * Remembers the answer per UTC quarter hour. Every zone's offset is a whole
 * number of quarter hours, so a business's midnight and its clock changes all
 * fall on a quarter-hour edge, and every moment inside one quarter hour is on
 * the same business day. A rollup folds every order of a year one at a time,
 * and reading the zone database once per order cost about 40µs each.
 */
export function businessDayKeyer(timeZone: string | null | undefined): (at: Date) => string {
  const zone = calendarZone(timeZone);
  const QUARTER_HOUR_MS = 15 * 60_000;
  const seen = new Map<number, string>();
  return (at) => {
    const slot = Math.floor(at.getTime() / QUARTER_HOUR_MS);
    let key = seen.get(slot);
    if (key === undefined) {
      key = formatLocalDate(localCalendarParts(slot * QUARTER_HOUR_MS, zone));
      seen.set(slot, key);
    }
    return key;
  };
}

/**
 * The moment a business's calendar day begins: its local midnight.
 *
 * `day` is a DATE: `YYYY-MM-DD`, or a date-only value at midnight UTC, which
 * means that date as written. The day ends where the next one begins, so a day
 * the clocks change on is 23 or 25 hours long, as it is in the shop.
 */
export function businessDayStart(day: string | Date, timeZone: string | null | undefined): Date {
  const key = typeof day === 'string' ? day : dateKeyOf(day);
  const date = dateOfKey(key);
  return new Date(
    localWallToUtc(
      date.getUTCFullYear(),
      date.getUTCMonth() + 1,
      date.getUTCDate(),
      0,
      calendarZone(timeZone)
    )
  );
}

/** The half-open range of moments `[start, end)` that make up one business day. */
export function businessDayRange(
  day: string | Date,
  timeZone: string | null | undefined
): { start: Date; end: Date } {
  const key = typeof day === 'string' ? day : dateKeyOf(day);
  return {
    start: businessDayStart(key, timeZone),
    end: businessDayStart(shiftDateKey(key, 1), timeZone),
  };
}

/**
 * One end of a report's range, as the business's calendar day.
 *
 * Callers send both kinds. A date-only value (`YYYY-MM-DD`, or exactly midnight
 * UTC, the form every date-only value in the platform travels in) is that date.
 * Any other moment (a "last 30 days" window anchored to now) is the day it fell
 * on for the business, so "now" is today in the shop rather than tomorrow in UTC.
 */
export function rangeDayKey(value: string | Date, timeZone: string | null | undefined): string {
  if (typeof value === 'string' && DATE_ONLY.test(value.trim())) return value.trim();
  const at = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(at.getTime())) throw new RangeError(`Not a date: ${String(value)}`);
  if (at.getTime() % MS_PER_DAY === 0) return dateKeyOf(at);
  return businessDateKey(at, timeZone);
}
