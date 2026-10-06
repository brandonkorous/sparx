// A BLANK LINE MUST NOT READ AS "THIS ONE WAS KEPT".
//
// O-000004: one of two items marked returned, and the whole $170 back. Both had
// come back. Measured platform-wide: 11 orders with refunds, 11 whose lines
// understate the money, 10 with no line marked at all.

import { describe, expect, it } from 'vitest';

import { refundNote, type RefundedOrder } from './refund-note';

/** Her order, as the database has it. */
const anneliese: RefundedOrder = {
  total: 170,
  refundTotal: 170,
  items: [
    { quantity: 1, quantityRefunded: 0 }, // The Ash Overshirt, $128, refunded
    { quantity: 1, quantityRefunded: 1 }, // The Everyday Tee, $42, returned
  ],
};

describe('the order she was reading', () => {
  it('says the rest came back against the order, not that it was kept', () => {
    const note = refundNote(anneliese);
    expect(note).toContain('whole order was given back');
    expect(note).toContain('only some of the items above are marked');
  });
});

describe('the ten with nothing marked at all', () => {
  it('says why every line is blank', () => {
    const note = refundNote({
      total: 96,
      refundTotal: 96,
      items: [{ quantity: 2, quantityRefunded: 0 }],
    });
    expect(note).toContain('None of the items above is marked as returned');
    expect(note).toContain('against the order as a whole');
  });

  it('says it for a PART refund with nothing marked too', () => {
    // The money came back and the items say nothing. How much came back does
    // not change that.
    expect(
      refundNote({ total: 96, refundTotal: 20, items: [{ quantity: 2, quantityRefunded: 0 }] })
    ).toContain('None of the items above');
  });
});

describe('when there is nothing to explain', () => {
  it('says nothing on an order with no refund', () => {
    expect(
      refundNote({ total: 96, refundTotal: 0, items: [{ quantity: 1, quantityRefunded: 0 }] })
    ).toBe(null);
  });

  it('says nothing when every item is marked and the whole lot came back', () => {
    expect(
      refundNote({
        total: 170,
        refundTotal: 170,
        items: [
          { quantity: 1, quantityRefunded: 1 },
          { quantity: 1, quantityRefunded: 1 },
        ],
      })
    ).toBe(null);
  });

  it('claims nothing about a PART refund that has some items marked', () => {
    // $42 back on a $170 order with one of two items marked. That is exactly
    // what a one-item return looks like, and it is also what a $42 goodwill
    // refund on a kept order looks like. The data does not tell them apart, so
    // this file does not pretend to.
    expect(
      refundNote({
        total: 170,
        refundTotal: 42,
        items: [
          { quantity: 1, quantityRefunded: 0 },
          { quantity: 1, quantityRefunded: 1 },
        ],
      })
    ).toBe(null);
  });
});

describe('it never falls over on a thin order', () => {
  it('says nothing when the items have not loaded', () => {
    for (const items of [undefined, null, []]) {
      expect(refundNote({ total: 170, refundTotal: 170, items }), JSON.stringify(items)).toBe(null);
    }
  });

  it('never states a figure', () => {
    // Every money split this could compute would be a guess: `refundTotal` is a
    // sum of amounts, and the lines carry a unit price, a per-line discount and
    // tax folded in differently.
    for (const order of [
      anneliese,
      { total: 96, refundTotal: 96, items: [{ quantity: 2, quantityRefunded: 0 }] },
    ]) {
      expect(refundNote(order) ?? '').not.toMatch(/\$|\d/);
    }
  });
});

describe('a returned core deposit', () => {
  it('says the money was the deposit, not a whole-order refund', () => {
    const note = refundNote({
      total: 750,
      refundTotal: 150,
      depositsReturned: 150,
      items: [{ quantity: 1, quantityRefunded: 0, coresReturned: 1 }],
    });
    expect(note).toBe('That was the core deposit, given back when the old part came in.');
  });

  it('names the deposit share when other money went back too', () => {
    const note = refundNote({
      total: 750,
      refundTotal: 200,
      depositsReturned: 150,
      items: [{ quantity: 1, quantityRefunded: 0, coresReturned: 1 }],
    });
    expect(note).toBe(
      '$150.00 of it was the core deposit, given back when the old part came in. The rest was given back against the order as a whole rather than item by item.'
    );
  });
});
