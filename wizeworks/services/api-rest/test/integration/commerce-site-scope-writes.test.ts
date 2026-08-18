// The WRITE half of per-site scoping for price lists and discounts.
//
// WHY THIS EXISTS. Both junctions shipped read-only. `pricingService.resolve` filtered
// price lists on `propertyLinks` and `discount-service` filtered offer eligibility on
// `siteLinks` — and nothing in the codebase ever created a row in either. So on a tenant
// with two businesses, EVERY price list priced BOTH sites and EVERY discount code worked
// at both checkouts. The only writer of `commerce_price_list_properties` in the whole
// repo was `price-list-per-site.test.ts`, which hand-inserted the link it was testing —
// so the read path was proven and the feature behind it did not exist.
//
// That is why this suite drives the SERVICES rather than the tables: a test that inserts
// the junction itself can pass forever while no product code ever does.
//
// Both are charge-critical. A wrong price list changes what a customer is billed; a
// leaked discount code is money off an order the offer was never meant for.

import { describe, expect, it } from 'vitest';
import crypto from 'node:crypto';
import { invalidateModuleCache } from '@wizeworks/auth';
import { discountService, pricingService } from '@wizeworks/commerce';
import { prisma, withTenant } from '@wizeworks/db';
import { createTestTenant, dropTestTenant, type TestTenant } from '../helpers.js';

async function enableCommerce(tenantId: string): Promise<void> {
  await prisma.tenant.update({
    where: { id: tenantId },
    data: { settings: { modules: { commerce: { enabled: true } } } },
  });
  invalidateModuleCache();
}

async function createSite(t: TestTenant, name: string): Promise<string> {
  return withTenant({ tenantId: t.tenantId }, async (tx) => {
    const slug = `${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${crypto.randomBytes(3).toString('hex')}`;
    const row = await tx.property.create({
      data: { tenantId: t.tenantId, slug, name, isPrimary: false },
      select: { id: true },
    });
    return row.id;
  });
}

async function seedVariant(t: TestTenant, priceCents: number): Promise<string> {
  return withTenant({ tenantId: t.tenantId }, async (tx) => {
    const product = await tx.product.create({
      data: {
        tenantId: t.tenantId,
        title: 'Priced Widget',
        handle: `w-${crypto.randomBytes(4).toString('hex')}`,
        status: 'active',
      },
      select: { id: true },
    });
    const variant = await tx.productVariant.create({
      data: {
        tenantId: t.tenantId,
        productId: product.id,
        sku: `SKU-${crypto.randomBytes(4).toString('hex')}`,
        priceCents,
        currency: 'USD',
      },
      select: { id: true },
    });
    return variant.id;
  });
}

describe('per-site scoping — the write half', () => {
  it('a price list created for one site does not price the other', async () => {
    const t = await createTestTenant('owner');
    try {
      await enableCommerce(t.tenantId);
      const ctx = { tenantId: t.tenantId };
      const parts = t.propertyId;
      const donuts = await createSite(t, 'Savory Donuts');
      const variantId = await seedVariant(t, 10000); // $100

      // Created through the SERVICE, scoped at creation — the path that did not exist.
      const { id: listId } = await pricingService.createPriceList(ctx, {
        name: 'Parts Sale',
        currency: 'USD',
        status: 'active',
        propertyIds: [parts],
      });
      await pricingService.setPriceListEntry(ctx, {
        priceListId: listId,
        variantId,
        fixedPriceCents: 8000,
        minQuantity: 1,
      });

      const priceOn = (propertyId?: string) =>
        pricingService.resolve(ctx, {
          variantId,
          quantity: 1,
          channel: 'storefront',
          currency: 'USD',
          customerSegmentIds: [],
          ...(propertyId ? { propertyId } : {}),
        });

      expect((await priceOn(parts)).unitPriceCents).toBe(8000);
      // The whole point: before the write half existed, this was ALSO 8000.
      expect((await priceOn(donuts)).unitPriceCents).toBe(10000);

      // The scope comes back on the read, so the form can show what is set.
      expect((await pricingService.getPriceList(ctx, listId)).propertyIds).toEqual([parts]);
    } finally {
      await dropTestTenant(t.tenantId);
    }
  });

  it('an update replaces the scope, and omitting it leaves the scope alone', async () => {
    const t = await createTestTenant('owner');
    try {
      await enableCommerce(t.tenantId);
      const ctx = { tenantId: t.tenantId };
      const parts = t.propertyId;
      const donuts = await createSite(t, 'Savory Donuts');

      const { id } = await pricingService.createPriceList(ctx, {
        name: 'Seasonal',
        currency: 'USD',
        propertyIds: [parts],
      });

      await pricingService.updatePriceList(ctx, id, { propertyIds: [donuts] });
      expect((await pricingService.getPriceList(ctx, id)).propertyIds).toEqual([donuts]);

      // A plain rename must not touch the scope — nor unpublish the list, which is the
      // partial-update footgun the Update schema's overrides already guard.
      await pricingService.updatePriceList(ctx, id, { name: 'Seasonal 2' });
      const after = await pricingService.getPriceList(ctx, id);
      expect(after.propertyIds).toEqual([donuts]);
      expect(after.name).toBe('Seasonal 2');

      // An explicit empty list is the deliberate "every site" and DOES clear the rows.
      await pricingService.updatePriceList(ctx, id, { propertyIds: [] });
      expect((await pricingService.getPriceList(ctx, id)).propertyIds).toEqual([]);
    } finally {
      await dropTestTenant(t.tenantId);
    }
  });

  it("a discount created for one site is not eligible at the other's checkout", async () => {
    const t = await createTestTenant('owner');
    try {
      await enableCommerce(t.tenantId);
      const ctx = { tenantId: t.tenantId };
      const parts = t.propertyId;
      const donuts = await createSite(t, 'Savory Donuts');

      const { id } = await discountService.createDiscount(ctx, {
        name: 'Parts 10% off',
        code: 'PARTS10',
        type: 'percent',
        valuePercent: 10,
        propertyIds: [parts],
      });

      // The junction the cart's eligibility filter reads is now actually populated.
      expect((await discountService.getDiscount(ctx, id)).propertyIds).toEqual([parts]);

      // …and the filter the cart applies excludes it for the other business.
      const eligibleOn = (propertyId: string) =>
        withTenant(ctx, (tx) =>
          tx.discount.findMany({
            where: {
              deletedAt: null,
              OR: [{ siteLinks: { none: {} } }, { siteLinks: { some: { propertyId } } }],
            },
            select: { code: true },
          })
        ).then((rows) => rows.map((r) => r.code));

      expect(await eligibleOn(parts)).toContain('PARTS10');
      expect(await eligibleOn(donuts)).not.toContain('PARTS10');
    } finally {
      await dropTestTenant(t.tenantId);
    }
  });

  it('an unscoped discount still runs everywhere, so scoping stays opt-in', async () => {
    const t = await createTestTenant('owner');
    try {
      await enableCommerce(t.tenantId);
      const ctx = { tenantId: t.tenantId };
      const donuts = await createSite(t, 'Savory Donuts');

      const { id } = await discountService.createDiscount(ctx, {
        name: 'Everywhere',
        code: 'ALLSITES',
        type: 'percent',
        valuePercent: 5,
      });
      expect((await discountService.getDiscount(ctx, id)).propertyIds).toEqual([]);

      const eligible = await withTenant(ctx, (tx) =>
        tx.discount.findMany({
          where: {
            deletedAt: null,
            OR: [{ siteLinks: { none: {} } }, { siteLinks: { some: { propertyId: donuts } } }],
          },
          select: { code: true },
        })
      );
      expect(eligible.map((r) => r.code)).toContain('ALLSITES');
    } finally {
      await dropTestTenant(t.tenantId);
    }
  });
});
