'use client';

// TODAY, as the person reading the screen would say it.
//
// `new Date().toISOString().slice(0, 10)` looks like today and is not. It is the
// UTC calendar day, and the UTC calendar day is not today for most of the world
// for part of every day: in Los Angeles it turns over at five in the afternoon,
// in Sydney it is a day behind all morning. So a cost form that defaulted its
// date that way offered TOMORROW from teatime onwards, the quick row stamped
// tomorrow without showing anybody, and the list those costs returned to stops
// at today — so an evening's costs simply were not there. On the last day of a
// month they landed in the next month and stayed there, which takes money out
// of one month's figures and puts it in another's.
//
// `finance/period.ts` already had this right for the OTHER end of the same
// query: it builds its range from the local year, month and day. This is that
// one line, named, so that the two ends of a date range cannot disagree and
// nothing has to rediscover it a fourth time.
//
// The person's own device clock, deliberately, not the business's saved zone.
// The range this is compared against is built from the device clock too, and
// two ends of one query have to be read off one clock. Whether a trading day
// should belong to the shop's zone instead is a real question and a bigger one:
// it would have to move `period.ts`, the server's day buckets and the stored
// values together, and it cannot be half done.

const pad = (n: number): string => String(n).padStart(2, '0');

/** Any instant, as the calendar day it falls on WHERE THE READER IS. */
export function dayIso(at: Date): string {
  return `${String(at.getFullYear())}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}`;
}

/** The reader's own calendar day, as `YYYY-MM-DD`. */
export function todayIso(now: Date = new Date()): string {
  return dayIso(now);
}

/**
 * A calendar day as the instant the server keeps it at: midnight UTC.
 *
 * Day-valued columns are stored this way so a day means the same day to
 * everybody who reads it. A LOCAL midnight would land on the day before for
 * anyone east of UTC and quietly move the cost's month.
 */
export function dayStartUtc(day: string): string {
  return new Date(`${day}T00:00:00.000Z`).toISOString();
}

/** Right now, as the day-valued instant the server stores. The two steps are
 *  separate on purpose: a form shows `todayIso` and saves `dayStartUtc`, and a
 *  row that has no field to show does both at once. */
export function todayStartUtc(now: Date = new Date()): string {
  return dayStartUtc(todayIso(now));
}
