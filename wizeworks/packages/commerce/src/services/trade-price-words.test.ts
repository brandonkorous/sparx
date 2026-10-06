import { describe, expect, it } from 'vitest';

import { explainAccountStep, tradePriceWords, type AccountPriceFacts } from './trade-price-words';

// The sentence beside a quoted trade price (sparx persona issue 077). It names
// the rule that set the price, and it must never name one that did not.

const FLEET: AccountPriceFacts = {
  accountOverride: null,
  tier: { name: 'Fleet', discountType: 'percentage', discountValue: 12 },
  tierOverride: null,
  accountPercent: 0,
};

describe('explainAccountStep', () => {
  it("names the group's discount when that is what set the price", () => {
    expect(explainAccountStep(FLEET, 60000, 52800)).toEqual({
      kind: 'tier_discount',
      tierName: 'Fleet',
      discountType: 'percentage',
      value: 12,
      accountPercent: 0,
    });
  });

  it("names the account's own price over its group's discount", () => {
    const facts = { ...FLEET, accountOverride: { priceCents: 1925, percentOff: null } };
    expect(explainAccountStep(facts, 2299, 1925)).toEqual({
      kind: 'account_override',
      percentOff: null,
    });
  });

  it("names the group's price for this one part over the group's discount", () => {
    const facts = { ...FLEET, tierOverride: { priceCents: 51000, percentOff: null } };
    expect(explainAccountStep(facts, 60000, 51000)).toEqual({
      kind: 'tier_override',
      tierName: 'Fleet',
      percentOff: null,
    });
  });

  it('stacks the account flat discount on the group discount', () => {
    const facts = { ...FLEET, accountPercent: 5 };
    // 60000 * 0.88 = 52800, then * 0.95 = 50160.
    expect(explainAccountStep(facts, 60000, 50160)).toMatchObject({
      kind: 'tier_discount',
      accountPercent: 5,
    });
  });

  it('says "their wholesale price" rather than a rule that does not add up', () => {
    // A collection-wide price this does not read set $500.00. Calling it the
    // Fleet discount would print "12% off $600.00" beside $500.00.
    expect(explainAccountStep(FLEET, 60000, 50000)).toEqual({ kind: 'wholesale' });
  });
});

describe('tradePriceWords', () => {
  it('reads the way the owner would say it', () => {
    expect(tradePriceWords(explainAccountStep(FLEET, 60000, 52800), 60000, 'USD')).toBe(
      'Fleet price: 12% off $600.00'
    );
    expect(tradePriceWords({ kind: 'account_override', percentOff: null }, 2299, 'USD')).toBe(
      'Their own price, instead of $22.99'
    );
    expect(
      tradePriceWords({ kind: 'contract', validTo: '2026-12-31T00:00:00.000Z' }, 60000, 'USD')
    ).toBe('Agreed price until Dec 31, 2026, instead of $600.00');
    expect(tradePriceWords({ kind: 'bulk', minQuantity: 10 }, 2299, 'USD')).toBe(
      'Bulk price for 10 or more, instead of $22.99'
    );
  });

  it('says nothing when the list price applies', () => {
    expect(tradePriceWords({ kind: 'list' }, 60000, 'USD')).toBeNull();
  });

  it('prints a fixed group discount as money, from the cents the tier stores', () => {
    expect(
      tradePriceWords(
        {
          kind: 'tier_discount',
          tierName: 'Dealer',
          discountType: 'fixed',
          value: 500,
          accountPercent: 0,
        },
        60000,
        'USD'
      )
    ).toBe('Dealer price: $5.00 off $600.00');
  });
});
