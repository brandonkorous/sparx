// A CALENDAR DATE IS NOT A MOMENT.
//
// ── The defect this exists for ───────────────────────────────────────────────
//
// "Stock versus your books" records a balance against a DAY, and says so: "the
// balance of your inventory account, as your accounting system reports it.
// Recorded per date, so last year's reconciliation keeps saying what it said."
// The unique key on the table is `(tenant, as_of, account_name)`, so the day IS
// the row's identity.
//
// A balance recorded on 19 September, stored correctly as `2026-09-19`, came
// back down the wire as `2026-09-19T00:00:00.000Z` and rendered on screen as
// **Sep 18** — because the reader was in Los Angeles, seven hours behind UTC,
// and a `<Timestamp>` is for moments.
//
// The write half was wrong in the other direction. The picker sent
// `new Date(picked).toISOString()`, so a shop owner in London recording a
// balance at 00:30 filed it under yesterday, and one in Los Angeles recording
// one at 6pm filed it under tomorrow.
//
// MEASURED 2026-09-19: 32 `@db.Date` columns on the schema. Every one of them
// is a day somebody chose — a close date, a holiday, a shift worked, a
// certificate's expiry, a contract's effective-from — and every one of them
// shifts a day for half the world the moment it travels as an instant.
//
// ── The rule ─────────────────────────────────────────────────────────────────
//
// A date-only column travels as `YYYY-MM-DD` and nothing in between parses it
// into a local time. There is no zone in which "19 September" means a different
// day.

/** A `@db.Date` column, as the calendar day it is. */
export function calendarDate(value: Date): string {
  // `toISOString()` is UTC, which is exactly right HERE and wrong everywhere
  // else: Prisma hands back a `@db.Date` as midnight UTC on that day, so the
  // UTC calendar fields are the stored day and the local ones are not.
  return value.toISOString().slice(0, 10);
}

/** The same, for a column that may hold nothing. */
export function calendarDateOrNull(value: Date | null | undefined): string | null {
  return value === null || value === undefined ? null : calendarDate(value);
}

/** Midnight UTC on a `YYYY-MM-DD`, for STORING in a date-only column.
 *
 *  `new Date('2026-09-19')` already does this and `new Date('2026-09-19T00:00')`
 *  does not, which is the kind of difference nobody should have to remember at
 *  a call site. */
export function calendarDateToUtc(ymd: string): Date {
  return new Date(`${ymd}T00:00:00.000Z`);
}

/**
 * The END of a `YYYY-MM-DD`, for asking what was true AS AT that day.
 *
 * "As at 30 September" means the close of business on the 30th, not the instant
 * it began. Cutting at the start of the day silently drops everything that
 * happened on it, which on a reconciliation reads as a real discrepancy: the
 * day the figures were taken is the day the query throws away.
 *
 * UTC, because that is what a `@db.Date` column means and no tenant timezone is
 * stored to do better with. A business several hours ahead of UTC gets a few
 * hours of the next morning included; a start-of-day cut loses a whole working
 * day, every time, for everyone.
 */
export function calendarDayEndUtc(ymd: string): Date {
  return new Date(`${ymd}T23:59:59.999Z`);
}
