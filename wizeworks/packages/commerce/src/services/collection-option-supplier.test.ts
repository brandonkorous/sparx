// Checkout offered "Collect in person" for a part a supplier ships straight to the
// customer (sparx persona issue 215). Renée was offered collection of S&B's 68
// gallon tank at Gillett's counter, where it never is: S&B holds it and ships it.

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { collectionOption, forWhatShips } from './collection-option';

const ups = {
  rateRef: 'manual:ups',
  providerSlug: 'sparx-manual',
  carrier: 'UPS',
  service: 'Ground',
  amountCents: 0,
  currency: 'USD',
  isFreight: false,
};

describe('forWhatShips', () => {
  it('takes collection away when a supplier ships something in the cart', () => {
    expect(forWhatShips([ups, collectionOption('USD')], true)).toEqual([ups]);
  });

  it('leaves collection for a cart the business ships itself', () => {
    expect(forWhatShips([ups, collectionOption('USD')], false)).toHaveLength(2);
  });

  it('offers nothing rather than a collection nobody can make', () => {
    expect(forWhatShips([collectionOption('USD')], true)).toEqual([]);
  });

  it('is applied where every cart is quoted', () => {
    const src = readFileSync(resolve(__dirname, 'shipping-service.ts'), 'utf8');
    expect(src).toMatch(/dropshipSourceId: true/);
    expect(src).toMatch(/forWhatShips\(/);
  });
});
