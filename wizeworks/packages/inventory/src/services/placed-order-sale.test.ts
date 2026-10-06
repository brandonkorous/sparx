// Every placed order takes its stock, whoever wrote it (sparx persona issue 084).
//
// Measured 2026-10-02 on Gillett Diesel: nine orders, one stock movement. The
// web order took its injector; six counter sales and two orders made from
// quotes, 16 units between them, took nothing.

import { describe, expect, it } from 'vitest';

import { linesToSellForOrder, type OrderForSale } from './sell-path';

const injector = {
  id: 'line-injector',
  variantId: '6f0cf3c9-2fc3-4294-a285-643eb5ef229d',
  quantity: 6,
  variant: { dropshipSourceId: null },
};
const oring = {
  id: 'line-oring',
  variantId: '91586e58-cf9b-409c-8a29-074fad861d0e',
  quantity: 2,
  variant: { dropshipSourceId: null },
};
const order = (over: Partial<OrderForSale> = {}): OrderForSale => ({
  status: 'placed',
  items: [injector, oring],
  ...over,
});

describe('linesToSellForOrder', () => {
  it('takes every line of a placed order nothing has taken yet', () => {
    expect(linesToSellForOrder(order(), false)).toEqual([
      { variantId: injector.variantId, quantity: 6, reservationId: null, lineKey: 'line-injector' },
      { variantId: oring.variantId, quantity: 2, reservationId: null, lineKey: 'line-oring' },
    ]);
    // A counter sale is handed over at once, so it is often delivered already.
    expect(linesToSellForOrder(order({ status: 'delivered' }), false)).toHaveLength(2);
  });

  it('leaves an order whose writer already took the stock, so checkout is never counted twice', () => {
    expect(linesToSellForOrder(order(), true)).toEqual([]);
  });

  it('waits for a held order to be signed off, and never takes a canceled one', () => {
    expect(linesToSellForOrder(order({ status: 'pending_approval' }), false)).toEqual([]);
    expect(linesToSellForOrder(order({ status: 'cancelled' }), false)).toEqual([]);
  });

  it('skips a line the supplier ships and a line typed in with no product', () => {
    const lines = linesToSellForOrder(
      order({
        items: [
          injector,
          { ...oring, variant: { dropshipSourceId: 'supplier-feed' } },
          { id: 'line-labor', variantId: null, quantity: 1, variant: null },
        ],
      }),
      false
    );
    expect(lines.map((l) => l.lineKey)).toEqual(['line-injector']);
  });
});
