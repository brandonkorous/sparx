import { describe, expect, it } from 'vitest';

import {
  LineMarkupInput,
  priceLineByMarkup,
  type MarkupRuleSpec,
  type ResolvedLineMarkup,
} from './markup';

const AT = '2026-06-10T00:00:00.000Z';

describe('priceLineByMarkup — ad-hoc (docs/48 §5)', () => {
  it('percentage +40% on $10 cost → $14, snapshot has no rule', () => {
    const { result, snapshot } = priceLineByMarkup(
      1000,
      { kind: 'adhoc', method: 'percentage', value: 0.4, costSource: 'manual' },
      AT
    );
    expect(result.priceCents).toBe(1400);
    expect(snapshot.ruleId).toBeNull();
    expect(snapshot.ruleName).toBeNull();
    expect(snapshot.method).toBe('percentage');
    expect(snapshot.value).toBe(0.4);
    expect(snapshot.costSource).toBe('manual');
    expect(snapshot.costBasisValueCents).toBe(1000);
    expect(snapshot.computedPriceCents).toBe(1400);
    expect(snapshot.marginPct).toBe(28.6);
    expect(snapshot.markupPct).toBe(40);
    expect(snapshot.computedAt).toBe(AT);
  });

  it('flat +$15 on $10 cost → $25', () => {
    const { result } = priceLineByMarkup(
      1000,
      { kind: 'adhoc', method: 'flat', value: 15, costSource: 'manual' },
      AT
    );
    expect(result.priceCents).toBe(2500);
  });
});

describe('priceLineByMarkup — saved rule', () => {
  const spec: MarkupRuleSpec = { method: 'multiplier', value: 2 };

  it('records the rule id + name + variant cost source', () => {
    const resolved: ResolvedLineMarkup = {
      kind: 'rule',
      ruleId: '123e4567-e89b-12d3-a456-426614174000',
      ruleName: 'Parts 2×',
      spec,
      costSource: 'variant_cost',
    };
    const { result, snapshot } = priceLineByMarkup(1000, resolved, AT);
    expect(result.priceCents).toBe(2000);
    expect(snapshot.ruleId).toBe('123e4567-e89b-12d3-a456-426614174000');
    expect(snapshot.ruleName).toBe('Parts 2×');
    expect(snapshot.value).toBe(2);
    expect(snapshot.costSource).toBe('variant_cost');
  });

  it('matrix rule snapshots the matched band method, not "matrix"', () => {
    const matrix: MarkupRuleSpec = {
      method: 'matrix',
      bands: [
        { costMinCents: 0, costMaxCents: 5000, method: 'percentage', value: 1.0 },
        { costMinCents: 5001, costMaxCents: null, method: 'percentage', value: 0.3 },
      ],
    };
    const { result, snapshot } = priceLineByMarkup(
      10000, // $100 cost → top band, +30%
      { kind: 'rule', ruleId: 'r', ruleName: 'Tiered', spec: matrix, costSource: 'variant_cost' },
      AT
    );
    expect(result.priceCents).toBe(13000);
    expect(snapshot.method).toBe('percentage'); // effective band method
  });
});

describe('LineMarkupInput validation', () => {
  it('accepts a rule directive', () => {
    expect(
      LineMarkupInput.safeParse({ kind: 'rule', ruleId: '123e4567-e89b-12d3-a456-426614174000' })
        .success
    ).toBe(true);
  });

  it('rejects a negative percentage ad-hoc value', () => {
    const r = LineMarkupInput.safeParse({ kind: 'adhoc', method: 'percentage', value: -0.2 });
    expect(r.success).toBe(false);
  });

  it('rejects a margin_target outside (0,1)', () => {
    expect(
      LineMarkupInput.safeParse({ kind: 'adhoc', method: 'margin_target', value: 1.5 }).success
    ).toBe(false);
  });

  it('rejects a non-positive multiplier', () => {
    expect(
      LineMarkupInput.safeParse({ kind: 'adhoc', method: 'multiplier', value: 0 }).success
    ).toBe(false);
  });
});
