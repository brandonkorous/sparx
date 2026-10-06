// What happens to the money on a held wholesale order once it is decided
// (sparx persona issue 087).
//
// A trade order over a spending limit waits for sign-off before it is placed. A
// card order used to be CHARGED at checkout anyway, and when the order was
// turned down it was cancelled with the money kept: a buyer whose own company
// said no was out the money. Now the checkout holds the card instead, where the
// gateway can (`capabilities.capture` in @wizeworks/payments), and this decides
// what each card payment on the order needs when the last word is said:
//
//   approved     a held card is charged (capture). A card already charged, or
//                one the gateway is still settling, needs nothing.
//   turned down  a held card is let go (release). A card already charged is
//                refunded in full (refund). A charge still on its way, from a
//                gateway that could not hold, is marked to go straight back the
//                moment it lands.
//
// This file only DECIDES, inside the decision's own transaction. It never calls
// a gateway: that happens after the transaction commits, in the caller, so a
// refused capture can never roll back an approval that already happened, and a
// failed database write can never leave a card charged for an order that is not.
// The gateway work is `heldOrderPayments.settle` in @wizeworks/commerce.

import type { TxClient } from '@wizeworks/db';

/** Stamped on a card payment that holds the card rather than charging it, on
 *  the gateway's intent and on our `payment_intents` row, so the decision later
 *  knows the money is waiting to be captured. */
export const HELD_CARD_METADATA = { sparx_capture: 'manual' } as const;

/** Whether a stored intent was made to hold the card. */
export function isHeldCardIntent(metadata: unknown): boolean {
  return (
    typeof metadata === 'object' &&
    metadata !== null &&
    (metadata as Record<string, unknown>).sparx_capture === HELD_CARD_METADATA.sparx_capture
  );
}

/** Set on a card payment that was still settling when its order was turned
 *  down: when the charge lands, it goes straight back. */
export const REFUND_WHEN_PAID_KEY = 'refundWhenPaid';

/** Set on a held card the gateway refused to charge when the order was
 *  approved. The order has gone ahead, unpaid, and the buyer is asked to pay. */
export const CAPTURE_FAILED_KEY = 'signOffCaptureFailed';

/** One card payment on a held order, as the gateway work needs it. */
export interface HeldCardPayment {
  /** The `order_payments` row. */
  paymentId: string;
  orderId: string;
  orderNumber: string;
  customerId: string;
  /** The gateway id the payment was taken through. */
  processor: string;
  /** The gateway's own intent id. */
  paymentRef: string;
  /** How much: the whole hold for a capture or a release, and what is left on
   *  the charge for a refund. */
  amountCents: number;
  currency: string;
}

export type HeldOrderMoney =
  | ({ action: 'capture' } & HeldCardPayment)
  | ({ action: 'release' } & HeldCardPayment)
  | ({ action: 'refund' } & HeldCardPayment);

export type HeldOrderDecision = 'placed' | 'turned_down';

/** What one card payment needs. Pure, so the rule reads in one place. */
export function moneyFor(
  decision: HeldOrderDecision,
  payment: { status: string; held: boolean; refundableCents: number }
): HeldOrderMoney['action'] | 'refund_when_paid' | null {
  const open = payment.status === 'pending' || payment.status === 'authorized';
  if (decision === 'placed') return payment.held && open ? 'capture' : null;
  if (payment.status === 'captured') return payment.refundableCents > 0 ? 'refund' : null;
  if (open) return payment.held ? 'release' : 'refund_when_paid';
  return null;
}

/**
 * Work out, inside the decision's transaction, what the money on this order
 * needs now that it has been `decision`. Returns the gateway work for the
 * caller to do once the transaction commits. A charge still settling on an
 * order turned down is marked here, in the same transaction, to be refunded
 * when it lands; it needs no gateway call now.
 *
 * Only payments taken through a gateway count: they are the ones with an intent
 * of ours. Money recorded by hand is the business's to hand back.
 */
export async function heldOrderMoney(
  tx: TxClient,
  order: { id: string; orderNumber: string; customerId: string },
  decision: HeldOrderDecision
): Promise<HeldOrderMoney[]> {
  const payments = await tx.orderPayment.findMany({
    where: {
      orderId: order.id,
      processorRef: { not: null },
      status: { in: ['pending', 'authorized', 'captured'] },
    },
    select: {
      id: true,
      processor: true,
      processorRef: true,
      status: true,
      amount: true,
      currency: true,
      metadata: true,
      refunds: { where: { status: 'completed' }, select: { amount: true } },
    },
    orderBy: { createdAt: 'asc' },
  });

  const moves: HeldOrderMoney[] = [];
  for (const payment of payments) {
    const paymentRef = payment.processorRef;
    if (!paymentRef) continue;
    const intent = await tx.paymentIntent.findFirst({
      where: { externalId: paymentRef },
      select: { metadata: true },
    });
    if (!intent) continue;

    const amountCents = Math.round(Number(payment.amount) * 100);
    const refundedCents = payment.refunds.reduce(
      (sum, refund) => sum + Math.round(Number(refund.amount) * 100),
      0
    );
    const action = moneyFor(decision, {
      status: payment.status,
      held: isHeldCardIntent(intent.metadata),
      refundableCents: amountCents - refundedCents,
    });
    if (action === null) continue;

    if (action === 'refund_when_paid') {
      await tx.orderPayment.update({
        where: { id: payment.id },
        data: {
          metadata: {
            ...(typeof payment.metadata === 'object' && payment.metadata !== null
              ? (payment.metadata as Record<string, unknown>)
              : {}),
            [REFUND_WHEN_PAID_KEY]: true,
          },
        },
      });
      continue;
    }

    moves.push({
      action,
      paymentId: payment.id,
      orderId: order.id,
      orderNumber: order.orderNumber,
      customerId: order.customerId,
      processor: payment.processor,
      paymentRef,
      amountCents: action === 'refund' ? amountCents - refundedCents : amountCents,
      currency: payment.currency,
    });
  }
  return moves;
}

/**
 * Whether this order went ahead after sign-off without its held card being
 * charged, so the buyer still has to pay for it: the hold ran out, or the bank
 * said no when it was approved. The buyer's order page asks them to pay when it
 * is true. False once anything has been paid, or the order is no longer going
 * ahead.
 */
export async function approvedButNotCharged(
  tx: TxClient,
  order: { id: string; status: string; paymentStatus: string }
): Promise<boolean> {
  if (order.paymentStatus !== 'unpaid') return false;
  if (['pending_approval', 'cancelled', 'refunded'].includes(order.status)) return false;
  const failed = await tx.orderPayment.findMany({
    where: { orderId: order.id, status: 'failed' },
    select: { metadata: true },
  });
  return failed.some(
    (payment) =>
      typeof payment.metadata === 'object' &&
      payment.metadata !== null &&
      (payment.metadata as Record<string, unknown>)[CAPTURE_FAILED_KEY] === true
  );
}
