// Sparx persona issue 085: the wholesale price form compared a new price with
// the LIST price, so a group already paying less was shown a price rise as a
// saving.

import { describe, expect, it } from 'vitest';

import { groupPaysNowCents, newTradePriceSentence } from './trade-price-now';
import type { TradePricingTier, TradeTierOverride } from './products-data';

const injector = { id: 'v-injector', priceCents: 62118 };

function tier(partial: Partial<TradePricingTier> = {}): TradePricingTier {
  return {
    id: 'fleet',
    name: 'Fleet',
    description: null,
    discountType: 'percentage',
    discountValue: 15,
    productScope: 'all',
    minOrderCents: 0,
    accountCount: 1,
    ...partial,
  };
}

function override(partial: Partial<TradeTierOverride> = {}): TradeTierOverride {
  return {
    id: 'o1',
    tierId: 'fleet',
    tierName: 'Fleet',
    tierDeleted: false,
    variantId: 'v-injector',
    priceCents: 52800,
    discountPercentage: null,
    notes: null,
    ...partial,
  };
}

const money = (cents: number) => `$${(cents / 100).toFixed(2)}`;

describe('groupPaysNowCents', () => {
  it("takes the group's own price for this version first", () => {
    expect(groupPaysNowCents('fleet', injector, [tier()], [override()])).toBe(52800);
  });

  it('falls back to the blanket discount when it covers every product', () => {
    expect(groupPaysNowCents('fleet', injector, [tier()], [])).toBe(52800);
  });

  it('is the list price when the discount covers only listed products', () => {
    expect(groupPaysNowCents('fleet', injector, [tier({ productScope: 'selected' })], [])).toBe(
      62118
    );
  });

  it("ignores a deleted group's old price and another version's", () => {
    const stale = [override({ tierDeleted: true }), override({ variantId: 'v-oring' })];
    expect(groupPaysNowCents('fleet', injector, [tier({ discountValue: 0 })], stale)).toBe(62118);
  });

  it('takes an amount off when the discount is an amount', () => {
    const amountOff = tier({ discountType: 'fixed', discountValue: 20 });
    expect(groupPaysNowCents('fleet', injector, [amountOff], [])).toBe(60118);
  });
});

describe('newTradePriceSentence', () => {
  it('says out loud when the new price is a rise', () => {
    expect(newTradePriceSentence(55906, 52800, money)).toBe(
      'They pay $528.00 now. This raises it to $559.06, more than they pay today.'
    );
  });

  it('says a cut is a cut', () => {
    expect(newTradePriceSentence(49900, 52800, money)).toBe(
      'They pay $528.00 now. This brings it down to $499.00.'
    );
  });

  it('says nothing about now until it is known', () => {
    expect(newTradePriceSentence(49900, null, money)).toBe('They would pay $499.00.');
  });
});
