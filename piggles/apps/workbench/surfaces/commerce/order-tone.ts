'use client';

// What a state MEANS, in a word and a color.
//
// An order carries two states, not one — has it been paid for, and has it been
// sent. They are independent columns because they genuinely are, so there are
// two state helpers rather than one status enum. Collapsing them loses the case
// an operator cares about most: paid but not yet sent.

import { deliveryPlan } from './order-types';
import type { Order } from './order-types';

export type Tone = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

/**
 * Has it been sent? In the words an owner would use.
 *
 * The stored values are `placed | fulfilled | delivered | cancelled | refunded`,
 * which is a developer's vocabulary — "fulfilled" in particular reads as
 * "finished" to everyone who has not worked in commerce, when it means the
 * opposite: it has just left the building.
 */
export function shippingState(order: Order): { label: string; tone: Tone; detail: string } {
  // Nobody delivered anything to a customer who walked in and took it. Same
  // column, same stored status, different fact — and this is the one place both
  // the list and the order pane read it from, so correcting it here corrects it
  // everywhere rather than in the two call sites that happened to notice.
  const collected = deliveryPlan(order).collected;
  switch (order.status) {
    case 'delivered':
      return {
        label: collected ? 'Collected' : 'Delivered',
        tone: 'success',
        detail: collected ? 'The customer picked this up.' : 'This order reached the customer.',
      };
    case 'fulfilled':
      return {
        label: 'On the way',
        tone: 'info',
        detail: 'This order has been sent and is with the carrier.',
      };
    case 'cancelled':
      return {
        label: 'Cancelled',
        tone: 'danger',
        detail: order.cancelledReason
          ? `This order was cancelled: ${order.cancelledReason}`
          : 'This order was cancelled and nothing more will be sent.',
      };
    case 'refunded':
      return {
        label: 'Refunded',
        tone: 'neutral',
        detail: 'The customer has had their money back on this order.',
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

/** Has it been paid for? Money truth is its own axis — an order can be paid and
 *  unsent, or sent and unpaid, and both are situations someone acts on. */
export function paymentState(order: Order): { label: string; tone: Tone; detail: string } {
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
