// What a diary block says, kept out of the .tsx so vitest can reach it.
// Lines follow height (issue 148); with nobody recorded it says who it is WITH,
// since a bare "Jordan" under a walk-in reads as the client's name.

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
