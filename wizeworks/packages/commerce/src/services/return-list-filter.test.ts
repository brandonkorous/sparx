// A buyer's returns are found from her own orders (sparx persona issue 196).
// The account page read the shop's latest 200 returns and kept hers, so in a
// shop with more, her older returns were not on her list at all.

import { describe, expect, it } from 'vitest';

import { returnListWhere } from './return-list-filter';

describe('returnListWhere', () => {
  it('keeps the console filters as they were', () => {
    expect(returnListWhere({ status: 'requested', orderId: 'o-1' }, null)).toEqual({
      status: 'requested',
      orderId: 'o-1',
    });
    expect(returnListWhere({}, null)).toEqual({});
  });

  it('narrows to the returns on her own orders', () => {
    expect(returnListWhere({}, ['o-1', 'o-2'])).toEqual({ orderId: { in: ['o-1', 'o-2'] } });
  });

  it('finds nothing for a buyer with no orders, never every return in the shop', () => {
    expect(returnListWhere({}, [])).toEqual({ orderId: { in: [] } });
  });

  it('one order asked for, on her orders, is that order only if it is hers', () => {
    expect(returnListWhere({ orderId: 'o-9' }, ['o-1'])).toEqual({
      AND: [{ orderId: 'o-9' }, { orderId: { in: ['o-1'] } }],
    });
  });
});
