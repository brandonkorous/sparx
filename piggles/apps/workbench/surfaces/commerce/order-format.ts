'use client';

// An order rendered for reading — the buyer, what is still owed, and dates and
// amounts in the reader’s own locale.

import type { Order, OrderAddress, OrderCustomer } from './order-types';

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
  if (order.paymentStatus === 'refunded') return 0;
  return Math.max(0, order.total - order.amountPaid - order.refundTotal);
}

export function formatMoney(amount: number, currency = 'USD'): string {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(amount);
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
  const region = [address.city, address.region, address.postalCode].filter(Boolean).join(', ');
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
