// Cost to keep counts items, not stock lines (persona issue 275).
//
// Gillett: "677 items have no cost price" on Cost to keep, while the costing
// screen said "560 things". Both were right about different things: 677 stock
// lines (an item kept in two places counts twice) and 560 items. The screen
// says "items", so it counts each item once.

import { describe, expect, it } from 'vitest';

import { uncostedItemCount } from './planning-reports';

const line = (variantId: string, costKnown: boolean) => ({ variantId, costKnown });

describe('items with no cost price, on Cost to keep', () => {
  it('counts an item kept in two places once', () => {
    expect(
      uncostedItemCount([line('injector', false), line('injector', false), line('gasket', false)])
    ).toBe(2);
  });

  it('leaves out items that have a cost', () => {
    expect(uncostedItemCount([line('injector', true), line('gasket', false)])).toBe(1);
  });
});
