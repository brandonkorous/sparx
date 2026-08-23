// What has actually happened to the money on one booking (issue 112).
//
// The two actions that can cost a customer money — a no-show and a cancellation
// — said a fee "is applied" and then reported nothing. `depositStatus` was on
// the booking all along and rendered nowhere. Pure functions: no queries, no JSX.

import { formatMoney, type Booking } from './bookings-data';
import type { BookingPolicy } from './setup-data';

/** A fee from a {type, value} pair — `fixed` is cents, `percent` is a whole
 *  percent of the price. Mirrors the server's `computeFee`. */
function fee(type: string | null, value: number | null, priceCents: number): number {
  if (value == null || value <= 0) return 0;
  if (type === 'fixed') return Math.round(value);
  if (type === 'percent') return Math.max(0, Math.round((priceCents * value) / 100));
  return 0;
}

function depositCents(policy: BookingPolicy, priceCents: number): number {
  if (policy.depositAmountCents != null && policy.depositAmountCents > 0) {
    return Math.round(policy.depositAmountCents);
  }
  if (policy.depositPercent != null && policy.depositPercent > 0) {
    return Math.max(0, Math.round((priceCents * policy.depositPercent) / 100));
  }
  return 0;
}

function amount(booking: Booking, cents: number): string {
  return formatMoney(cents, booking.service.currency);
}

/** Where the money stands right now — the line the booking shows. Null while the
 *  policy is still loading, so a half-known answer is never printed. */
export function depositLine(booking: Booking, policy: BookingPolicy | undefined): string | null {
  const held = policy ? depositCents(policy, booking.service.priceCents) : 0;
  switch (booking.depositStatus) {
    case 'held':
      return held > 0
        ? `${amount(booking, held)} is held on their card.`
        : 'A hold is on their card.';
    case 'captured':
      return held > 0 ? `${amount(booking, held)} has been charged.` : 'The deposit was charged.';
    case 'forfeited':
      return held > 0 ? `${amount(booking, held)} was kept.` : 'The deposit was kept.';
    case 'refunded':
      return 'Anything held has been returned.';
    default:
      return 'Nothing was paid up front for this booking.';
  }
}

/** What marking a no-show will do about money — said before she commits, not
 *  hedged as "any fee in your rules". */
export function noShowMoney(booking: Booking, policy: BookingPolicy | undefined): string {
  if (!booking.depositStatus) {
    return 'Nothing was paid up front, so no money changes hands.';
  }
  const charge = policy
    ? fee(policy.noShowFeeType, policy.noShowFeeValue, booking.service.priceCents)
    : 0;
  if (charge > 0) return `${amount(booking, charge)} is kept from what they paid.`;
  return 'Your booking rules set no no-show fee, so anything held is returned.';
}

/** The same question for a cancellation, which turns on how much notice there
 *  was — a late cancellation is the one your rules can charge for. */
export function cancelMoney(booking: Booking, policy: BookingPolicy | undefined): string {
  if (!booking.depositStatus) {
    return 'Nothing was paid up front, so no money changes hands.';
  }
  const charge = policy
    ? fee(policy.lateCancelFeeType, policy.lateCancelFeeValue, booking.service.priceCents)
    : 0;
  if (charge === 0)
    return 'Your booking rules set no late-cancellation fee, so anything held is returned.';
  const hours = policy?.cancellationWindowHours ?? 0;
  return `Inside ${String(hours)} hours of the start, ${amount(booking, charge)} is kept; before that, anything held is returned.`;
}
