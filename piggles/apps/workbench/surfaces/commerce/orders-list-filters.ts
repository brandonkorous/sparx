// The chips on the orders list, and what to say when nothing matched.
//
// Each chip maps to ONE server filter, so what is on screen is always exactly
// one server answer — no chip means "these two statuses, sort of". "Refunded" is
// deliberately absent: it is rare, it is visible on any row it applies to, and a
// sixth chip costs every operator a wider bar forever.

import type { OpenTarget } from '../../lib/surfaces/registry';

export const FILTERS = [
  { value: 'all', label: 'All', status: undefined, paymentStatus: undefined },
  { value: 'unpaid', label: 'Not paid', status: undefined, paymentStatus: 'unpaid' },
  { value: 'to_send', label: 'To send', status: 'placed', paymentStatus: undefined },
  { value: 'sent', label: 'On the way', status: 'fulfilled', paymentStatus: undefined },
  { value: 'delivered', label: 'Delivered', status: 'delivered', paymentStatus: undefined },
  { value: 'cancelled', label: 'Cancelled', status: 'cancelled', paymentStatus: undefined },
] as const;

export type FilterValue = (typeof FILTERS)[number]['value'];

/**
 * What to try when nothing matched — naming ONLY what is actually narrowing the
 * list. Telling someone to clear a filter they never set sends them looking for
 * a control that is already off.
 */
export function emptyAdvice(search: string, filterLabel: string | null): string {
  const parts: string[] = [];
  if (search) {
    parts.push('Try part of an order number, or the customer’s name, company or email.');
  }
  if (filterLabel) {
    parts.push(
      `You are only seeing orders marked “${filterLabel}” — switch back to All for the rest.`
    );
  }
  return parts.join(' ');
}

/** Same modifier contract as every other list in the app. */
export function targetFor(event: { shiftKey: boolean; altKey: boolean }): OpenTarget {
  if (event.altKey) return 'window';
  if (event.shiftKey) return 'beside';
  return 'tab';
}
