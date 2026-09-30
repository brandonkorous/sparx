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
 * What to tell someone whose date box holds something that is not a date.
 *
 * One sentence, one place, because every date field in the console can reach it
 * and they must not each invent their own wording. It names the actual mistake:
 * the year box takes six digits, so this is almost always a year.
 */
export const NOT_A_DATE = 'That is not a date. A year is four digits, like 2026.';

/**
 * What to tell someone whose date box is half filled in.
 *
 * A native date box is THREE cells, and it reports a value only when all three
 * hold something. Type "03" and "31" and stop, and `value` is the empty string
 * while the box on screen still shows what was typed — so a form reads "no date
 * given", saves without one, and the person watches their own typing be
 * ignored. The browser knows: `validity.badInput` is true. Nothing in either
 * console was asking. [[feedback_the_empty_control_is_the_untested_one]]
 *
 * Measured 2026-09-19: 82 `<Input type="date">` call sites across the two
 * consoles, 0 reading `badInput`. Issue 741.
 */
export const HALF_A_DAY = 'That date is not finished. Fill in the day, the month and the year.';

/**
 * What a date box is really holding, said in one sentence or not at all.
 *
 * `null` means the box is fine — empty, or a real day. `value` is what the
 * control reports and `badInput` is what it refuses to put there, so the two
 * together are the whole truth about the box and neither alone is.
 */
export function dayBoxProblem(value: string, badInput: boolean): string | null {
  if (badInput) return HALF_A_DAY;
  return badDayIn(value);
}

const atMidnightUtc = (day: string): string => `${day}T00:00:00.000Z`;

/**
 * Every date box a save is about to send, checked in one go. `null` when they
 * are all fine, otherwise the one sentence to show.
 *
 * An empty box is fine here — "required" is a different question, asked by the
 * form. This only catches a box holding something that is not a date, which the
 * control allows and which used to reach `new Date` and throw. A surface with a
 * field slot should say it under the field instead; this is for the ones whose
 * other refusals are already a toast.
 */
export function badDayIn(...values: (string | null | undefined)[]): string | null {
  const bad = values.some(
    (value) => value !== null && value !== undefined && value !== '' && dayStartUtc(value) === null
  );
  return bad ? NOT_A_DATE : null;
}

/**
 * A calendar day as the instant the server keeps it at: midnight UTC. `null`
 * when the string is not a real calendar day.
 *
 * Day-valued columns are stored this way so a day means the same day to
 * everybody who reads it. A LOCAL midnight would land on the day before for
 * anyone east of UTC and quietly move the cost's month.
 *
 * IT RETURNS NULL RATHER THAN THROWING, because the string it is given almost
 * always comes from an `<input type="date">`, and that control does not promise
 * a real date. Chrome's year box accepts SIX digits, so one slip on the year
 * hands you "20266-09-01"; `new Date` makes an Invalid Date of that and
 * `toISOString` raises `RangeError: Invalid time value`. In the cost editor the
 * call sat inside a render-time `useMemo`, so a mistyped year did not fail a
 * save, it replaced the whole pane with "This panel ran into a problem" and took
 * the unsaved edit with it. A total function is the only version of this that is
 * safe to hand a form value.
 *
 * `2026-02-30` is rejected too. `new Date` accepts it and rolls it to March 2,
 * and returning a day nobody typed is the same class of lie.
 */
export function dayStartUtc(day: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return null;
  const at = new Date(atMidnightUtc(day));
  if (Number.isNaN(at.getTime())) return null;
  return at.toISOString().slice(0, 10) === day ? atMidnightUtc(day) : null;
}

/**
 * The same day, at the LAST second of it in UTC. `null` on anything that is not
 * a day, for the reason `dayStartUtc` gives.
 *
 * A "valid to" date is inclusive: a price list that runs to the 30th runs all of
 * the 30th. Midnight would end it 24 hours early.
 */
export function dayEndUtc(day: string): string | null {
  return dayStartUtc(day) === null ? null : `${day}T23:59:59.000Z`;
}

/**
 * A day at MIDDAY UTC. `null` on anything that is not a day.
 *
 * Invoicing stores a due date this way rather than at midnight, because midnight
 * UTC lands on the day before for anyone west of Greenwich, so the invoice would
 * read as due a day early for them and go late a day early with it. Midday is
 * the same calendar day in every zone anybody uses.
 */
export function dayMiddayUtc(day: string): string | null {
  return dayStartUtc(day) === null ? null : `${day}T12:00:00.000Z`;
}

/**
 * A day at LOCAL midnight, as an instant. `null` on anything that is not a day.
 *
 * Deliberately different from `dayStartUtc`, and both are right for different
 * columns. A cost belongs to a calendar day wherever you read it, so it is
 * stored in UTC. A person's time off starts when their morning starts, so it is
 * stored at their own midnight. Never swap one for the other to make a type fit.
 */
export function dayStartLocal(day: string): string | null {
  return instant(day, `${day}T00:00:00`);
}

/** A day at the last second of it, locally. See `dayStartLocal`. */
export function dayEndLocal(day: string): string | null {
  return instant(day, `${day}T23:59:59`);
}

/**
 * A day and a `HH:MM` clock time, read in the reader's own zone, as an instant.
 * `null` when either half is not what it claims to be — a shift form has two
 * boxes and both of them are typed into.
 */
export function dayTimeLocal(day: string, time: string): string | null {
  if (!/^\d{2}:\d{2}$/.test(time)) return null;
  return instant(day, `${day}T${time}:00`);
}

/**
 * A `<input type="datetime-local">` value (`2026-09-01T14:30`) as an instant,
 * read in the reader's own zone. `null` when the box holds something else.
 *
 * NOT `dayStartUtc`: this control's value carries a clock time, so it is a
 * different shape and a different meaning. Handing one to the other returns null
 * for every value, which is how a working field becomes a field that saves
 * nothing at all.
 */
export function localMomentInstant(value: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(value)) return null;
  const at = new Date(value);
  return Number.isNaN(at.getTime()) ? null : at.toISOString();
}

/** Shared tail: the day has to be a day, and whatever we built from it has to be
 *  a real instant. Local strings cannot be assembled by hand the way the UTC ones
 *  can, because only the engine knows the zone offset on that date. */
function instant(day: string, literal: string): string | null {
  if (dayStartUtc(day) === null) return null;
  const at = new Date(literal);
  return Number.isNaN(at.getTime()) ? null : at.toISOString();
}

/**
 * A DAY the person picked in a date control, stored the way a day is stored.
 *
 * `DateInput` hands back a `Date` at LOCAL midnight, and `toISOString()` on that
 * is the local day pushed into UTC: `07:00Z` in Los Angeles, and the PREVIOUS
 * day at `23:00Z` in Berlin. Stored that way a day is only that day to a reader
 * in the same zone as whoever typed it. MEASURED 2026-09-18: a buyer typed
 * September 10 into a purchase order, saved it, and the order read "September 9,
 * 2026" straight back at her, because the two ends disagreed — one writer stored
 * UTC midnight, the other local midnight, and the formatter rendered locally.
 *
 * Read it back with `dayFromStored`, and PRINT it with a formatter that passes
 * `timeZone: 'UTC'`. (`dayMiddayUtc` above is the other house answer to the same
 * problem, and invoicing uses it: it survives a reader who prints locally. This
 * one is for the columns whose readers all print in UTC, which is every day-
 * valued field finance and Buying show.)
 */
export function pickedDayUtc(at: Date | null | undefined): string | null {
  if (!at || Number.isNaN(at.getTime())) return null;
  return dayStartUtc(dayIso(at));
}

/**
 * A stored day, as a `Date` a date control can show.
 *
 * `new Date(stored)` is the instant, so a day stored at UTC midnight lands on
 * the previous EVENING for every reader west of Greenwich and the control offers
 * the day before the one that was typed. Take the UTC calendar day and rebuild
 * it on the reader's own clock, which is the only thing a date control can hold.
 */
export function dayFromStored(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return null;
  return new Date(at.getUTCFullYear(), at.getUTCMonth(), at.getUTCDate());
}

/** Right now, as the day-valued instant the server stores. The two steps are
 *  separate on purpose: a form shows `todayIso` and saves `dayStartUtc`, and a
 *  row that has no field to show does both at once. Builds the string directly
 *  rather than going through `dayStartUtc`, because a day this function minted
 *  itself is never in doubt and the caller should not have to handle a null that
 *  cannot happen. */
export function todayStartUtc(now: Date = new Date()): string {
  return atMidnightUtc(todayIso(now));
}
