import { describe, expect, it } from 'vitest';

import {
  applySurcharges,
  CreateSurchargeRuleInput,
  proratedSurchargeReversal,
  type SurchargeRuleSpec,
} from './surcharge';

const cardFee: SurchargeRuleSpec = {
  id: 'r1',
  name: 'Card fee',
  type: 'percentage',
  value: 3,
  basis: 'total',
  paymentMethods: ['card'],
  label: 'Card processing fee',
};

describe('applySurcharges', () => {
  // subtotal 100.00, shipping 10.00, tax 9.00 → total 119.00 (11900¢)
  const doc = {
    subtotalCents: 10000,
    shippingCents: 1000,
    taxCents: 900,
    paymentMethod: 'card' as const,
  };

  it('3% card fee on the post-tax total', () => {
    const r = applySurcharges([cardFee], doc);
    expect(r.totalCents).toBe(357); // 3% of 11900
    expect(r.applied).toHaveLength(1);
    expect(r.applied[0]!.label).toBe('Card processing fee');
    expect(r.applied[0]!.basisCents).toBe(11900);
  });

  it('does not apply to a non-card (account) payment', () => {
    const r = applySurcharges([cardFee], { ...doc, paymentMethod: 'account' });
    expect(r.totalCents).toBe(0);
    expect(r.applied).toHaveLength(0);
  });

  it('basis subtotal computes on subtotal only', () => {
    const r = applySurcharges([{ ...cardFee, basis: 'subtotal' }], doc);
    expect(r.applied[0]!.basisCents).toBe(10000);
    expect(r.totalCents).toBe(300);
  });

  it('basis subtotal_plus_shipping excludes tax', () => {
    const r = applySurcharges([{ ...cardFee, basis: 'subtotal_plus_shipping' }], doc);
    expect(r.applied[0]!.basisCents).toBe(11000);
  });

  it('flat fee adds a fixed dollar amount', () => {
    const flat: SurchargeRuleSpec = {
      name: 'Handling',
      type: 'flat',
      value: 5,
      basis: 'total',
      paymentMethods: ['card', 'account'],
      label: 'Handling fee',
    };
    const r = applySurcharges([flat], doc);
    expect(r.totalCents).toBe(500);
  });

  it('cap limits the computed amount', () => {
    const r = applySurcharges([{ ...cardFee, value: 3, capCents: 200 }], doc);
    expect(r.totalCents).toBe(200); // 357 capped to 200
  });

  it('multiple rules sum (3% card + $5 handling)', () => {
    const handling: SurchargeRuleSpec = {
      name: 'Handling',
      type: 'flat',
      value: 5,
      basis: 'total',
      paymentMethods: ['card'],
      label: 'Handling',
    };
    const r = applySurcharges([cardFee, handling], doc);
    expect(r.totalCents).toBe(357 + 500);
    expect(r.applied).toHaveLength(2);
  });
});

describe('proratedSurchargeReversal', () => {
  it('full refund reverses the full surcharge', () => {
    expect(proratedSurchargeReversal(357, 11900, 11900)).toBe(357);
  });
  it('half refund reverses half the surcharge', () => {
    expect(proratedSurchargeReversal(357, 5950, 11900)).toBe(179); // round(357 * 0.5)
  });
  it('zero order total is safe', () => {
    expect(proratedSurchargeReversal(357, 100, 0)).toBe(0);
  });
});

describe('CreateSurchargeRuleInput', () => {
  it('applies defaults', () => {
    const parsed = CreateSurchargeRuleInput.parse({ name: 'Card', value: 3, label: 'Card fee' });
    expect(parsed.type).toBe('percentage');
    expect(parsed.basis).toBe('total');
    expect(parsed.paymentMethods).toEqual(['card']);
    expect(parsed.isActive).toBe(false); // platform default OFF
  });
  it('rejects a percentage over 100%', () => {
    expect(
      CreateSurchargeRuleInput.safeParse({ name: 'x', type: 'percentage', value: 150, label: 'x' })
        .success
    ).toBe(false);
  });
});
