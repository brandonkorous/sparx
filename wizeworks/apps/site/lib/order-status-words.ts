// An order's status in the shopper's words and colors, and where its payment
// sits in its story. Shared by the order lists, the order pages and the order
// timeline, so one order is never called, or colored, two things.

import type { SilicaColor } from '@wizeworks/silicaui-react';

import { termsDays } from './account-terms-words';
import { formatMoney } from './format';

/**
 * Semantic tone for an order status: the house status rule (`statusTone` in
 * `@wizeworks/ui`), where info is in motion, success is done and good, warning
 * is waiting and danger is a failure.
 *
 * "Placed" was the theme's primary. On a shop whose brand color is red, every
 * healthy order on a wholesale account read as a problem (sparx persona issue
 * 087). Primary is the color of the action a page exists for, never a state.
 */
export function orderStatusTone(status: string): SilicaColor {
  switch (status) {
    case 'delivered':
    case 'fulfilled':
      return 'success';
    case 'cancelled':
      return 'danger';
    case 'refunded':
      return 'warning';
    // Waiting on someone else's yes, not on her: a trade order over a spending
    // limit or the account's credit (sparx persona issues 085, 087).
    case 'pending_approval':
      return 'warning';
    default:
      return 'info';
  }
}

/** The status in the SHOPPER's words, shared by the order list and the order
 *  detail so the two can never call one fact two things. `fulfilled` is the
 *  warehouse's word for it; she is waiting on a parcel (issue 295). */
export function orderStatusLabel(status: string): string {
  switch (status) {
    case 'placed':
      return 'Placed';
    case 'fulfilled':
      return 'On its way';
    case 'delivered':
      return 'Delivered';
    case 'cancelled':
      return 'Canceled';
    case 'refunded':
      return 'Refunded';
    // The status code read aloud was "Pending approval". A list row carries no
    // sign-off, so the badge says what is happening; the order page names who
    // it is waiting on, at her own account or the business (persona issue 087).
    case 'pending_approval':
      return 'Waiting for approval';
    default:
      return status.charAt(0).toUpperCase() + status.slice(1).replace(/_/g, ' ');
  }
}

/** The word before an order's date in its header. An order that was turned
 *  down while it waited for approval, or is still waiting, was never placed:
 *  "Placed October 3 by Renée" was printed over an order canceled before it
 *  went ahead (sparx persona issue 087). "Ordered" is true of every order. */
export function orderedWord(status: string): 'Placed' | 'Ordered' {
  return status === 'pending_approval' || status === 'cancelled' ? 'Ordered' : 'Placed';
}

export interface OrderPaymentFacts {
  paymentStatus: string;
  paidAt: string | null;
  fulfilledAt: string | null;
}

/**
 * Whether the payment belongs straight after the order in its timeline, as it
 * does for a card paid at checkout, or after the goods, as it does for an order
 * paid later: on account terms, against an invoice, or by hand.
 *
 * Renée's order on 30-day terms read "Payment confirmed" as its third step, the
 * next thing to happen, ahead of "On its way". It is paid after it ships, so
 * that step was false (sparx persona issue 087). An order that is paid comes
 * first unless the money arrived after it shipped; an order not paid yet puts
 * its payment last, as what is still to come.
 */
export function paymentComesFirst(order: OrderPaymentFacts): boolean {
  const paid = order.paidAt !== null || order.paymentStatus === 'paid';
  if (!paid) return false;
  if (order.paidAt === null || order.fulfilledAt === null) return true;
  return new Date(order.paidAt).getTime() <= new Date(order.fulfilledAt).getTime();
}

/** An order billed to a wholesale account on terms, as the order endpoint
 *  sends it (`OrderOnAccount` in customer-client). */
export interface OnAccountFacts {
  terms: string;
  invoice: {
    number: string | null;
    dueAt: string | null;
    totalCents: number;
    balanceCents: number;
    status: string;
  } | null;
}

/** The last step of a terms order's timeline: its invoice. */
export interface InvoiceStep {
  label: string;
  /** Beside the rail, where a date goes: when it is due, or was. */
  when: string | null;
  /** Under the label: what is still to pay, or what is coming. */
  detail: string | null;
  complete: boolean;
  /** Past its due date and not paid: marked as a problem, not as progress. */
  overdue: boolean;
}

function dueDay(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

/**
 * Where an order on account terms stands with its invoice, for the end of its
 * timeline (sparx persona issue 087).
 *
 * Renée's order on 30-day terms showed "Payment confirmed" as the next thing to
 * happen, ahead of the goods. It is paid after it ships, against an invoice, so
 * the invoice is its last step: what is due and when while it is open, marked
 * when it is overdue, "Invoice paid" once it is, and, while the order is still
 * waiting for approval, that the invoice comes once it is approved.
 */
export function invoiceStep(input: {
  onAccount: OnAccountFacts;
  /** The order is still waiting for approval. */
  held: boolean;
  currency: string;
}): InvoiceStep {
  const { invoice, terms } = input.onAccount;
  if (!invoice) {
    const days = termsDays(terms);
    const toPay =
      days === null ? '' : ` You have ${days === 1 ? '1 day' : `${days} days`} to pay it.`;
    return {
      label: 'Invoice',
      when: null,
      detail: input.held
        ? `We send your invoice once this order is approved.${toPay}`
        : `Your invoice has not been sent yet.${toPay}`,
      complete: false,
      overdue: false,
    };
  }
  const name = invoice.number ? `Invoice ${invoice.number}` : 'Your invoice';
  const total = formatMoney(invoice.totalCents, input.currency);
  const owed = formatMoney(invoice.balanceCents, input.currency);
  switch (invoice.status) {
    case 'paid':
      return {
        label: 'Invoice paid',
        when: null,
        detail: `${name} · ${total}`,
        complete: true,
        overdue: false,
      };
    case 'void':
      return {
        label: 'Invoice canceled',
        when: null,
        detail: `${name} was canceled.`,
        complete: true,
        overdue: false,
      };
    case 'overdue':
      return {
        label: `${name} is overdue`,
        when: invoice.dueAt ? `Was due ${dueDay(invoice.dueAt)}` : null,
        detail: `${owed} to pay`,
        complete: false,
        overdue: true,
      };
    default: {
      const partly = invoice.status === 'partial' && invoice.balanceCents < invoice.totalCents;
      return {
        label: name,
        when: invoice.dueAt ? `Due ${dueDay(invoice.dueAt)}` : null,
        detail: partly ? `${owed} of ${total} still to pay` : `${owed} to pay`,
        complete: false,
        overdue: false,
      };
    }
  }
}
