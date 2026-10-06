// Where the money stands on one booking (sparx persona issue 087).
//
// The booking record carried `depositStatus` and rendered nothing about it, so
// a no-show fee the card refused, or a deposit that was never refunded, could
// only be found on the customer's timeline. The line under the booking now says
// what the card was asked to do when the booking ended and whether it did, from
// the booking's own record, and warns when somebody has to act. The same words
// as the other console (piggles booking-money.ts). Pure functions: no queries,
// no JSX.

import { formatDay, formatMoney, type Booking, type BookingPayment } from './bookings-data';
import type { BookingPolicy } from './setup-data';

/** A fee from a {type, value} pair: `fixed` is cents, `percent` is a whole
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

/** A hold on a card lasts about this long before the bank lets it go. */
const HOLD_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

/** What is on the card for this policy, the way the server works it out at
 *  booking time (`resolveDepositPlan`): a hold covers the biggest fee or the
 *  deposit, a deposit is its amount, a prepayment is the whole price. */
function upFrontCents(policy: BookingPolicy, priceCents: number): number {
  switch (policy.depositType) {
    case 'card_hold':
      return Math.max(
        fee(policy.noShowFeeType, policy.noShowFeeValue, priceCents),
        fee(policy.lateCancelFeeType, policy.lateCancelFeeValue, priceCents),
        depositCents(policy, priceCents)
      );
    case 'deposit':
      return depositCents(policy, priceCents);
    case 'prepay':
      return Math.max(0, Math.round(priceCents));
    default:
      return 0;
  }
}

/** The money line on a booking: one plain sentence, or a problem somebody on
 *  the team has to deal with, which the screen shows as a warning. */
export type MoneyLine =
  { kind: 'line'; text: string } | { kind: 'problem'; title: string; detail: string };

const line = (text: string): MoneyLine => ({ kind: 'line', text });
const problem = (title: string, detail: string): MoneyLine => ({ kind: 'problem', title, detail });

const ENDED = new Set(['cancelled', 'no_show', 'completed']);

function feeName(ending: BookingPayment['ending']): string {
  return ending === 'no_show' ? 'no-show fee' : 'late-cancellation fee';
}

/** Gateways end their own sentences; the copy ends them again. */
function because(reason: string | null): string {
  const why = reason?.replace(/[.\s]+$/, '').trim();
  return why ? `It did not go through: ${why}.` : 'It did not go through.';
}

/** What the card was asked to do when the booking ended, and whether it did. */
function settledLine(payment: BookingPayment): MoneyLine {
  const money = formatMoney(payment.amountCents, payment.currency);
  if (payment.done) {
    switch (payment.move) {
      case 'capture_fee':
        return line(`A ${money} ${feeName(payment.ending)} was charged to their card.`);
      case 'release_hold':
        return line('Nothing was charged. The hold on their card was let go.');
      case 'call_off':
        return line(`Nothing was charged. The ${money} deposit they had not paid was called off.`);
      case 'refund_deposit':
        return line(`Their ${money} deposit was refunded.`);
      case 'keep_deposit':
        return line(
          `Their ${money} deposit was kept, as your booking rules say for a ${payment.ending === 'no_show' ? 'no-show' : 'late cancellation'}.`
        );
    }
  }
  switch (payment.move) {
    case 'capture_fee':
      return problem(
        `The ${money} ${feeName(payment.ending)} was not charged`,
        `${because(payment.reason)} Nothing was charged to their card, and the hold on it may have run out. Ask them for the money, or let it go.`
      );
    case 'release_hold':
      // Nobody is out any money, and nobody has to do anything.
      return line(
        `Nothing was charged, but the ${money} hold on their card could not be let go straight away. It drops off their card by itself within about ${String(HOLD_DAYS)} days.`
      );
    case 'call_off':
      return problem(
        `The ${money} deposit request is still open`,
        `The booking was canceled before they paid it, and the request could not be called off. ${because(payment.reason)} If they pay it, refund it from your payment provider's own dashboard.`
      );
    case 'refund_deposit':
    case 'keep_deposit':
      return problem(
        `Their ${money} deposit was not refunded`,
        `${because(payment.reason)} Nothing has been given back yet. Refund it from your payment provider's own dashboard.`
      );
  }
}

/**
 * Where the money stands on a booking: the line the booking shows.
 *
 * It used to read the deposit status alone, so a no-show whose fee the card
 * refused still said "$40.00 is held on their card" over a hold that may have
 * lapsed and a fee nobody collected (sparx persona issue 087). When the booking
 * ended, what the card was asked to do and whether it did is on the record, and
 * that is what this says first. Before that, the deposit status is read for
 * what it is: a hold placed more than a week ago has probably dropped off, and
 * a deposit asked for is not a deposit paid.
 */
export function depositLine(
  booking: Booking,
  policy: BookingPolicy | undefined,
  now: number = Date.now()
): MoneyLine {
  if (booking.payment) return settledLine(booking.payment);

  const kind = policy?.depositType;
  const cents = policy ? upFrontCents(policy, booking.service.priceCents) : 0;
  const money = cents > 0 ? amount(booking, cents) : null;
  const ended = ENDED.has(booking.status);
  const hold = kind === 'card_hold';

  switch (booking.depositStatus) {
    case 'held': {
      if (hold) {
        if (ended) {
          return line(
            `Nothing was charged when this booking ended. The hold on their card drops off by itself within about ${String(HOLD_DAYS)} days of when they booked.`
          );
        }
        const heldFor = now - new Date(booking.createdAt).getTime();
        if (heldFor > HOLD_DAYS * DAY_MS) {
          return line(
            `${money ? `A ${money} hold` : 'A hold'} was put on their card when they booked on ${formatDay(booking.createdAt, booking.timezone)}. A hold only lasts about ${String(HOLD_DAYS)} days, so it has probably dropped off, and a no-show or late-cancellation fee may not go through.`
          );
        }
        return line(
          `${money ? `${money} is held` : 'A hold is'} on their card. Nothing has been charged.`
        );
      }
      if (kind === 'deposit' || kind === 'prepay') {
        const what = kind === 'deposit' ? 'deposit' : 'payment up front';
        return ended
          ? line(`The ${money ? `${money} ` : ''}${what} was never paid.`)
          : line(
              `They have been asked for a ${money ? `${money} ` : ''}${what} and have not paid it yet.`
            );
      }
      return line('A payment on their card has not been settled yet.');
    }
    case 'captured':
      if (hold) return line('A fee was charged to their card.');
      if (booking.status === 'cancelled') {
        return line(
          money
            ? `The ${money} they paid up front has not been given back.`
            : 'What they paid up front has not been given back.'
        );
      }
      return line(money ? `${money} was paid up front.` : 'They paid up front.');
    case 'forfeited':
      return line(
        money ? `The ${money} they paid up front was kept.` : 'What they paid up front was kept.'
      );
    case 'refunded':
      return hold
        ? line('Nothing was charged. The hold on their card was let go.')
        : line('Nothing is kept: the deposit was given back, or called off before it was paid.');
    default:
      return line('Nothing was paid up front for this booking.');
  }
}
