// Pure billing math — list-price totals + billable-module classification.

import { describe, it, expect } from 'vitest';

import { MODULE_MONTHLY_CENTS, activeTotalCents, isBillableModule } from './price-catalog';

describe('activeTotalCents', () => {
  it('sums the list prices of active modules', () => {
    // builder 1000 + commerce 4900 + cms 4900 = 10800
    expect(activeTotalCents(['builder', 'commerce', 'cms'])).toBe(10_800);
  });

  it('ignores modules with no list price (not separately billed)', () => {
    expect(activeTotalCents(['builder', 'inventory'])).toBe(MODULE_MONTHLY_CENTS.builder);
  });

  it('is zero for an empty plan', () => {
    expect(activeTotalCents([])).toBe(0);
  });
});

describe('isBillableModule', () => {
  it('marks priced modules billable and unpriced ones not', () => {
    expect(isBillableModule('commerce')).toBe(true);
    expect(isBillableModule('invoicing')).toBe(true);
    expect(isBillableModule('inventory')).toBe(false);
  });
});
