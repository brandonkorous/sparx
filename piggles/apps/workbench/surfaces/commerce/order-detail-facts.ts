'use client';

// Everything the order pane derives from a loaded order, worked out once.
//
// Kept out of the markup because several of these decide whether a CONTROL is
// offered at all, and a rule that governs a button belongs beside the other
// rules rather than inside the JSX that draws it.

import { refundWords, type RefundWords } from './refund-words';
import type { useOrderPayments } from './data';
import {
  amountDue,
  deliveryPlan,
  formatMoney,
  paidByHand,
  paymentState,
  shippingState,
  type Order,
} from './data';
import type { DeliveryPlan } from './order-types';
import type { Tone } from './order-tone';

export interface OrderFacts {
  paid: { label: string; tone: Tone; detail: string };
  shipped: { label: string; tone: Tone; detail: string };
  due: number;
  /** Refused by the server on an order that has already arrived or been
   *  refunded, so the control simply is not offered there. */
  cancellable: boolean;
  /** The warehouse still has something to fetch. Same test the pick-list
   *  generator applies server-side, so the button and the endpoint agree. */
  stillToFulfil: boolean;
  /** How this order leaves, as the shopper chose it. Everything about the
   *  bottom half of the pane turns on it: somebody collecting has no carrier,
   *  no tracking number, and no warehouse walk that means anything. */
  plan: DeliveryPlan;
  /** Money the shop is still holding. Rounded to cents so floating-point noise
   *  cannot offer a $0.0000001 refund. */
  refundableAmount: number;
  /** One source for all three sentences about this refund. */
  refundSays: RefundWords;
}

export function orderFacts(
  order: Order,
  payments: ReturnType<typeof useOrderPayments>
): OrderFacts {
  const items = order.items ?? [];
  const cancellable =
    order.status !== 'cancelled' && order.status !== 'delivered' && order.status !== 'refunded';

  // `amountPaid` IS the money still held: the server writes it as captured minus
  // refunded. Taking `refundTotal` off again subtracted every earlier refund a
  // second time, so an order holding $128.00 of a customer's money offered
  // $86.00 — and after that went through the row hid itself, leaving $42.00 of
  // hers with the shop and no control to give it back (issue 303).
  const refundableAmount = Math.max(0, Math.round(Number(order.amountPaid) * 100) / 100);

  // Whether a refund has anywhere to go. Money the business took by hand never
  // passed through a gateway, so "back to the card it was paid with" is a
  // promise about a card that does not exist — she hands the notes back.
  const toACard = !(payments.data ?? []).some((payment) => paidByHand(payment.processor));

  return {
    paid: paymentState(order),
    shipped: shippingState(order),
    due: amountDue(order),
    cancellable,
    stillToFulfil: cancellable && items.some((item) => item.quantity - item.quantityFulfilled > 0),
    plan: deliveryPlan(order),
    refundableAmount,
    refundSays: refundWords({
      amount: formatMoney(refundableAmount, order.currency),
      orderNumber: order.orderNumber,
      toACard,
    }),
  };
}
