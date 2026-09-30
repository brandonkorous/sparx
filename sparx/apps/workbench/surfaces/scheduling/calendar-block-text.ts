// What a diary block SAYS, kept out of the .tsx so vitest can reach it.
//
// Two rules live here. How many lines a block draws follows from how tall it is
// (issue 148): three stacked lines on a half-hour block cut the words through
// their middles. And the person is the fact a block names; where nobody is
// recorded it says who the booking is WITH, in words, because a bare "Jordan
// Avery" under a walk-in reads as the customer's name, and in the day view it
// is the column heading too.

import type { CalendarEvent } from './calendar-data';

/** Who is coming, or who it is with when nobody is recorded. */
export function blockWho(
  event: Pick<CalendarEvent, 'customerName' | 'partySize' | 'resourceNames'>
): string | null {
  if (event.customerName) return event.customerName;
  if (event.partySize && event.partySize > 1) return `Party of ${String(event.partySize)}`;
  return event.resourceNames.length > 0 ? `With ${event.resourceNames.join(', ')}` : null;
}

/** Rows the block has room for: three from an hour up, two at three quarters,
 *  one at a half hour or less. */
export function linesFor(slots: number): 1 | 2 | 3 {
  if (slots >= 4) return 3;
  return slots === 3 ? 2 : 1;
}
