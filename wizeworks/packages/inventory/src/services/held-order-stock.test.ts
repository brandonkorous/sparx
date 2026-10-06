// The rules behind a held order's stock and the buy box, as pure functions.
//
// MEASURED 2026-10-03 on Gillett Diesel: wholesale order O-000014 (3 CP4 kits,
// 40 O-rings) was held by a spending limit and approved hours later. The
// basket's holds were left behind, the approval took the same units again
// without them, and the kits read sold out in the grid while the product page
// offered one. These pin the pieces that decide each of those answers; the
// database half lives in test/integration/sell-path.test.ts.

import { describe, expect, it } from 'vitest';

import {
  availabilityLevelOf,
  computeAvailability,
  levelSellable,
  type AvailabilityLevel,
} from './availability';
import { chooseWarehouse, type WarehouseCandidate } from './reservations';
import { orderStockNote } from './sell-path';

const SHOP: WarehouseCandidate = { id: 'shop', defaultForChannel: [] };
const WAREHOUSE: WarehouseCandidate = { id: 'warehouse', defaultForChannel: ['storefront'] };
const ANNEX: WarehouseCandidate = { id: 'annex', defaultForChannel: ['admin'] };

describe('where a line is taken from', () => {
  it('prefers the channel’s own location when it can fill the line', () => {
    expect(
      chooseWarehouse({
        candidates: [SHOP, WAREHOUSE],
        sellableBy: new Map([
          ['shop', 5],
          ['warehouse', 3],
        ]),
        quantity: 3,
        channel: 'storefront',
      })
    ).toBe('warehouse');
  });

  it('goes to any location that can fill it when the channel’s own cannot', () => {
    expect(
      chooseWarehouse({
        candidates: [SHOP, WAREHOUSE],
        sellableBy: new Map([
          ['shop', 3],
          ['warehouse', 0],
        ]),
        quantity: 3,
        channel: 'storefront',
      })
    ).toBe('shop');
  });

  // The O-000014 shape: an order (channel `admin`) that no single location can
  // fill, at a business whose `admin` default has never stocked the item. The
  // old fallback went straight to that default and the ledger invented a level
  // row there at minus the quantity.
  it('books a short line where the item is stocked, never at a location that never held it', () => {
    expect(
      chooseWarehouse({
        candidates: [ANNEX, SHOP, WAREHOUSE],
        sellableBy: new Map([
          ['shop', 1],
          ['warehouse', 0],
        ]),
        quantity: 3,
        channel: 'admin',
      })
    ).toBe('shop');
  });

  it('keeps a short line at the channel’s own location when that location stocks it', () => {
    expect(
      chooseWarehouse({
        candidates: [SHOP, WAREHOUSE],
        sellableBy: new Map([
          ['shop', 1],
          ['warehouse', 0],
        ]),
        quantity: 3,
        channel: 'storefront',
      })
    ).toBe('warehouse');
  });

  it('falls back to the channel default only for an item no location has counted', () => {
    expect(
      chooseWarehouse({
        candidates: [SHOP, ANNEX],
        sellableBy: new Map(),
        quantity: 1,
        channel: 'admin',
      })
    ).toBe('annex');
  });
});

describe('what the buy box counts', () => {
  it('does not let one oversold location cancel stock at another', () => {
    const levels: AvailabilityLevel[] = [
      { onHand: 1, allocated: 0 },
      { onHand: 0, allocated: 3 },
    ];
    expect(computeAvailability(levels, 'deny', { inventoryActive: true })).toEqual({
      available: 1,
      inStock: true,
      tracked: true,
    });
  });

  it('does not count a location that cannot sell, and still treats the item as counted', () => {
    const archived = availabilityLevelOf({
      onHand: 4,
      allocated: 0,
      safetyBuffer: 0,
      unsellableOnHand: 0,
      warehouse: { isActive: true, deletedAt: new Date('2026-09-01') },
    });
    const off = availabilityLevelOf({
      onHand: 2,
      allocated: 0,
      safetyBuffer: 0,
      unsellableOnHand: 0,
      warehouse: { isActive: false, deletedAt: null },
    });
    expect(levelSellable(archived)).toBe(0);
    expect(levelSellable(off)).toBe(0);
    expect(computeAvailability([archived, off], 'deny', { inventoryActive: true })).toEqual({
      available: 0,
      inStock: false,
      tracked: true,
    });
  });

  it('counts a level at a working location, buffer and quarantine netted', () => {
    const level = availabilityLevelOf({
      onHand: 10,
      allocated: 2,
      safetyBuffer: 1,
      unsellableOnHand: 1,
      warehouse: { isActive: true, deletedAt: null },
    });
    expect(levelSellable(level)).toBe(6);
  });
});

describe('what the person approving is told', () => {
  it('names the units owed to the customer', () => {
    expect(
      orderStockNote([
        {
          variantId: 'v-kit',
          sku: 'CP4-6.7F-BP-G2.1',
          name: 'S&S CP4 kit',
          ordered: 3,
          notFree: 2,
          owed: 2,
        },
      ])
    ).toBe(
      'S&S CP4 kit: 2 of 3 were not in stock, so they are owed to the customer and will go out when more arrive.'
    );
  });

  it('says when it took units another order was holding', () => {
    expect(
      orderStockNote([
        { variantId: 'v-ring', sku: '4062328', name: 'O-ring', ordered: 40, notFree: 1, owed: 0 },
      ])
    ).toBe('O-ring: 1 was already set aside for another order, which is now short.');
  });

  it('says nothing about a line that was covered', () => {
    expect(
      orderStockNote([
        { variantId: 'v-ring', sku: '4062328', name: 'O-ring', ordered: 40, notFree: 0, owed: 0 },
      ])
    ).toBe('');
  });
});
