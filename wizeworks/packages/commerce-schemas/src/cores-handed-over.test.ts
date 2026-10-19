// Sparx persona issue 359: a box sealed at the pack bench made the customer owe
// old parts for new ones still on the bench.

import { describe, expect, it } from 'vitest';

import { coresOutstanding, unitsHandedOver } from './cores';

const line = {
  quantity: 6,
  quantityFulfilled: 2,
  quantityRefunded: 0,
  coresReturned: 0,
  coresKept: 0,
  coreFirst: false,
};

describe('unitsHandedOver', () => {
  it('counts only deliveries that went or were handed over', () => {
    expect(
      unitsHandedOver([
        { quantity: 2, fulfillment: { status: 'pending' } },
        { quantity: 1, fulfillment: { status: 'shipped' } },
        { quantity: 1, fulfillment: { status: 'delivered' } },
        { quantity: 3, fulfillment: { status: 'cancelled' } },
      ])
    ).toBe(2);
  });
});

describe('coresOutstanding with what was handed over', () => {
  it('owes nothing for a box still on the bench', () => {
    expect(coresOutstanding({ ...line, quantityHandedOver: 0 })).toBe(0);
  });

  it('owes one per part once the box has gone', () => {
    expect(coresOutstanding({ ...line, quantityHandedOver: 2 })).toBe(2);
  });

  it('reads what was fulfilled when it is not told', () => {
    expect(coresOutstanding(line)).toBe(2);
  });
});
