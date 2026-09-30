'use client';

// A DAY SOMEBODY CHOSE, DRAWN AS THAT DAY. The rule, and why, is in
// `calendar-date-words.ts`; this is the element that carries it.

import { calendarDateText } from './calendar-date-words';

export { calendarDateText };

/**
 * A calendar day.
 *
 * `value` is `YYYY-MM-DD`. A longer ISO string is accepted and truncated, so a
 * column not yet converted on the server still draws the stored day rather than
 * the day before it.
 */
export function CalendarDate({ value, withYear = true }: { value: string; withYear?: boolean }) {
  const ymd = value.slice(0, 10);
  return <time dateTime={ymd}>{calendarDateText(ymd, withYear)}</time>;
}
