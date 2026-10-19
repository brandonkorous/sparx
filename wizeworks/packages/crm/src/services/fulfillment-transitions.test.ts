// Sparx persona issue 357: a box sealed at the pack bench had no way out.

import { describe, expect, it } from 'vitest';

import { leftTheBuilding } from './fulfillment-transitions';

describe('leftTheBuilding', () => {
  it('is a packed box being sent or handed over', () => {
    expect(leftTheBuilding('pending', 'shipped')).toBe(true);
    expect(leftTheBuilding('pending', 'delivered')).toBe(true);
  });

  it('is not a parcel already on its way, or one that stays', () => {
    expect(leftTheBuilding('shipped', 'delivered')).toBe(false);
    expect(leftTheBuilding('shipped', 'shipped')).toBe(false);
    expect(leftTheBuilding('pending', 'pending')).toBe(false);
    expect(leftTheBuilding('pending', 'cancelled')).toBe(false);
  });
});
