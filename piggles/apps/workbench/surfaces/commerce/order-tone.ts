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
      // This branch had no collected form while the two on either side of it did,
      // so a collect order that had been picked and packed read "On the way" —
      // about a parcel sitting on the shop’s own counter. Nothing had gone
      // anywhere, there was no carrier, and an owner reading it would have told a
      // customer their order was in transit. Every branch that can be reached by
      // a collection now says which of the two it is.
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
    case 'refunded': {
      // "Refunded" is a MONEY word, and it was the whole answer this column
      // gave to its own question, which is: have the goods gone?
      //
      // On Juniper Row's list it sat in the Delivery column next to an
      // identical "Refunded" in the Payment column, so one of the two told her
      // nothing. And the two cases need opposite things from her: goods that
      // went out are with a customer who has had their money back, and goods
      // that never went are still on her shelf.
      //
      // Measured 2026-09-17: 9 refunded orders on the platform, 8 of which
      // never shipped at all — and `fulfilledAt` agreed with the shipment
      // records on every one of the 9. The fact was already on the row
      // ([[feedback_fetched_but_never_rendered]]).
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

/**
 * Has it been paid for? Money truth is its own axis — an order can be paid and
 * unsent, or sent and unpaid, and both are situations someone acts on.
 *
 * TAKES THE MONEY, NOT JUST THE WORD. `order.paymentStatus` is derived from
 * `amountPaid`, which is captured MINUS refunded, so an order paid in full and
 * then part refunded falls below its total and is stored as `partially_paid`:
 *
 *     O-000005   total $147.00   captured $147.00   refunded $42.00
 *                stored: partially_paid
 *                shown:  "Part paid — some of this order has been paid for,
 *                         and some is still owed"
 *
 * Nothing is owed. The customer paid every penny and had $42.00 back. That
 * sentence tells a shop owner to go and chase a debt that does not exist, which
 * is the same harm as issue 533 and the same shape as issue 532 one level down.
 * Measured 2026-09-16: 2 of the 3 `partially_paid` orders on the platform, on 2
 * different shops, were paid in full and part refunded.
 *
 * The public account endpoint already worked around this for the SHOPPER'S view
 * (issue 292, "which reads as a debt rather than as money returned") by sending
 * the amounts. The console kept reading the word (persona issue 543).
 */
export function paymentState(order: Order): { label: string; tone: Tone; detail: string } {
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
