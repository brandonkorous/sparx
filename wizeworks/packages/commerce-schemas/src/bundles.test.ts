import { describe, expect, it } from 'vitest';
import { bundlePartsTotalCents, bundleSetPriceCents } from './bundles';

describe('what the parts come to', () => {
  it('adds the parts at their own prices, times how many of each', () => {
    expect(
      bundlePartsTotalCents([
        { priceCents: 12800, quantity: 1 },
        { priceCents: 5800, quantity: 1 },
      ])
    ).toBe(18600);
    expect(bundlePartsTotalCents([{ priceCents: 5800, quantity: 3 }])).toBe(17400);
  });

  it('counts optional parts too', () => {
    // Nowhere for a shopper to say they dropped one, so pricing as if they
    // had would undercharge every real sale.
    expect(
      bundlePartsTotalCents([
        { priceCents: 12800, quantity: 1 },
        { priceCents: 5800, quantity: 1 },
      ])
    ).toBe(18600);
  });

  it('is zero for a set with nothing in it', () => {
    expect(bundlePartsTotalCents([])).toBe(0);
  });

  it('never lets a bad row pull the total DOWN', () => {
    expect(
      bundlePartsTotalCents([
        { priceCents: 12800, quantity: 1 },
        { priceCents: -5000, quantity: 1 },
        { priceCents: 5800, quantity: -2 },
      ])
    ).toBe(12800);
  });
});

describe('what a shopper pays for the set', () => {
  it('adds up the parts when that is the rule', () => {
    expect(bundleSetPriceCents({ pricingMode: 'sum_of_components', partsTotalCents: 18600 })).toBe(
      18600
    );
  });

  it('takes the flat price whatever the parts come to', () => {
    expect(
      bundleSetPriceCents({
        pricingMode: 'fixed',
        partsTotalCents: 18600,
        fixedPriceCents: 15000,
      })
    ).toBe(15000);
    // Above the parts is a legal answer. The console warns about it; the
    // arithmetic does not silently "fix" a number its owner typed.
    expect(
      bundleSetPriceCents({
        pricingMode: 'fixed',
        partsTotalCents: 18600,
        fixedPriceCents: 20000,
      })
    ).toBe(20000);
  });

  it('takes the percentage off the parts, rounded to the cent', () => {
    expect(
      bundleSetPriceCents({
        pricingMode: 'percent_off_sum',
        partsTotalCents: 18600,
        percentOffSum: 15,
      })
    ).toBe(15810);
    // 12.5% of 18600 is 2325 exactly; 12.5% of 999 is 124.875, which rounds up.
    expect(
      bundleSetPriceCents({
        pricingMode: 'percent_off_sum',
        partsTotalCents: 999,
        percentOffSum: 12.5,
      })
    ).toBe(874);
  });

  it('gives the set away at 100% off and never goes below zero', () => {
    expect(
      bundleSetPriceCents({
        pricingMode: 'percent_off_sum',
        partsTotalCents: 18600,
        percentOffSum: 100,
      })
    ).toBe(0);
    expect(
      bundleSetPriceCents({
        pricingMode: 'percent_off_sum',
        partsTotalCents: 18600,
        percentOffSum: 140,
      })
    ).toBe(0);
    expect(
      bundleSetPriceCents({ pricingMode: 'fixed', partsTotalCents: 18600, fixedPriceCents: -50 })
    ).toBe(0);
  });

  it('falls back to the parts, NOT to free, when the mode has no number', () => {
    // Unreachable through the API, which rejects the combination. Unreachable
    // and free are different, and free is the worse of the two by a distance.
    expect(
      bundleSetPriceCents({ pricingMode: 'fixed', partsTotalCents: 18600, fixedPriceCents: null })
    ).toBe(18600);
    expect(
      bundleSetPriceCents({
        pricingMode: 'percent_off_sum',
        partsTotalCents: 18600,
        percentOffSum: null,
      })
    ).toBe(18600);
    expect(
      bundleSetPriceCents({ pricingMode: 'something_new_someday', partsTotalCents: 18600 })
    ).toBe(18600);
  });
});
