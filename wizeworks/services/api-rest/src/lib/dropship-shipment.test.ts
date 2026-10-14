import { describe, expect, it } from 'vitest';

import { carrierOf, dropshipFulfillmentLines, nextDropshipStatus } from './dropship-shipment.js';

// A supplier's parcel reaching the CUSTOMER'S order (sparx persona issue 170). A
// shipment was recorded on the supplier order only, so the customer's order never
// read shipped and the "your order is on its way" email never went.

const S_AND_B = 'supplier-s-and-b';

describe('the lines a supplier shipped', () => {
  it("are this supplier's lines on the order, less what already left", () => {
    const items = [
      { id: 'tank', quantity: 1, quantityFulfilled: 0, variant: { dropshipSourceId: S_AND_B } },
      { id: 'filter', quantity: 2, quantityFulfilled: 0, variant: { dropshipSourceId: null } },
      { id: 'other', quantity: 1, quantityFulfilled: 0, variant: { dropshipSourceId: 'someone' } },
      { id: 'kits', quantity: 3, quantityFulfilled: 1, variant: { dropshipSourceId: S_AND_B } },
    ];
    expect(dropshipFulfillmentLines(items, S_AND_B)).toEqual([
      { orderItemId: 'tank', quantity: 1 },
      { orderItemId: 'kits', quantity: 2 },
    ]);
  });

  it('are none once everything has left', () => {
    const items = [
      { id: 'tank', quantity: 1, quantityFulfilled: 1, variant: { dropshipSourceId: S_AND_B } },
    ];
    expect(dropshipFulfillmentLines(items, S_AND_B)).toEqual([]);
  });
});

describe('the carrier a person typed', () => {
  it('is one we know by name, whatever the case', () => {
    expect(carrierOf('UPS')).toEqual({ carrier: 'ups' });
    expect(carrierOf(' FedEx ')).toEqual({ carrier: 'fedex' });
  });

  it('is kept in their words when it is not one we know', () => {
    expect(carrierOf('R+L Carriers')).toEqual({ carrier: 'other', carrierOther: 'R+L Carriers' });
  });

  it('is nothing when nothing was typed', () => {
    expect(carrierOf('  ')).toEqual({ carrier: null });
  });
});

describe('what the owner can record on a supplier order', () => {
  it('records it placed while it waits on them', () => {
    expect(nextDropshipStatus('pending', 'placed')).toBe('submitted');
    expect(nextDropshipStatus('failed', 'placed')).toBe('submitted');
  });

  it('records it shipped once it is placed, or straight from waiting', () => {
    expect(nextDropshipStatus('submitted', 'shipped')).toBe('shipped');
    expect(nextDropshipStatus('pending', 'shipped')).toBe('shipped');
  });

  it('refuses to move an order backwards or past the end', () => {
    expect(nextDropshipStatus('shipped', 'placed')).toBeNull();
    expect(nextDropshipStatus('delivered', 'shipped')).toBeNull();
    expect(nextDropshipStatus('cancelled', 'placed')).toBeNull();
  });
});
