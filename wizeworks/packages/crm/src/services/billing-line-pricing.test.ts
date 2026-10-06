import { describe, expect, it, vi } from 'vitest';

/**
 * EVERY LINE THAT HAS A COST KEEPS IT (sparx persona issue 086).
 *
 * The /b2b page promises "Margin shows as you price, off the cost basis". The
 * line editor asked for "Cost to you" on every line and said it was how you see
 * your margin, and then this function threw it away on a flat or labor line, and
 * on a catalog line whose price was changed from the list price (a trade price,
 * or one typed by hand). A margin can only be shown off a cost that was kept.
 */

import type { Prisma } from '@wizeworks/db';
import { priceBillingLine } from './billing-line-pricing';

const TENANT = '5944fe23-be83-4ce5-aafc-ef56b8594508';
const INJECTOR = '0b8f2c1e-4d3a-4f5b-9c6d-7e8f9a0b1c2d';

/** A transaction that knows one part: listed at $600.00, costing $412.50. */
function txWith(variant: { priceCents: number; costCents: number | null } | null) {
  return {
    productVariant: {
      findFirst: vi.fn(() =>
        Promise.resolve(
          variant ? { ...variant, compareAtPriceCents: null, coreChargeCents: null } : null
        )
      ),
    },
  } as unknown as Prisma.TransactionClient;
}

const part = { priceCents: 60_000, costCents: 41_250 };

describe('priceBillingLine keeps the cost', () => {
  it('on a flat line, the cost typed for it', async () => {
    const priced = await priceBillingLine(txWith(null), TENANT, {
      pricingMode: 'flat',
      unitPrice: 180,
      explicitCostCents: 9_500,
    });
    expect(priced.unitPrice).toBe(180);
    expect(priced.costCents).toBe(9_500);
  });

  it('on a labor line, the cost of an hour typed for it', async () => {
    const priced = await priceBillingLine(txWith(null), TENANT, {
      pricingMode: 'labor',
      unitPrice: 145,
      explicitCostCents: 6_200,
    });
    expect(priced.costCents).toBe(6_200);
  });

  it('on a flat line that names a part, the part cost when none was typed', async () => {
    const priced = await priceBillingLine(txWith(part), TENANT, {
      pricingMode: 'flat',
      unitPrice: 550,
      variantId: INJECTOR,
    });
    expect(priced.costCents).toBe(41_250);
  });

  it('on a catalog line at a changed price, the part cost', async () => {
    // A trade price, $528.00 instead of the $600.00 list price.
    const priced = await priceBillingLine(txWith(part), TENANT, {
      pricingMode: 'catalog',
      unitPrice: 528,
      variantId: INJECTOR,
    });
    expect(priced.unitPrice).toBe(528);
    expect(priced.costCents).toBe(41_250);
  });

  it('on a catalog line, a cost typed over the part cost', async () => {
    const atList = await priceBillingLine(txWith(part), TENANT, {
      pricingMode: 'catalog',
      variantId: INJECTOR,
      explicitCostCents: 39_000,
    });
    expect(atList.unitPrice).toBe(600);
    expect(atList.costCents).toBe(39_000);

    const changed = await priceBillingLine(txWith(part), TENANT, {
      pricingMode: 'catalog',
      unitPrice: 528,
      variantId: INJECTOR,
      explicitCostCents: 39_000,
    });
    expect(changed.costCents).toBe(39_000);
  });

  it('on a catalog line at list price, the part cost, as before', async () => {
    const priced = await priceBillingLine(txWith(part), TENANT, {
      pricingMode: 'catalog',
      variantId: INJECTOR,
    });
    expect(priced.unitPrice).toBe(600);
    expect(priced.costCents).toBe(41_250);
  });
});

describe('priceBillingLine never invents a cost', () => {
  it('leaves a flat line with no cost and no part at null, never 0', async () => {
    // Absence is not a measurement: a $0 cost would report a 100% margin.
    const priced = await priceBillingLine(txWith(null), TENANT, {
      pricingMode: 'flat',
      unitPrice: 0,
    });
    expect(priced.costCents).toBeNull();
  });

  it('leaves a line whose part has no cost on record at null', async () => {
    const priced = await priceBillingLine(txWith({ priceCents: 60_000, costCents: null }), TENANT, {
      pricingMode: 'catalog',
      unitPrice: 528,
      variantId: INJECTOR,
    });
    expect(priced.costCents).toBeNull();
  });

  it('keeps a typed cost of zero, because zero was typed', async () => {
    const priced = await priceBillingLine(txWith(null), TENANT, {
      pricingMode: 'flat',
      unitPrice: 40,
      explicitCostCents: 0,
    });
    expect(priced.costCents).toBe(0);
  });
});
