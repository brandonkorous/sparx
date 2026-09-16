import { describe, expect, it } from 'vitest';

import { shippingState } from './order-tone';
import type { Order } from './order-types';

/**
 * An order leaves the shop one of two ways, and the stored status does not say
 * which. `placed`, `fulfilled` and `delivered` each mean something different to
 * a parcel in the post and to a box on the counter, so each one has to say which
 * of the two it is.
 *
 * This is a test per BRANCH rather than a test of the case somebody noticed,
 * because the defect it was written for was one branch out of three: `placed`
 * and `delivered` both asked whether the order was collected and `fulfilled`
 * did not, so a packed collection read "On the way" about something that had
 * not moved. Nothing about that is visible in a diff of the branch beside it.
 */
function order(status: string, collected: boolean): Order {
  return {
    status,
    metadata: collected ? { shippingRateRef: 'collection:in-person' } : {},
  } as unknown as Order;
}

describe('an order that is collected never claims to have travelled', () => {
  const cases = [
    { status: 'placed', posted: 'To send', collected: 'To collect' },
    { status: 'fulfilled', posted: 'On the way', collected: 'Ready to collect' },
    { status: 'delivered', posted: 'Delivered', collected: 'Collected' },
  ] as const;

  it.each(cases)('$status reads "$posted" when it goes in the post', ({ status, posted }) => {
    expect(shippingState(order(status, false)).label).toBe(posted);
  });

  it.each(cases)('$status reads "$collected" when it is collected', ({ status, collected }) => {
    expect(shippingState(order(status, true)).label).toBe(collected);
  });

  it.each(cases)('$status never says a collection is with a carrier', ({ status }) => {
    // The label is what a person scans; the detail is what they read when they
    // stop. Both were wrong on the branch this was written for, and the detail
    // is the one that would have been repeated to a customer on the phone.
    expect(shippingState(order(status, true)).detail).not.toMatch(/carrier|sent to|in transit/i);
  });

  it('says nothing about collection on a status that cannot be collected', () => {
    // Cancelled and refunded are the same fact whichever way the order was
    // going, so they take no collected form and must not grow one by accident.
    expect(shippingState(order('cancelled', true)).label).toBe('Cancelled');
    expect(shippingState(order('refunded', true)).label).toBe('Refunded');
  });
});
