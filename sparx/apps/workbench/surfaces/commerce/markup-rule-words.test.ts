// Markup rules, as an owner reads and writes them (sparx persona issue 086).
//
// The /b2b page says "set line-item pricing (markup rules help)", and no screen
// could make one: rules existed only through the API. These pin the sentence a
// rule is summed up in, and that the form's numbers reach the server in the
// units it stores (40% is 0.4; $15 is 15; a cost range is in cents).

import { describe, expect, it } from 'vitest';
import {
  describeRule,
  draftErrors,
  emptyRuleDraft,
  examplePrice,
  ruleDraftFrom,
  rulePayload,
  ruleSentence,
  type MarkupRuleRow,
} from './markup-rule-words';

const row = (over: Partial<MarkupRuleRow> = {}): MarkupRuleRow => ({
  id: 'r1',
  name: 'Parts plus 40',
  method: 'percentage',
  value: 0.4,
  bands: [],
  costBasis: 'variant_cost',
  rounding: { strategy: 'none' },
  floorProfitCents: null,
  floorMargin: null,
  ceilingSrc: 'none',
  ceilingValueCents: null,
  appliesTo: 'document',
  scope: { type: 'all' },
  priority: 0,
  isActive: true,
  recomputeMode: 'auto',
  recomputeTolerancePct: null,
  boundVariantCount: 0,
  createdAt: '2026-10-02T17:00:00.000Z',
  updatedAt: '2026-10-02T17:00:00.000Z',
  ...over,
});

describe('describeRule', () => {
  it('says what each kind of rule does to a cost', () => {
    expect(describeRule(row())).toBe('Adds 40% to the cost.');
    expect(describeRule(row({ method: 'multiplier', value: 2.5 }))).toBe(
      'Multiplies the cost by 2.5.'
    );
    expect(describeRule(row({ method: 'flat', value: 15 }))).toBe('Adds $15.00 to the cost.');
    expect(describeRule(row({ method: 'margin_target', value: 0.45 }))).toBe(
      'Prices for a 45% margin.'
    );
    expect(
      describeRule(
        row({
          method: 'matrix',
          value: null,
          bands: [
            { costMinCents: 0, costMaxCents: 10_000, method: 'percentage', value: 1 },
            { costMinCents: 10_000, costMaxCents: null, method: 'percentage', value: 0.4 },
          ],
        })
      )
    ).toBe('Marks up by what it costs, in 2 cost ranges.');
  });
});

describe('ruleSentence', () => {
  // The product Pricing tab summed a rule up by matching `percent` and `fixed`,
  // names the server never sends, so every rule there read "Works the price out
  // from what you last paid" (sparx persona issue 086).
  it('says what the rule does and which cost it starts from', () => {
    expect(ruleSentence({ method: 'percentage', value: 0.4, costBasis: 'variant_cost' })).toBe(
      'Adds 40% to the cost. Starts from the cost on the product.'
    );
    expect(ruleSentence({ method: 'flat', value: 15, costBasis: 'supplier_cost' })).toBe(
      "Adds $15.00 to the cost. Starts from your supplier's current cost."
    );
  });
});

describe('the form and the server', () => {
  it('sends a percentage as the fraction the server stores', () => {
    const draft = { ...emptyRuleDraft(), name: 'Parts plus 40', value: '40' };
    expect(rulePayload(draft)).toMatchObject({ method: 'percentage', value: 0.4 });
  });

  it('reads a stored rule back in the units it was typed in', () => {
    const draft = ruleDraftFrom(row({ method: 'margin_target', value: 0.45 }));
    expect(draft.value).toBe('45');
    expect(ruleDraftFrom(row({ method: 'flat', value: 15 })).value).toBe('15');
  });

  it('sends cost ranges in cents, and an open top range as no ceiling', () => {
    const draft = {
      ...emptyRuleDraft(),
      name: 'By cost',
      method: 'matrix' as const,
      bands: [
        { from: '0', to: '100', method: 'percentage' as const, value: '100' },
        { from: '100', to: '', method: 'multiplier' as const, value: '1.5' },
      ],
    };
    expect(rulePayload(draft).bands).toEqual([
      { costMinCents: 0, costMaxCents: 10_000, method: 'percentage', value: 1 },
      { costMinCents: 10_000, costMaxCents: null, method: 'multiplier', value: 1.5 },
    ]);
    expect(rulePayload(draft).value).toBeNull();
  });

  it('keeps a scope it cannot edit here exactly as it was', () => {
    const scope = { type: 'products' as const, ids: ['p1', 'p2'] };
    expect(rulePayload(ruleDraftFrom(row({ scope }))).scope).toEqual(scope);
  });

  it('round-trips a stored rule without changing it', () => {
    const stored = row({
      rounding: { strategy: 'charm', endingCents: 99 },
      floorProfitCents: 500,
      floorMargin: 20,
      ceilingSrc: 'fixed',
      ceilingValueCents: 90_000,
      appliesTo: 'both',
      scope: { type: 'vendor', value: 'Bosch' },
      priority: 3,
      recomputeMode: 'review',
      recomputeTolerancePct: 15,
    });
    expect(rulePayload(ruleDraftFrom(stored))).toEqual({
      name: stored.name,
      method: 'percentage',
      value: 0.4,
      bands: [],
      costBasis: 'variant_cost',
      rounding: { strategy: 'charm', endingCents: 99 },
      floorProfitCents: 500,
      floorMargin: 20,
      ceilingSrc: 'fixed',
      ceilingValueCents: 90_000,
      appliesTo: 'both',
      scope: { type: 'vendor', value: 'Bosch' },
      priority: 3,
      isActive: true,
      recomputeMode: 'review',
      recomputeTolerancePct: 15,
    });
  });
});

describe('draftErrors', () => {
  it('names the field that is wrong, in words', () => {
    const errors = draftErrors({ ...emptyRuleDraft(), value: '' });
    expect(errors.name).toBe('Give this rule a name.');
    expect(errors.value).toBe('Enter a number.');
  });

  it('refuses a target margin of 100% or more, which no price can reach', () => {
    const errors = draftErrors({
      ...emptyRuleDraft(),
      name: 'x',
      method: 'margin_target',
      value: '100',
    });
    expect(errors.value).toBe('A margin has to be more than 0% and less than 100%.');
  });

  it('refuses a cost range that ends before it starts', () => {
    const errors = draftErrors({
      ...emptyRuleDraft(),
      name: 'x',
      method: 'matrix',
      bands: [{ from: '50', to: '10', method: 'percentage', value: '40' }],
    });
    expect(errors.bands).toBe('Range 1 ends before it starts.');
  });
});

describe('examplePrice', () => {
  it('shows what a $100 cost sells for under the rule being typed', () => {
    const example = examplePrice({ ...emptyRuleDraft(), name: 'x', value: '40' });
    expect(example).toEqual({ costCents: 10_000, priceCents: 14_000, marginPct: 28.6 });
  });

  it('shows nothing while the rule cannot price yet', () => {
    expect(examplePrice({ ...emptyRuleDraft(), value: '' })).toBeNull();
  });
});
