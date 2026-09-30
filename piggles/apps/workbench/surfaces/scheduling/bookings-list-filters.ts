// The status picker on the bookings list, and how it arrives from outside.
//
// Split out of `bookings-list.tsx` so it can be TESTED: that file is React, and
// the console's test seat is plain Node. The half worth guarding is the pairing
// with Home's "3 bookings need confirming", which counts `status=requested` and
// used to open the calendar — this week's grid, where a request for next month
// was not on screen and nothing picked the three out from the confirmed ones
// around them ([258]).

import type { BookingStatus } from './bookings-data';

export const STATUS_OPTIONS: { value: BookingStatus | ''; label: string }[] = [
  { value: '', label: 'Any status' },
  { value: 'requested', label: 'Awaiting confirmation' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Canceled' },
  { value: 'no_show', label: 'Did not turn up' },
];

/**
 * `status` on the address — the same key a saved view stores it under and the
 * same value the picker sends — read once as the picker's starting value, so the
 * narrowing is on screen and one change turns it off. Anything unrecognised
 * means "no narrowing", never a guess.
 */
export function parseBookingStatus(raw: unknown): BookingStatus | '' {
  return STATUS_OPTIONS.find((option) => option.value !== '' && option.value === raw)?.value ?? '';
}
