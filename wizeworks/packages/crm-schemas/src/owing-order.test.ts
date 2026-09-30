import { describe, expect, it } from 'vitest';
import {
  isOwingOrder,
  OWING_PAYMENT_STATUSES,
  NOT_COLLECTABLE_ORDER_STATUSES,
  OrderStatus,
  OrderPaymentStatus,
  UNCOUNTED_ORDER_STATUS,
} from './orders';

// "Is there still money to collect on this order?" used to be asked as
// `paymentStatus === 'unpaid'`, which is a column value and not the question.
// These are the rows where the two answers differ.

const owing = (status: string, paymentStatus: string): boolean =>
  isOwingOrder({ status, paymentStatus });

describe('an order that still owes money', () => {
  it('counts an order nobody has paid anything on', () => {
    expect(owing('placed', 'unpaid')).toBe(true);
    expect(owing('fulfilled', 'unpaid')).toBe(true);
    expect(owing('delivered', 'unpaid')).toBe(true);
  });

  it('counts a PART-paid order, which the old question missed entirely', () => {
    // The order's own pane says of this row, in as many words, "some is still
    // owed" — and the filter for money owed did not return it.
    expect(owing('placed', 'partially_paid')).toBe(true);
    expect(owing('fulfilled', 'partially_paid')).toBe(true);
  });

  it('does NOT count a canceled order, whatever its payment column says', () => {
    // A canceled order carries 'unpaid' for the rest of its life. Measured
    // 2026-09-28: 11 of these on the platform across 10 tenants, every one of
    // them inside the figure the screen called "Not paid".
    expect(owing('cancelled', 'unpaid')).toBe(false);
    expect(owing('cancelled', 'partially_paid')).toBe(false);
  });

  it('does NOT count a refunded order', () => {
    expect(owing('refunded', 'unpaid')).toBe(false);
    expect(owing('refunded', 'refunded')).toBe(false);
    expect(owing('delivered', 'refunded')).toBe(false);
  });

  it('does not count an order that is paid', () => {
    expect(owing('placed', 'paid')).toBe(false);
    expect(owing('delivered', 'paid')).toBe(false);
  });

  it('answers for every status and payment pair the schema allows', () => {
    // No pair may throw or return undefined — the rule reads two free strings
    // off a database row, so every combination has to have an answer.
    for (const status of OrderStatus.options) {
      for (const paymentStatus of OrderPaymentStatus.options) {
        expect(typeof owing(status, paymentStatus)).toBe('boolean');
      }
    }
  });

  it('treats a word it has never seen as owing nothing extra', () => {
    // An unknown status is not collectable-blocked, but an unknown payment word
    // is not money owed either: the rule may only say yes to a state it knows.
    expect(owing('placed', 'something_new')).toBe(false);
    expect(owing('something_new', 'unpaid')).toBe(true);
  });

  it('keeps canceled inside the not-collectable set, beside the older rule', () => {
    // `UNCOUNTED_ORDER_STATUS` is the same idea for a customer's figures and is
    // the narrower of the two on purpose. If canceled ever left that set, this
    // rule would start chasing canceled orders again.
    expect(NOT_COLLECTABLE_ORDER_STATUSES).toContain(UNCOUNTED_ORDER_STATUS);
    expect(NOT_COLLECTABLE_ORDER_STATUSES).toContain('refunded');
  });

  it('names only real payment states', () => {
    for (const state of OWING_PAYMENT_STATUSES) {
      expect(OrderPaymentStatus.options).toContain(state);
    }
    for (const state of NOT_COLLECTABLE_ORDER_STATUSES) {
      expect(OrderStatus.options).toContain(state);
    }
  });

  it('never calls a paid or refunded order owing, for any status', () => {
    for (const status of OrderStatus.options) {
      expect(owing(status, 'paid')).toBe(false);
      expect(owing(status, 'refunded')).toBe(false);
    }
  });
});
