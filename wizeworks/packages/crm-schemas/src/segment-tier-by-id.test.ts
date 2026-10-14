// A segment on a price tier names the tier by its id, so a tier renamed under
// Price tiers keeps its segments, and nobody types the name by hand. The old
// name rule still reads, for any business that saved one (sparx persona issue
// 149).

import { describe, expect, it } from 'vitest';

import { evaluateSegmentRule, type RuleProjection } from './evaluate-segment-rule';
import { CustomerProjection, SegmentRuleSchema, type SegmentRule } from './segment-rule';

const FLEET = '6f1d2c4e-8a3b-4c5d-9e7f-0a1b2c3d4e5f';
const DEALER = '0b9e8d7c-6a5f-4e3d-8c2b-1a0f9e8d7c6b';

function onTier(id: string | null, name: string | null): RuleProjection {
  return {
    customer: { type: 'business' },
    b2bAccount: {
      pricingTierId: id,
      pricingTier: name,
      creditUtilization: 0,
      fleetSize: 38,
      status: 'active',
      paymentTerms: 'net30',
    },
    email: { subscribed: true, unsubscribed: false, openedLast30d: 0, clickedLast30d: 0 },
  };
}

const onFleet: SegmentRule = {
  kind: 'predicate',
  field: 'b2bAccount.pricingTierId',
  op: 'eq',
  value: FLEET,
};

describe('a segment on a price tier', () => {
  it('is a rule the server accepts', () => {
    expect(SegmentRuleSchema.safeParse(onFleet).success).toBe(true);
  });

  it('matches an account on that tier, whatever the tier is called now', () => {
    expect(evaluateSegmentRule(onFleet, onTier(FLEET, 'Fleet'))).toBe(true);
    expect(evaluateSegmentRule(onFleet, onTier(FLEET, 'Fleet accounts'))).toBe(true);
    expect(evaluateSegmentRule(onFleet, onTier(DEALER, 'Dealer'))).toBe(false);
    expect(evaluateSegmentRule(onFleet, onTier(null, null))).toBe(false);
  });

  it('is read from the projection the server builds', () => {
    const parsed = CustomerProjection.shape.b2bAccount.unwrap().shape;
    expect(Object.keys(parsed)).toContain('pricingTierId');
  });

  it('still reads a rule saved on the tier name', () => {
    const byName: SegmentRule = {
      kind: 'predicate',
      field: 'b2bAccount.pricingTier',
      op: 'eq',
      value: 'Fleet',
    };
    expect(SegmentRuleSchema.safeParse(byName).success).toBe(true);
    expect(evaluateSegmentRule(byName, onTier(FLEET, 'Fleet'))).toBe(true);
  });
});
