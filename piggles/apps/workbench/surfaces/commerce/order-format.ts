'use client';

// An order rendered for reading — the buyer, what is still owed, and dates and
// amounts in the reader’s own locale.

import { HELD_FOR_SIGN_OFF_STATUS } from '@wizeworks/crm-schemas';
import type { Order, OrderAddress, OrderCustomer } from './order-types';
import { formatAmount } from '../../lib/money-format';
import { localityLine } from '../../lib/address-format';

/** The buyer in one line: a company if they trade as one, otherwise their name,
 *  otherwise their email. Never an empty cell — an order always has a buyer. */
export function customerName(customer: OrderCustomer | null): string {
  if (!customer) return 'Unknown customer';
  const person = [customer.firstName, customer.lastName].filter(Boolean).join(' ').trim();
  if (customer.companyName) return customer.companyName;
  if (person) return person;
  return customer.email ?? 'Unknown customer';
}

/**
 * What is still collectable on this order.
 *
 * `total − amountPaid` alone is wrong at both ends of an order's life. A
 * refunded order has had its money handed back, and a cancelled one is never
 * going to be paid — both would otherwise report the FULL total as outstanding
 * and put a "still owed" banner on a sale nobody should be chasing. Observed on
 * a real refunded order, which read "Still owed $421.28" under a Refunded badge.
 */
export function amountDue(order: Order): number {
  if (order.status === 'cancelled' || order.status === 'refunded') return 0;
  // Held for sign-off: nothing is owed until it is approved. See
  // HELD_FOR_SIGN_OFF_STATUS in @wizeworks/crm-schemas.
  if (order.status === HELD_FOR_SIGN_OFF_STATUS) return 0;
  if (order.paymentStatus === 'refunded') return 0;
  return Math.max(0, order.total - order.amountPaid - order.refundTotal);
}

/**
 * The Collection card's line once nothing is left to hand over. It used to be
 * "They picked this up." whatever the reason, so a canceled order nobody came
 * for read "They picked this up." above "This order has not been collected
 * yet." (sparx persona issue 091, O-000016).
 */
export function collectedWords(order: Order): string {
  if ((order.items ?? []).some((item) => item.quantityFulfilled > 0)) {
    return 'They picked this up.';
  }
  if (order.status === 'refunded') return 'This order was refunded before anyone collected it.';
  return 'This order was canceled, so there is nothing to collect.';
}

/**
 * The empty Collection or Deliveries card. "Not collected yet" promises it will
 * be; on a canceled or refunded order it never will (sparx persona issue 091).
 */
export function nothingHandedOverWords(order: Order, collected: boolean): string {
  const over = order.status === 'cancelled' || order.status === 'refunded';
  if (collected) return over ? 'Nothing was collected.' : 'This order has not been collected yet.';
  return over ? 'Nothing was sent.' : 'Nothing has been sent for this order yet.';
}

export function formatMoney(amount: number, currency = 'USD'): string {
  return formatAmount(amount, currency);
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return '—';
  return new Date(value).toLocaleDateString(undefined, { dateStyle: 'medium' });
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—';
  return new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

/** A frozen address as a list of lines, blanks dropped. Rendering the fields
 *  individually leaves gaps where an optional one is missing. */
export function addressLines(address: OrderAddress | null): string[] {
  if (!address) return [];
  const region = localityLine(address);
  return [
    address.recipientName,
    address.company,
    address.line1,
    address.line2,
    region,
    address.country,
    address.phone,
  ].filter((line): line is string => Boolean(line?.trim()));
}
