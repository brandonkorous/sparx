import { describe, expect, it } from 'vitest';

import {
  applyMarkupRule,
  CreateMarkupRuleInput,
  marginToMarkup,
  markupToMargin,
  type MarkupRuleSpec,
} from './markup';

describe('applyMarkupRule — methods (docs/48 §2 reference table)', () => {
  // cost $10.00 (1000¢)
  it('percentage +40% → $14.00, 28.6% margin', () => {
    const r = applyMarkupRule(1000, { method: 'percentage', value: 0.4 });
    expect(r.priceCents).toBe(1400);
    expect(r.profitCents).toBe(400);
    expect(r.marginPct).toBe(28.6);
    expect(r.markupPct).toBe(40);
  });

  it('percentage +100% → $20.00, 50% margin', () => {
    const r = applyMarkupRule(1000, { method: 'percentage', value: 1.0 });
    expect(r.priceCents).toBe(2000);
    expect(r.marginPct).toBe(50);
  });

  it('multiplier ×2.5 → $25.00, 60% margin', () => {
    const r = applyMarkupRule(1000, { method: 'multiplier', value: 2.5 });
    expect(r.priceCents).toBe(2500);
    expect(r.marginPct).toBe(60);
  });

  it('flat +$15 → $25.00', () => {
    const r = applyMarkupRule(1000, { method: 'flat', value: 15 });
    expect(r.priceCents).toBe(2500);
    expect(r.profitCents).toBe(1500);
  });

  it('margin_target 0.45 → price so margin is exactly 45%', () => {
    const r = applyMarkupRule(1000, { method: 'margin_target', value: 0.45 });
    // 1000 / (1 - 0.45) = 1818.18 → 1818¢
    expect(r.priceCents).toBe(1818);
    expect(r.marginPct).toBeCloseTo(45, 0);
  });
});

describe('applyMarkupRule — rounding', () => {
  it('nearest $1.00 rounds 1818 → 1800', () => {
    const r = applyMarkupRule(1000, {
      method: 'margin_target',
      value: 0.45,
      rounding: { strategy: 'nearest', precisionCents: 100 },
    });
    expect(r.priceCents).toBe(1800);
  });

  it('charm .99 rounds 1400 up to 1499', () => {
    const r = applyMarkupRule(1000, {
      method: 'percentage',
      value: 0.4,
      rounding: { strategy: 'charm', endingCents: 99 },
    });
    expect(r.priceCents).toBe(1499);
  });

  it('charm .99 leaves an exact .99 unchanged', () => {
    // cost 1499, ×1 → 1499 already ends .99
    const r = applyMarkupRule(1499, {
      method: 'multiplier',
      value: 1,
      rounding: { strategy: 'charm', endingCents: 99 },
    });
    expect(r.priceCents).toBe(1499);
  });
});

describe('applyMarkupRule — floor & ceiling', () => {
  it('floor_profit raises a thin markup to guarantee $5 profit', () => {
    const r = applyMarkupRule(1000, { method: 'percentage', value: 0.1, floorProfitCents: 500 });
    // +10% = 1100 (profit 100) < 500 floor → 1500
    expect(r.priceCents).toBe(1500);
    expect(r.profitCents).toBe(500);
  });

  it('floor_margin guarantees a minimum 50% margin', () => {
    const r = applyMarkupRule(1000, { method: 'percentage', value: 0.1, floorMargin: 50 });
    // need price so margin ≥ 50%: 1000/(1-0.5) = 2000
    expect(r.priceCents).toBe(2000);
    expect(r.marginPct).toBeGreaterThanOrEqual(50);
  });

  it('fixed ceiling caps a high markup on a cheap part', () => {
    const r = applyMarkupRule(100, {
      method: 'multiplier',
      value: 5,
      ceilingSrc: 'fixed',
      ceilingValueCents: 300,
    });
    // ×5 = 500, capped at 300
    expect(r.priceCents).toBe(300);
  });

  it('compare_at ceiling uses the context value', () => {
    const r = applyMarkupRule(
      100,
      { method: 'multiplier', value: 5, ceilingSrc: 'compare_at' },
      { compareAtCents: 250 }
    );
    expect(r.priceCents).toBe(250);
  });
});

describe('applyMarkupRule — matrix (docs/48 §3.4)', () => {
  const matrix: MarkupRuleSpec = {
    method: 'matrix',
    bands: [
      { costMinCents: 1, costMaxCents: 200, method: 'percentage', value: 2.0 }, // +200%
      { costMinCents: 201, costMaxCents: 1000, method: 'percentage', value: 1.5 }, // +150%
      { costMinCents: 1001, costMaxCents: 2500, method: 'percentage', value: 1.0 }, // keystone
      { costMinCents: 5001, costMaxCents: null, method: 'percentage', value: 0.33 }, // top, open-ended
    ],
  };

  it('cheap part ($1.50) hits the +200% band', () => {
    expect(applyMarkupRule(150, matrix).priceCents).toBe(450);
  });

  it('mid part ($15.00) hits the keystone band', () => {
    expect(applyMarkupRule(1500, matrix).priceCents).toBe(3000);
  });

  it('expensive part ($100) hits the open-ended top band', () => {
    // +33% of 10000 = 13300
    expect(applyMarkupRule(10000, matrix).priceCents).toBe(13300);
  });

  it('cost in a gap clamps to the nearest band rather than pricing at cost', () => {
    // 3000¢ sits in the 2501–5000 gap → clamps to nearest (the 1001–2500 band by proximity below, or top above)
    const r = applyMarkupRule(3000, matrix);
    expect(r.priceCents).toBeGreaterThan(3000);
  });
});

describe('markup ↔ margin conversions (docs/48 §2)', () => {
  it('40% markup ≈ 28.57% margin', () => {
    expect(markupToMargin(0.4)).toBeCloseTo(0.2857, 3);
  });
  it('50% margin = 100% markup', () => {
    expect(marginToMarkup(0.5)).toBeCloseTo(1.0, 6);
  });
});

describe('CreateMarkupRuleInput validation', () => {
  it('rejects a percentage rule with no value', () => {
    expect(CreateMarkupRuleInput.safeParse({ name: 'x', method: 'percentage' }).success).toBe(
      false
    );
  });
  it('rejects a matrix rule with no bands', () => {
    expect(CreateMarkupRuleInput.safeParse({ name: 'x', method: 'matrix' }).success).toBe(false);
  });
  it('rejects margin_target ≥ 1', () => {
    expect(
      CreateMarkupRuleInput.safeParse({ name: 'x', method: 'margin_target', value: 1.2 }).success
    ).toBe(false);
  });
  it('rejects unsupported cost bases (docs/28 not shipped)', () => {
    expect(
      CreateMarkupRuleInput.safeParse({
        name: 'x',
        method: 'percentage',
        value: 0.4,
        costBasis: 'average_cost',
      }).success
    ).toBe(false);
  });
  it('accepts a valid percentage rule and applies defaults', () => {
    const parsed = CreateMarkupRuleInput.parse({
      name: 'Keystone',
      method: 'percentage',
      value: 1.0,
    });
    expect(parsed.costBasis).toBe('variant_cost');
    expect(parsed.appliesTo).toBe('catalog');
    expect(parsed.scope).toEqual({ type: 'all' });
    expect(parsed.isActive).toBe(true);
  });
});
