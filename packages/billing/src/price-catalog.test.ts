// Pure billing math — list-price totals + transaction-fee tiering (docs/17 §2).

import { describe, it, expect } from 'vitest';

import {
  MODULE_MONTHLY_CENTS,
  activeTotalCents,
  isBillableModule,
  transactionFeeRate,
} from './price-catalog';

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

describe('transactionFeeRate', () => {
  it('is 0% once monthly spend clears $299', () => {
    expect(
      transactionFeeRate({ monthlySpendCents: 299_00, commerceActive: true, crmActive: true })
    ).toBe(0);
  });

  it('is 0.3% with CRM active below the cap', () => {
    expect(
      transactionFeeRate({ monthlySpendCents: 98_00, commerceActive: true, crmActive: true })
    ).toBe(0.003);
  });

  it('is 0.5% with Commerce but no CRM below the cap', () => {
    expect(
      transactionFeeRate({ monthlySpendCents: 49_00, commerceActive: true, crmActive: false })
    ).toBe(0.005);
  });

  it('is 0 when neither Commerce nor CRM is active', () => {
    expect(
      transactionFeeRate({ monthlySpendCents: 10_00, commerceActive: false, crmActive: false })
    ).toBe(0);
  });
});
