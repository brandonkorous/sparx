// The two questions asked before a booking ends badly, in ONE place.
//
// They were written twice: once on the booking pane and once in the diary's
// quick-look modal. Issue 112 named the money in the pane's pair and left the
// modal's still saying "any no-show fee in your booking rules is applied" —
// which is the hedge 112 exists to have removed. Two authors of one question is
// how a fix lands on half a product, so the question moved here and both
// surfaces read it.
//
// Pure strings: no JSX, no queries, no hook. The caller owns the dialog.

import { cancelMoney, noShowMoney } from './booking-money';
import type { BookingPolicy } from './setup-data';
import { bookingTypeLabel, bookingWhoLabel, formatWhen, type Booking } from './bookings-data';

/** What a confirm dialog needs to be asked. Mirrors `useConfirm`'s options. */
export interface Ask {
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel: string;
  color: 'danger';
}

/**
 * Who this booking is about, and whether telling them is even possible.
 *
 * `bookingWhoLabel` answers the first question with a placeholder when it has no
 * name ("A customer", "No one assigned"), and a placeholder inside a possessive
 * reads as a sentence written by a machine: "Cancel No one assigned's
 * appointment?". So those two collapse to null and the copy takes its other
 * branch.
 *
 * `reachable` is about an ACCOUNT, not a person: the engine's `reachableChannels`
 * returns nothing for a booking with no `customerId`, so a walk-in written down
 * by name is told nothing at all (issue 134). "Lets the customer know" over that
 * booking is a promise the software does not keep.
 */
export function bookingSubject(booking: Booking): { name: string | null; reachable: boolean } {
  const label = bookingWhoLabel(booking);
  const placeholder = label === 'A customer' || label === 'No one assigned';
  return { name: placeholder ? null : label, reachable: Boolean(booking.customerId) };
}

/** "Cut and finish, Thu, Aug 27, 2026, 4:00 PM." — the appointment itself, so
 *  the dialog still carries the time when nobody is named to carry it. */
function whatAndWhen(booking: Booking): string {
  return `${booking.service.name}, ${formatWhen(booking.startAt, booking.timezone)}.`;
}

/** What cancelling does about telling them, in the same three branches the
 *  booking's own notices section uses. */
export function cancelReach(booking: Booking): string {
  const { name, reachable } = bookingSubject(booking);
  if (reachable) return `${name ?? 'The customer'} is emailed to say it is off.`;
  if (name) {
    return `${name} is not told: this booking has no account attached, so give them a ring yourself.`;
  }
  return 'Nobody is told, because nobody is recorded on this booking.';
}

/**
 * The cancel question.
 *
 * The title carries the PERSON, because that is the fact she was holding when
 * she reached for the button and the only one that catches a mis-click. It read
 * "Cancel Cut and finish?" — six identical questions in a salon with six of them
 * booked, and the row she meant one line further down (issue 142).
 */
export function cancelAsk(booking: Booking, policy: BookingPolicy | undefined): Ask {
  const { name } = bookingSubject(booking);
  const kind = bookingTypeLabel(booking.bookingType).toLowerCase();
  return {
    title: name ? `Cancel ${name}'s ${kind}?` : `Cancel this ${kind}?`,
    description: `${whatAndWhen(booking)} This frees the slot for someone else. ${cancelReach(booking)} ${cancelMoney(booking, policy)} This cannot be undone.`,
    confirmLabel: 'Cancel this booking',
    cancelLabel: 'Keep it',
    color: 'danger',
  };
}

/** The no-show question. Nothing is sent for a no-show — the engine drops the
 *  booking's pending notices — so this one only names who and what it costs. */
export function noShowAsk(booking: Booking, policy: BookingPolicy | undefined): Ask {
  const { name } = bookingSubject(booking);
  const kind = bookingTypeLabel(booking.bookingType).toLowerCase();
  return {
    title: name ? `Mark ${name} as a no-show?` : `Mark this ${kind} as a no-show?`,
    description: `${whatAndWhen(booking)} This records that they did not turn up and frees the slot. ${noShowMoney(booking, policy)}`,
    confirmLabel: 'They did not turn up',
    cancelLabel: 'Back',
    color: 'danger',
  };
}
