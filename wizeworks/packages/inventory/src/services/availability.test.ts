// The availability rule, which had no test until a bakery's whole shop said
// "Sold out". Read availability.ts's header for what happened; these are the
// cases that would have caught it.

import { describe, expect, it } from 'vitest';
import { computeAvailability } from './availability';

const ON = { inventoryActive: true };
const OFF = { inventoryActive: false };

describe('a variant nobody has counted', () => {
  it('is sellable, because no level row is the absence of a count and not a count of zero', () => {
    expect(computeAvailability([], 'deny', ON)).toEqual({
      available: null,
      inStock: true,
      tracked: false,
    });
  });

  it('reports no number, so a storefront cannot print "0 left" about it', () => {
    expect(computeAvailability([], 'deny', ON).available).toBeNull();
  });

  it('answers the same whether the inventory module is on or off', () => {
    expect(computeAvailability([], 'deny', ON)).toEqual(computeAvailability([], 'deny', OFF));
  });
});

describe('a variant that HAS been counted', () => {
  it('is out of stock at zero under deny — counted zero really is zero', () => {
    const a = computeAvailability([{ onHand: 0, allocated: 0 }], 'deny', ON);
    expect(a).toEqual({ available: 0, inStock: false, tracked: true });
  });

  it('is in stock with units on hand', () => {
    expect(computeAvailability([{ onHand: 6, allocated: 0 }], 'deny', ON)).toEqual({
      available: 6,
      inStock: true,
      tracked: true,
    });
  });

  it('still sells at zero when the policy says continue', () => {
    const a = computeAvailability([{ onHand: 0, allocated: 0 }], 'continue', ON);
    expect(a.inStock).toBe(true);
    expect(a.available).toBe(0);
  });

  it('sums across warehouses and nets allocation, buffer and unsellable stock', () => {
    const a = computeAvailability(
      [
        { onHand: 10, allocated: 2, safetyBuffer: 1, unsellableOnHand: 1 },
        { onHand: 4, allocated: 0 },
      ],
      'deny',
      ON
    );
    expect(a.available).toBe(10);
  });

  it('never lets one empty warehouse subtract from a stocked one', () => {
    const a = computeAvailability(
      [
        { onHand: 0, allocated: 5 },
        { onHand: 8, allocated: 0 },
      ],
      'deny',
      ON
    );
    expect(a.available).toBe(8);
  });

  it('is tracked, so a level of zero is reported as a real zero', () => {
    expect(computeAvailability([{ onHand: 0, allocated: 0 }], 'deny', ON).tracked).toBe(true);
  });
});
