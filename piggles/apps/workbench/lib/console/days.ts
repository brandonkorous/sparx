// How many days late, counted the same way everywhere in the console.
//
// THE RULE: compare CALENDAR DAYS, never elapsed milliseconds.
//
// A due date is stored as an instant, and the hour on it is an accident of when
// the document was raised — noon for one invoice, 02:41 for the next. Subtract
// two instants and divide by 86,400,000 and that accident decides the answer: on
// one real shop, eight invoices all printed "Due Sep 8, 2026" and the screen
// called seven of them "9 days late" and the eighth "8 days late", because the
// eighth was raised at noon and only 8.6 of the 24-hour periods had gone by. The
// number a business owner reads was being set by a time she was never shown.
//
// So: the reader's LOCAL year/month/day for "today", and the stored UTC
// year/month/day for the due date. Local for today because "how late is this"
// is a question about her calendar, not the server's — at 9pm in Los Angeles the
// server has already turned over to tomorrow and she has not. UTC for the due
// date because `formatDay` PRINTS it in UTC, so the count and the printed date
// can never disagree.
//
// This rule was written twice before this file existed, once in the finance
// formatter and once in the AR service, each with a paragraph explaining the
// same bug — and invoicing, which never got either, still counted milliseconds.
// It lives here now so there is one copy to be right.

/** A calendar day as a day NUMBER, so two days can be compared without a clock
 *  dragging one of them across a midnight. */
export function dayNumber(value: Date, stored: boolean): number {
  const ms = stored
    ? Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate())
    : Date.UTC(value.getFullYear(), value.getMonth(), value.getDate());
  return Math.floor(ms / 86_400_000);
}

/**
 * Today, as a day number, in the business's own zone.
 *
 * Falls back to THIS computer's day when the business has not said where it is
 * (most have not) and when the zone is one `Intl` does not recognise, so a bad
 * value degrades rather than throwing inside a list.
 */
function todayIn(timeZone: string | null | undefined, now: Date): number {
  if (!timeZone) return dayNumber(now, false);
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(now);
    const part = (type: string): number =>
      Number(parts.find((p) => p.type === type)?.value ?? Number.NaN);
    const year = part('year');
    const month = part('month');
    const day = part('day');
    if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
      return dayNumber(now, false);
    }
    return Math.floor(Date.UTC(year, month - 1, day) / 86_400_000);
  } catch {
    return dayNumber(now, false);
  }
}

/**
 * Whole days past a due date — negative when it is still ahead, `null` when
 * nobody set one.
 *
 * Null is NOT zero: "no deadline" and "due today" are different facts, and
 * rendering the first as the second invents a deadline.
 *
 * `timeZone` is the BUSINESS's zone, from `useBusinessZone()`. Her books belong
 * to her shop, not to whichever airport she opened the console in, and the
 * server counts on the same zone — so passing it is what keeps a screen counted
 * here and a screen counted there saying the same number about the same invoice.
 * Without it this is the reader's own computer, which is the right guess and the
 * wrong guarantee.
 */
export function daysPastDue(
  dueAt: string | null | undefined,
  now = new Date(),
  timeZone?: string | null
): number | null {
  if (!dueAt) return null;
  return todayIn(timeZone, now) - dayNumber(new Date(dueAt), true);
}

/**
 * Whole days UNTIL a due date: the same count as `daysPastDue`, from the side
 * most screens ask from. Negative when it has already gone by, `null` when
 * nobody set one.
 *
 * It exists because the screens that ask "how long is left" had no shared way
 * to, so they reached for silica's `<Timestamp format="relative">` — which is
 * an ELAPSED-TIME reading on the reader's clock, and is the one thing this file
 * says never to do. A supplier invoice due on the 30th read (issue 885):
 *
 *     list    Due today    · September 30, 2026
 *     detail  15 hours ago · September 30, 2026
 *
 * at twenty past nine in the morning on the day it was due. `format="absolute"`
 * is no safer on a due date: it renders on the reader's clock too, so a day
 * stored at UTC midnight shows as the day BEFORE for everyone west of
 * Greenwich.
 */
export function daysUntilDue(
  dueAt: string | null | undefined,
  now = new Date(),
  timeZone?: string | null
): number | null {
  const past = daysPastDue(dueAt, now, timeZone);
  // `0 - past` rather than `-past`: negating zero gives NEGATIVE zero, which
  // equals zero but is not the same value, and a caller comparing with
  // `Object.is` or printing it would see a minus sign on a day that is today.
  return past === null ? null : 0 - past;
}
