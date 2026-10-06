import { describe, expect, it } from 'vitest';

import { amountDue, collectedWords, nothingHandedOverWords } from './data';
import type { Order } from './data';

/**
 * A HELD ORDER OWES NOTHING YET, AND A CANCELED ONE WAS NOT COLLECTED.
 *
 * Gillett, 2026-10-06. Dana at Salt Lake County placed O-000016, two turbos for
 * $4,758.30 on account, over the county's $2,500 limit, so it waited for Doty's
 * team. Checkout told Dana "Nothing is charged or sent until then". The order
 * page told Doty "$4,758.30 still owed. No money has come in for this order
 * yet." and offered to write down $4,758.30 in cash. Doty canceled it, and the
 * Collection card then read "They picked this up." above "This order has not
 * been collected yet." (sparx persona issue 091).
 */
const order = (over: Partial<Order>): Order =>
  ({
    status: 'placed',
    paymentStatus: 'unpaid',
    total: 4758.3,
    amountPaid: 0,
    refundTotal: 0,
    items: [{ quantity: 2, quantityFulfilled: 0 }],
    ...over,
  }) as Order;

describe('money on an order held for sign-off', () => {
  it('is not owed until the order is approved', () => {
    expect(amountDue(order({ status: 'pending_approval' }))).toBe(0);
  });

  it('is owed once it is placed', () => {
    expect(amountDue(order({}))).toBe(4758.3);
  });
});

describe('the Collection card once nothing is left to hand over', () => {
  it('does not say they picked up a canceled order nobody came for', () => {
    expect(collectedWords(order({ status: 'cancelled' }))).toBe(
      'This order was canceled, so there is nothing to collect.'
    );
  });

  it('does not say they picked up a refunded order nobody came for', () => {
    expect(collectedWords(order({ status: 'refunded' }))).toBe(
      'This order was refunded before anyone collected it.'
    );
  });

  it('says they picked it up when something was handed over', () => {
    expect(
      collectedWords(
        order({
          status: 'delivered',
          items: [{ quantity: 2, quantityFulfilled: 2 }] as Order['items'],
        })
      )
    ).toBe('They picked this up.');
  });
});

describe('the empty Collection or Deliveries card', () => {
  it('does not promise a pickup on a canceled order', () => {
    expect(nothingHandedOverWords(order({ status: 'cancelled' }), true)).toBe(
      'Nothing was collected.'
    );
    expect(nothingHandedOverWords(order({ status: 'cancelled' }), false)).toBe('Nothing was sent.');
  });

  it('still says not yet on an order that will go', () => {
    expect(nothingHandedOverWords(order({}), true)).toBe('This order has not been collected yet.');
  });
});
