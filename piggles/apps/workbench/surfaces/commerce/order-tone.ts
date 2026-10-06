'use client';

// What a state MEANS, in a word and a color. Paid and sent are independent
// columns, so two helpers rather than one enum: collapsing them loses the case
// an operator cares about most, paid but not yet sent.

import { deliveryPlan } from './order-types';
import type { Order } from './order-types';

export type Tone = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

// Has it been sent? In the owner's words: the stored "fulfilled" reads as
// "finished" to anyone outside commerce, when it means it just left the building.
export function shippingState(order: Order): { label: string; tone: Tone; detail: string } {
  // Nobody delivered anything to a customer who walked in and took it. The list
  // and the order pane both read it from here, so it is corrected once.
  const collected = deliveryPlan(order).collected;
  switch (order.status) {
    case 'delivered':
      return {
        label: collected ? 'Collected' : 'Delivered',
        tone: 'success',
        detail: collected ? 'The customer picked this up.' : 'This order reached the customer.',
      };
    case 'fulfilled':
      // A packed collect order read "On the way" about a parcel on the shop's own
      // counter. Every branch a collection can reach says which of the two it is.
      return {
        label: collected ? 'Ready to collect' : 'On the way',
        tone: 'info',
        detail: collected
          ? 'This order is packed and waiting for the customer to come and get it.'
          : 'This order has been sent and is with the carrier.',
      };
    case 'cancelled':
      return {
        label: 'Canceled',
        tone: 'danger',
        detail: order.cancelledReason
          ? `This order was canceled: ${order.cancelledReason}`
          : 'This order was canceled and nothing more will be sent.',
      };
    case 'refunded':
      return refundedShippingState(order, collected);
    // Held for sign-off: "To send" asked somebody to pack an unapproved order
    // (sparx persona issue 085). The account's own approvers may say yes on the
    // site (sparx persona issue 087), so Approvals is where to SEE who.
    case 'pending_approval':
      return {
        label: 'Not to send yet',
        tone: 'info',
        detail: 'Nothing goes out until this order is approved. Approvals shows who it waits on.',
      };
    default:
      return {
        label: collected ? 'To collect' : 'To send',
        tone: 'warning',
        detail: collected
          ? 'The customer has not picked this up yet.'
          : 'Nothing has been sent to the customer yet.',
      };
  }
}

/** Refunded: have the goods gone? Opposite things to do either way. */
function refundedShippingState(
  order: Order,
  collected: boolean
): { label: string; tone: Tone; detail: string } {
  // "Refunded" is a MONEY word and sat beside an identical one in Payment. 8 of
  // 9 refunded orders (2026-09-17) never shipped; `fulfilledAt` says which.
  const went = order.fulfilledAt !== null;
  if (!went) {
    return {
      label: collected ? 'Never collected' : 'Never sent',
      tone: 'neutral',
      detail: collected
        ? 'The money has gone back and the customer never came for this, so it is still yours.'
        : 'The money has gone back and nothing was ever sent, so it is still on your shelf.',
    };
  }
  return {
    label: collected ? 'Collected, then refunded' : 'Sent, then refunded',
    tone: 'warning',
    detail: collected
      ? 'The customer took this away and has since had their money back.'
      : 'This went out before the money went back, so it is with the customer.',
  };
}

// Has it been paid for? Reads the money, not just the stored word: paid in full
// then part refunded is stored `partially_paid` (issues 533, 532, 292, persona issue 543).
export function paymentState(order: Order): { label: string; tone: Tone; detail: string } {
  return refundedPaymentState(order) ?? storedPaymentState(order);
}

/** Money that came back outranks the stored word; null when nothing went back. */
function refundedPaymentState(order: Order): { label: string; tone: Tone; detail: string } | null {
  // Every penny that went back was a core deposit, returned because the old part
  // came in. That is how a rebuilt-part sale is meant to end, and an amber "Part
  // refunded" on each one read as a problem (sparx persona issue 057).
  if (
    order.refundTotal > 0 &&
    order.depositsReturned >= order.refundTotal - 0.005 &&
    order.amountPaid + order.refundTotal >= order.total - 0.005
  ) {
    return {
      label: 'Paid, deposit back',
      tone: 'success',
      detail:
        'Paid in full. The core deposit went back when the old part came in. Nothing is owed.',
    };
  }
  // Money that came back outranks the stored word, because the word cannot know.
  if (order.paymentStatus === 'partially_paid' && order.refundTotal > 0) {
    const settled = order.amountPaid + order.refundTotal >= order.total;
    return settled
      ? {
          label: 'Part refunded',
          tone: 'warning',
          detail: 'Paid in full, and some of it has since gone back. Nothing is owed.',
        }
      : {
          label: 'Part paid, part back',
          tone: 'warning',
          detail: 'Some was paid and some of that has gone back. There is still an amount owed.',
        };
  }
  // Paid in full is stored as `paid` even after part of it goes back (a core
  // deposit refunded, a returned line): the word says the money came in, the
  // refund says some has left again.
  if (order.paymentStatus === 'paid' && order.refundTotal > 0) {
    return {
      label: 'Part refunded',
      tone: 'warning',
      detail: 'Paid in full, and some of it has since gone back. Nothing is owed.',
    };
  }
  return null;
}

/** The stored payment word, when no money has come back. */
function storedPaymentState(order: Order): { label: string; tone: Tone; detail: string } {
  switch (order.paymentStatus) {
    case 'paid':
      return { label: 'Paid', tone: 'success', detail: 'Paid in full.' };
    case 'partially_paid':
      return {
        label: 'Part paid',
        tone: 'info',
        detail: 'Some of this order has been paid for, and some is still owed.',
      };
    case 'refunded':
      return { label: 'Refunded', tone: 'neutral', detail: 'This money has been given back.' };
    default:
      return { label: 'Not paid', tone: 'warning', detail: 'No money has come in for this order.' };
  }
}

export function paymentRecordTone(status: string): Tone {
  switch (status) {
    case 'captured':
      return 'success';
    case 'authorized':
      return 'info';
    case 'failed':
      return 'danger';
    case 'voided':
    case 'refunded':
      return 'neutral';
    default:
      return 'warning'; // pending
  }
}

export function fulfillmentTone(status: string): Tone {
  switch (status) {
    case 'delivered':
      return 'success';
    case 'shipped':
      return 'info';
    case 'failed':
      return 'danger';
    case 'cancelled':
      return 'neutral';
    default:
      return 'warning'; // pending
  }
}

export function refundTone(status: string): Tone {
  switch (status) {
    case 'completed':
      return 'success';
    case 'failed':
      return 'danger';
    default:
      return 'warning';
  }
}
