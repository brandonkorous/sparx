import { describe, expect, it } from 'vitest';

import { paymentState, shippingState } from './order-tone';
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
function order(status: string, collected: boolean, fulfilledAt: string | null = null): Order {
  return {
    status,
    fulfilledAt,
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
    // A cancelled order is the same fact whichever way it was going, so it
    // takes no collected form and must not grow one by accident.
    //
    // `refunded` used to be listed here beside it. That was right while the
    // status said nothing about the goods; it says something now, and what it
    // says differs by route, which is the same reason `fulfilled` above grew a
    // collected form on purpose.
    expect(shippingState(order('cancelled', true)).label).toBe('Canceled');
  });
});

/**
 * "REFUNDED" IN THE DELIVERY COLUMN, BESIDE "REFUNDED" IN THE PAYMENT COLUMN.
 *
 * Sell -> Orders, 2026-09-17. O-000004 carried the same word twice, so one of
 * the two columns answered nothing. The Delivery column's question is whether
 * the goods have gone, and the two answers need opposite things from an owner:
 * goods that went are with a customer who has had their money back; goods that
 * never went are still on her shelf.
 *
 * Measured the same day: 9 refunded orders on the platform, 8 of which never
 * shipped — and `fulfilledAt` agreed with the shipment records on all 9.
 */
describe('a refunded order says whether the goods went', () => {
  it('says never sent when nothing ever left', () => {
    const state = shippingState(order('refunded', false, null));
    expect(state.label).toBe('Never sent');
    expect(state.detail).toMatch(/still on your shelf/i);
  });

  it('says it went when it went', () => {
    const state = shippingState(order('refunded', false, '2026-09-01T10:00:00Z'));
    expect(state.label).toBe('Sent, then refunded');
    expect(state.detail).toMatch(/with the customer/i);
  });

  it('uses the collection words for a collection', () => {
    expect(shippingState(order('refunded', true, null)).label).toBe('Never collected');
    expect(shippingState(order('refunded', true, '2026-09-01T10:00:00Z')).label).toBe(
      'Collected, then refunded'
    );
  });

  it('never repeats the payment column word', () => {
    // The whole defect in one line: both columns said "Refunded".
    for (const collected of [true, false]) {
      for (const went of [null, '2026-09-01T10:00:00Z']) {
        expect(shippingState(order('refunded', collected, went)).label).not.toBe('Refunded');
      }
    }
  });

  it('warns only about the half that is out in the world', () => {
    // Goods on her own shelf need no color; goods with a customer who has been
    // refunded are the ones to chase.
    expect(shippingState(order('refunded', false, null)).tone).toBe('neutral');
    expect(shippingState(order('refunded', false, '2026-09-01T10:00:00Z')).tone).toBe('warning');
  });

  it('never says a collection travelled', () => {
    for (const went of [null, '2026-09-01T10:00:00Z']) {
      expect(shippingState(order('refunded', true, went)).detail).not.toMatch(
        /carrier|sent to|in transit/i
      );
    }
  });
});

/**
 * "PART PAID — SOME IS STILL OWED", ON AN ORDER THAT WAS PAID IN FULL.
 *
 * Sell -> Orders, 2026-09-16.
 *
 *     O-000005   $147.00   [Part paid]
 *                          "Some of this order has been paid for, and some is
 *                           still owed."
 *
 * The customer paid $147.00 and had $42.00 back. Nothing is owed. `amountPaid`
 * is captured MINUS refunded, so a full payment followed by a part refund falls
 * below the total and stores as `partially_paid` — and the badge read the word.
 *
 * Measured the same day: 2 of the 3 `partially_paid` orders on this platform, on
 * 2 different shops, were paid in full and part refunded. The public account
 * endpoint had already worked around this for the shopper's own view in issue
 * 292 ("reads as a debt rather than as money returned"); the console kept
 * reading the word.
 */
describe('paymentState money truth', () => {
  const order = (over: Partial<Order>): Order =>
    ({
      paymentStatus: 'partially_paid',
      total: 147,
      amountPaid: 105,
      refundTotal: 42,
      ...over,
    }) as Order;

  it('never says money is owed on an order that was paid in full', () => {
    const state = paymentState(order({}));
    expect(state.detail).not.toContain('still owed');
    expect(state.label).toBe('Part refunded');
    expect(state.detail).toContain('Nothing is owed');
  });

  it('still says money is owed when some of it genuinely is', () => {
    // Paid $60 of $147, then $20 back: most of it is still outstanding.
    const state = paymentState(order({ amountPaid: 60, refundTotal: 20 }));
    expect(state.label).toBe('Part paid, part back');
    expect(state.detail).toContain('still an amount owed');
  });

  it('leaves a plain part-payment alone', () => {
    const state = paymentState(order({ amountPaid: 105, refundTotal: 0 }));
    expect(state.label).toBe('Part paid');
    expect(state.detail).toContain('still owed');
  });

  it('leaves a fully paid and a fully refunded order alone', () => {
    expect(paymentState(order({ paymentStatus: 'paid', refundTotal: 0 })).label).toBe('Paid');
    expect(
      paymentState(order({ paymentStatus: 'refunded', amountPaid: 0, refundTotal: 147 })).label
    ).toBe('Refunded');
  });
});
