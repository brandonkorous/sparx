import { describe, expect, it } from 'vitest';
import { paymentListFilter } from '../../src/lib/payment-filter.js';

/**
 * THE "REFUNDED" FILTER ASKED FOR A WORD NOBODY WRITES.
 *
 * Money → Payments has a status filter, and "Refunded" on it queried
 * `order_payments.status = 'refunded'`. Nothing on this platform ever writes
 * that: `recordRefund` inserts an OrderRefund row, flips the ORDER, and
 * recomputes the order's rollup, leaving the payment saying `captured`.
 *
 * Measured 2026-09-15: FOUR payments have refunds against their order. THREE
 * say `captured`. The one that says `refunded` was written by a seed, directly.
 * So a shop owner who picked "Refunded" to find the $170 she had given back got
 * an empty list, while the row she wanted sat two lines up badged "Paid".
 *
 * Guarded here because a filter is the part a type cannot check — every value
 * is a string handed to a query.
 */
describe('paymentListFilter', () => {
  it('asks the money, not the status word, for refunded', () => {
    const f = paymentListFilter('refunded');
    expect(f.requireOrderRefund).toBe(true);
    // Asserted as an absence too: keeping the old narrow status beside the new
    // order condition would still find almost nothing, because the status
    // narrows first.
    expect(f.statuses).not.toEqual(['refunded']);
    expect(f.statuses).toContain('captured');
  });

  it('will not let a refunded order drag in money that never moved', () => {
    // A refund only ever comes off money that was taken. Dropping the status
    // entirely would put a `pending` or `failed` row on a screen about money
    // that moved.
    const f = paymentListFilter('refunded');
    expect(f.statuses).not.toBeNull();
    expect(f.statuses).not.toContain('pending');
    expect(f.statuses).not.toContain('failed');
  });

  it('asks for nothing in particular when nothing is picked', () => {
    for (const value of [undefined, 'all']) {
      const f = paymentListFilter(value);
      expect(f.statuses, String(value)).toBeNull();
      expect(f.requireOrderRefund, String(value)).toBe(false);
    }
  });

  it('passes every other word straight through, and adds no money condition', () => {
    for (const value of ['captured', 'authorized', 'pending', 'failed', 'voided']) {
      const f = paymentListFilter(value);
      expect(f.statuses, value).toEqual([value]);
      expect(f.requireOrderRefund, value).toBe(false);
    }
  });
});
