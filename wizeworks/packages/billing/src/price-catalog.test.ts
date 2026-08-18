// Pure billing math — list-price totals + billable-module classification.

import { describe, it, expect } from 'vitest';

import { MODULE_MONTHLY_CENTS, activeTotalCents, isBillableModule } from './price-catalog';

describe('activeTotalCents', () => {
  it('sums the list prices of active modules', () => {
    // builder 1000 + commerce 4900 + cms 4900 = 10800
    expect(activeTotalCents(['builder', 'commerce', 'cms'])).toBe(10_800);
  });

  it('sums raw list prices — bundling discounts are applied by the module graph, not here', () => {
    // `inventory` carries a $29 standalone list price; its BUNDLED_FREE discount
    // (when Commerce/B2B is active) is resolved upstream — the bundled tenant
    // simply never has an explicit `inventory` flag — so this pure price sum still
    // counts it when it's listed as active.
    expect(activeTotalCents(['builder', 'inventory'])).toBe(
      (MODULE_MONTHLY_CENTS.builder ?? 0) + (MODULE_MONTHLY_CENTS.inventory ?? 0)
    );
  });

  it('is zero for an empty plan', () => {
    expect(activeTotalCents([])).toBe(0);
  });
});

describe('isBillableModule', () => {
  it('marks priced modules billable', () => {
    expect(isBillableModule('commerce')).toBe(true);
    expect(isBillableModule('invoicing')).toBe(true);
    // Inventory is billable at $29 standalone (BUNDLED_FREE with Commerce/B2B is a
    // module-graph concern, not a price-catalog one).
    expect(isBillableModule('inventory')).toBe(true);
  });
});
