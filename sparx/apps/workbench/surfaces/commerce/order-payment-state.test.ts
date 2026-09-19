import { describe, expect, it } from 'vitest';

import { paymentState } from './data';
import type { Order } from './data';

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
