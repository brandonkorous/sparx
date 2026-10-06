// The buyer's own price per version, for the builder's product feed (sparx
// persona issue 086). A version whose agreed price equals the list price is left
// out, so the page never strikes through a price for the same price.

import { describe, expect, it } from 'vitest';

import { cardYourPrice, viewerUnitPrices, viewerVariantPrices } from './viewer-variant-prices';

describe('viewerVariantPrices', () => {
  it('keeps the agreed price where it differs from the list price', () => {
    const out = viewerVariantPrices(
      [
        { id: 'small', priceCents: 4900 },
        { id: 'large', priceCents: 6900 },
        { id: 'none', priceCents: 1000 },
      ],
      new Map([
        ['small', 4200],
        ['large', 6900],
      ])
    );
    expect([...out]).toEqual([['small', 4200]]);
  });

  it('is empty for a visitor with no agreed prices', () => {
    expect(viewerVariantPrices([{ id: 'small', priceCents: 4900 }], new Map()).size).toBe(0);
  });
});

describe('the trade buyer’s price on a card (issue 086)', () => {
  // Wasatch Front is on Fleet, 12% off. Its S&S kit read $400.00 in search and
  // $352.00 on the product page, because cards only read contract prices.
  const kit = { id: 'kit', currency: 'USD', priceCents: 40000 };
  const oRing = { id: 'o-ring', currency: 'USD', priceCents: 432 };
  const fleetRule = (v: { priceCents: number }) => Promise.resolve(Math.round(v.priceCents * 0.88));

  it('is the price the product page’s rule gives, so search and the page agree', async () => {
    const out = await viewerUnitPrices([kit], fleetRule);
    expect(out.get('kit')).toBe(35200);
  });

  it('is left out where the rule gives everyone’s price', async () => {
    const out = await viewerUnitPrices([oRing], (v) => Promise.resolve(v.priceCents));
    expect(out.has('o-ring')).toBe(false);
  });

  it('is shown on the card unless it is the figure the card already prints', () => {
    expect(cardYourPrice(35200, 40000)).toBe(35200);
    expect(cardYourPrice(15810, 15810)).toBeNull();
    expect(cardYourPrice(undefined, 40000)).toBeNull();
  });
});
