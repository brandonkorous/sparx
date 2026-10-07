// The status picker on the bookings list, and how it arrives from outside.
//
// Split out of `bookings-list.tsx` so it can be TESTED: that file is React, and
// the console's test seat is plain Node. The half worth guarding is the pairing
// with Home's "3 bookings need confirming", which counts `status=requested` and
// used to open the calendar — this week's grid, where a request for next month
// was not on screen and nothing picked the three out from the confirmed ones
// around them ([258]).

import type { BookingQuery, BookingStatus } from './bookings-data';

/**
 * What the status picker can hold: a status, any, or `still_open`, which is not a
 * status but a question. An appointment in the past still Confirmed or In
 * progress has happened and nobody closed it, and Money's By job counts only the
 * closed ones; it opens this list on them (persona issue 926).
 */
export type ListStatus = BookingStatus | '' | 'still_open';

export const STATUS_OPTIONS: { value: ListStatus; label: string }[] = [
  { value: '', label: 'Any status' },
  { value: 'requested', label: 'Awaiting confirmation' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Canceled' },
  { value: 'no_show', label: 'Did not turn up' },
  { value: 'still_open', label: 'Happened, still open' },
];

/**
 * `status` on the address — the same key a saved view stores it under and the
 * same value the picker sends — read once as the picker's starting value, so the
 * narrowing is on screen and one change turns it off. Anything unrecognised
 * means "no narrowing", never a guess.
 */
export function parseBookingStatus(raw: unknown): ListStatus {
  return STATUS_OPTIONS.find((option) => option.value !== '' && option.value === raw)?.value ?? '';
}

/** The list query a picker value means. `now` is fixed by the caller, so the
 *  question does not move under the list while it is open. */
export function statusQuery(
  status: ListStatus,
  now: string
): Pick<BookingQuery, 'status' | 'statusIn' | 'to'> {
  if (status === 'still_open')
    return { status: '', statusIn: ['confirmed', 'in_progress'], to: now };
  return { status };
}
