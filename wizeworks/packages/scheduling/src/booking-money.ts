// What a booking's money needs when the booking ends (docs/79 §9, sparx persona
// issue 087).
//
// A booking can end four ways: a no-show, a cancellation, a completion, and a
// cancellation as part of a repeating series. Each one can owe the card on it
// something: charge a fee from the hold, let the hold go, refund a deposit, keep
// it. Only the console's routes used to work that out, in api-rest, so a booking
// an AI assistant canceled, marked a no-show or completed, and every booking in
// a canceled series, kept the hold, never refunded an on-time deposit and never
// charged a fee.
//
// So the decision lives here, beside the booking it is about: each lifecycle
// function works it out INSIDE its own transaction, from the state the booking
// was in, and hands it back as `money`. The gateway half is
// `bookingPayments.settle` in @wizeworks/commerce, which every transport calls
// once the transaction has committed, the way a held wholesale order's card is
// settled (`heldOrderMoney` → `heldOrderPayments`). This package carries no
// payment gateway and must not: the decision is plain data so it can cross.
//
// Exactly once: the lifecycle function only decides on the transition itself.
// Completing a booking that is already complete, or marking a no-show twice,
// changes nothing and decides nothing, and a deposit that has already been
// settled (`refunded` / `forfeited`) has nothing left to decide.

import type { TxClient } from '@wizeworks/db';

import {
  computeLateCancelFee,
  computeNoShowFee,
  isLateCancellation,
  resolveDepositPlan,
  type DepositPolicyInput,
} from './deposits';

/** How the booking ended. A series cancellation is a `cancel` of each one. */
export type BookingEnding = 'no_show' | 'cancel' | 'complete';

/** What the card needs. */
export type BookingMoneyMove =
  /** A fee from the card hold: a no-show, or a cancellation inside the window. */
  | 'capture_fee'
  /** Let the card hold go. Nothing is charged. */
  | 'release_hold'
  /** A deposit or prepayment asked for and not yet paid: call the request off. */
  | 'call_off'
  /** A paid deposit or prepayment given back: a cancellation in good time. */
  | 'refund_deposit'
  /** A paid deposit or prepayment kept: a no-show or a late cancellation. */
  | 'keep_deposit';

/** One booking's money, decided. Plain data: it crosses to the gateway half. */
export interface BookingMoney {
  bookingId: string;
  ending: BookingEnding;
  move: BookingMoneyMove;
  /** The fee to charge, or what is held or was paid. */
  amountCents: number;
  /** The gateway's own id for the payment (a `pi_…`). */
  paymentRef: string;
  currency: string;
  customerId: string | null;
  serviceName: string;
  startAt: Date;
  timezone: string;
}

/** What the decision reads off one booking. */
export interface BookingMoneyFacts {
  bookingId: string;
  depositStatus: string | null;
  startAt: Date;
  timezone: string;
  customerId: string | null;
  serviceName: string;
  currency: string;
  priceCents: number;
  policy: DepositPolicyInput | null;
  /** The gateway's id for the payment, from our ledger row. */
  paymentRef: string | null;
  /** What our ledger says was held or charged, in cents. */
  paymentAmountCents: number | null;
}

export interface BookingMoneyOptions {
  /** Staff let the customer off the fee: a hold is let go and a paid deposit
   *  refunded, whatever the rules say. */
  waiveFee?: boolean;
  now?: Date;
}

/**
 * The rules, as one pure decision:
 *   card hold:       a no-show or a late cancellation charges its fee from the
 *                    hold (never more than is held); anything else lets it go.
 *   deposit/prepay:  not paid yet, the request is called off; paid, it is kept
 *                    on a no-show or a late cancellation, given back on a
 *                    cancellation in good time, and kept on completion, where it
 *                    IS the payment (so there is nothing to do).
 * Null when there is nothing to settle: no rules, no payment, or a deposit that
 * has already been settled.
 */
export function decideBookingMoney(
  facts: BookingMoneyFacts,
  ending: BookingEnding,
  opts: BookingMoneyOptions = {}
): BookingMoney | null {
  const { policy, paymentRef } = facts;
  if (!policy || !paymentRef) return null;
  // Only a live hold or charge settles; refunded / forfeited / none are done.
  if (facts.depositStatus !== 'held' && facts.depositStatus !== 'captured') return null;

  const plan = resolveDepositPlan(policy, facts.priceCents);
  // What is really on the card is what our ledger recorded when it was asked
  // for. The rules may have changed since; the money has not.
  const onTheCard =
    facts.paymentAmountCents != null && facts.paymentAmountCents > 0
      ? facts.paymentAmountCents
      : plan.amountCents;
  const late =
    ending === 'no_show' ||
    (ending === 'cancel' && isLateCancellation(policy, facts.startAt, opts.now ?? new Date()));
  const money = (move: BookingMoneyMove, amountCents: number): BookingMoney => ({
    bookingId: facts.bookingId,
    ending,
    move,
    amountCents,
    paymentRef,
    currency: facts.currency,
    customerId: facts.customerId,
    serviceName: facts.serviceName,
    startAt: facts.startAt,
    timezone: facts.timezone,
  });

  if (plan.type === 'card_hold') {
    // A hold only settles from the authorized state; `captured` means a fee
    // has already been taken from it.
    if (facts.depositStatus !== 'held') return null;
    const fee =
      opts.waiveFee || ending === 'complete' || !late
        ? 0
        : ending === 'no_show'
          ? computeNoShowFee(policy, facts.priceCents)
          : computeLateCancelFee(policy, facts.priceCents);
    if (fee > 0) return money('capture_fee', Math.min(fee, onTheCard));
    return money('release_hold', onTheCard);
  }

  // A deposit or prepayment: a real charge, or one still waiting to be paid.
  if (ending === 'complete') return null;
  if (facts.depositStatus === 'held') return money('call_off', onTheCard);
  if (late && !opts.waiveFee) return money('keep_deposit', onTheCard);
  return money('refund_deposit', onTheCard);
}

const POLICY_SELECT = {
  depositType: true,
  depositAmountCents: true,
  depositPercent: true,
  cancellationWindowHours: true,
  lateCancelFeeType: true,
  lateCancelFeeValue: true,
  noShowFeeType: true,
  noShowFeeValue: true,
} as const;

/** Read the facts and decide, inside the lifecycle transaction. Called BEFORE
 *  the booking row is moved, so the deposit is read as it was. */
export async function bookingMoneyFor(
  tx: TxClient,
  bookingId: string,
  ending: BookingEnding,
  opts: BookingMoneyOptions = {}
): Promise<BookingMoney | null> {
  const booking = await tx.booking.findUnique({
    where: { id: bookingId },
    select: {
      depositStatus: true,
      startAt: true,
      timezone: true,
      customerId: true,
      paymentIntentId: true,
      service: { select: { name: true, priceCents: true, currency: true } },
      policy: { select: POLICY_SELECT },
    },
  });
  if (!booking?.policy || !booking.paymentIntentId) return null;
  if (booking.depositStatus !== 'held' && booking.depositStatus !== 'captured') return null;
  const intent = await tx.paymentIntent.findUnique({
    where: { id: booking.paymentIntentId },
    select: { externalId: true, amount: true },
  });
  return decideBookingMoney(
    {
      bookingId,
      depositStatus: booking.depositStatus,
      startAt: booking.startAt,
      timezone: booking.timezone,
      customerId: booking.customerId,
      serviceName: booking.service.name,
      currency: booking.service.currency,
      priceCents: booking.service.priceCents,
      policy: booking.policy,
      paymentRef: intent?.externalId ?? null,
      paymentAmountCents: intent?.amount ?? null,
    },
    ending,
    opts
  );
}
