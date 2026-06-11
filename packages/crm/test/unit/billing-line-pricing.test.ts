// Billing line pricing — the arithmetic (non-DB) pricing modes (docs/87 §5).
// labor / flat / catalog-override / pass-through-at-cost resolve a unit price
// without reading the catalog, so they're exercised here with a tx that throws
// if touched. markup + catalog-by-variant need a live tx (integration suite).

import { describe, expect, it } from 'vitest';
import type { Prisma } from '@sparx/db';

import { priceBillingLine } from '../../src/services/billing-line-pricing';

// A tx that fails the test if any DB call is attempted.
const noTx = new Proxy(
  {},
  {
    get() {
      throw new Error('pricing touched the database for an arithmetic mode');
    },
  }
) as unknown as Prisma.TransactionClient;

describe('priceBillingLine (arithmetic modes)', () => {
  it('prices a labor line at its hourly rate (unit price)', async () => {
    const r = await priceBillingLine(noTx, 'tenant', { pricingMode: 'labor', unitPrice: 95 });
    expect(r).toEqual({ unitPrice: 95, costCents: null, appliedMarkup: null });
  });

  it('prices a flat fee at the given amount', async () => {
    const r = await priceBillingLine(noTx, 'tenant', { pricingMode: 'flat', unitPrice: 25 });
    expect(r).toEqual({ unitPrice: 25, costCents: null, appliedMarkup: null });
  });

  it('passes a sublet through at cost when no markup is given', async () => {
    const r = await priceBillingLine(noTx, 'tenant', {
      pricingMode: 'pass_through',
      explicitCostCents: 12000,
    });
    expect(r).toEqual({ unitPrice: 120, costCents: 12000, appliedMarkup: null });
  });

  it('honours an explicit unit price on a catalog line without reading the variant', async () => {
    const r = await priceBillingLine(noTx, 'tenant', {
      pricingMode: 'catalog',
      unitPrice: 49.99,
      variantId: 'ignored',
    });
    expect(r).toEqual({ unitPrice: 49.99, costCents: null, appliedMarkup: null });
  });

  it('rejects a labor line with no rate', async () => {
    await expect(priceBillingLine(noTx, 'tenant', { pricingMode: 'labor' })).rejects.toThrow(
      /hourly rate/
    );
  });

  it('rejects a markup line with no directive', async () => {
    await expect(priceBillingLine(noTx, 'tenant', { pricingMode: 'markup' })).rejects.toThrow(
      /markup rule/
    );
  });
});
