// The B2B summary counts accounts by the tier that prices them (sparx persona
// issue 086, finding 35). It grouped by the legacy free-text column, empty on all
// of Gillett's accounts, so the summary said no account was on any tier while
// five sat on Fleet, Contract and Dealer.

import { describe, expect, it } from 'vitest';

import { tierBreakdown, tierIdsIn, type TierGroup } from '../../src/lib/b2b-tier-breakdown';

const FLEET = '6b85fdb0-7a3f-4e54-8a3c-b4f4660e74c1';
const DEALER = '608da177-cd46-4b6f-b9d0-4f6b7f090883';
const CONTRACT = '249b3cc0-9cb0-46b4-b69a-f526cc12beff';

const groups: TierGroup[] = [
  { pricingTierId: DEALER, _count: { _all: 1 } },
  { pricingTierId: null, _count: { _all: 2 } },
  { pricingTierId: FLEET, _count: { _all: 3 } },
  { pricingTierId: CONTRACT, _count: { _all: 1 } },
];

const tiers = [
  { id: FLEET, name: 'Fleet', deletedAt: null },
  { id: DEALER, name: 'Dealer', deletedAt: null },
  { id: CONTRACT, name: 'Contract', deletedAt: null },
];

describe('accounts by price tier', () => {
  it('names each group from its tier and counts normal prices honestly', () => {
    expect(tierBreakdown(groups, tiers)).toEqual([
      { tierId: FLEET, tier: 'Fleet', count: 3 },
      { tierId: null, tier: null, count: 2 },
      { tierId: CONTRACT, tier: 'Contract', count: 1 },
      { tierId: DEALER, tier: 'Dealer', count: 1 },
    ]);
  });

  it('looks names up only for real tiers', () => {
    expect(tierIdsIn(groups)).toEqual([DEALER, FLEET, CONTRACT]);
  });

  it('counts accounts on a removed tier as normal prices, which is what they pay', () => {
    const removed = tiers.map((t) =>
      t.id === DEALER ? { ...t, deletedAt: new Date('2026-10-03T08:00:00Z') } : t
    );
    expect(tierBreakdown(groups, removed)).toEqual([
      { tierId: null, tier: null, count: 3 },
      { tierId: FLEET, tier: 'Fleet', count: 3 },
      { tierId: CONTRACT, tier: 'Contract', count: 1 },
    ]);
  });

  it('keeps a tier it cannot name apart from normal prices', () => {
    const rows = tierBreakdown([{ pricingTierId: FLEET, _count: { _all: 4 } }], []);
    expect(rows).toEqual([{ tierId: FLEET, tier: null, count: 4 }]);
  });
});
