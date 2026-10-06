import { describe, expect, it } from 'vitest';

import { buyingRuleProblem, buyingRuleWords, readRuleBox } from './trade-buying-rules';

// The trade pricing pane's buying rules (sparx persona issue 086). The server
// refuses the same settings; these are what staff are told while typing.

describe('buying rule boxes', () => {
  it('reads empty as no rule and refuses anything that is not a whole number', () => {
    expect(readRuleBox('')).toBeNull();
    expect(readRuleBox(' 12 ')).toBe(12);
    expect(readRuleBox('0')).toBe('invalid');
    expect(readRuleBox('2.5')).toBe('invalid');
  });

  it('says a minimum that is not a whole number of cases, with the nearest ones', () => {
    expect(buyingRuleProblem({ min: 30, max: null, caseOf: 12 })).toBe(
      'A minimum of 30 cannot be bought in cases of 12. Use 24 or 36.'
    );
    expect(buyingRuleProblem({ min: 24, max: 96, caseOf: 12 })).toBeNull();
  });

  it('says a minimum above the maximum', () => {
    expect(buyingRuleProblem({ min: 48, max: 24, caseOf: null })).toMatch(/more than the maximum/);
  });

  it('writes the rule as the row shows it', () => {
    expect(buyingRuleWords({ minOrderQty: 24, maxOrderQty: 96, orderMultiple: 12 })).toBe(
      'Sold in cases of 12 · at least 24 at a time · no more than 96 at a time'
    );
    expect(
      buyingRuleWords({ minOrderQty: null, maxOrderQty: null, orderMultiple: null })
    ).toBeNull();
  });
});
