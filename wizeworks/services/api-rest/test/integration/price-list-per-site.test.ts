// Per-site price lists (docs/131 §4) — the CHARGE-CRITICAL slice. A price list is
// scoped to sites through the `PriceListProperty` junction (empty = every site), and
// `resolve()` must only apply a list eligible on the buyer's site — otherwise a
// sibling business's price list sets the price a customer actually pays.
//
// The Korous test, in dollars: one tenant, two sites. A price list on the parts site
// drops a variant from $100 to $80. On the parts site the resolved price is $80; on
// the donut site it stays $100 (the parts list does not apply). An unscoped resolve
// (no site — admin/preview) still sees the list, proving the filter is opt-in and the
// default stays backward-compatible.
//
// PREREQUISITES (this test cannot pass until they are done — authored as the
// post-migration regression guard, and because it is charge-critical it MUST be run,
// never trusted from a typecheck):
//   1. Apply migration 20270106_pricing_per_site (adds commerce_price_list_properties).
//   2. Regenerate the Prisma client so PriceList.propertyLinks exists.
// Then: `pnpm --filter @wizeworks/api-rest test -- price-list-per-site`.

import { describe, expect, it } from 'vitest';
import crypto from 'node:crypto';
import { invalidateModuleCache } from '@wizeworks/auth';
import { pricingService } from '@wizeworks/commerce';
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

// A variant priced at `priceCents`, and an ACTIVE price list linked to `propertyId`
// only, whose entry re-prices the variant to `listCents`.
async function seedVariantAndList(
  t: TestTenant,
  propertyId: string,
  priceCents: number,
  listCents: number
): Promise<{ variantId: string }> {
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
    const list = await tx.priceList.create({
      data: { tenantId: t.tenantId, name: 'Parts Sale', currency: 'USD', status: 'active' },
      select: { id: true },
    });
    // Scope the list to ONE site — the junction link is what this test exercises.
    await tx.priceListProperty.create({ data: { propertyId, priceListId: list.id } });
    await tx.priceListEntry.create({
      data: {
        tenantId: t.tenantId,
        priceListId: list.id,
        variantId: variant.id,
        fixedPriceCents: listCents,
        minQuantity: 1,
      },
    });
    return { variantId: variant.id };
  });
}

describe('price lists — per-site resolve (docs/131 §4)', () => {
  it('applies a site-scoped price list only on that site', async () => {
    const t = await createTestTenant('owner');
    try {
      await enableCommerce(t.tenantId);
      const ctx = { tenantId: t.tenantId };

      const parts = t.propertyId; // primary — Bob's Parts
      const donuts = await createSite(t, 'Savory Donuts');

      // $100 variant, dropped to $80 by a price list scoped to the parts site.
      const { variantId } = await seedVariantAndList(t, parts, 10000, 8000);

      const priceOn = (propertyId?: string) =>
        pricingService.resolve(ctx, {
          variantId,
          quantity: 1,
          channel: 'storefront',
          currency: 'USD',
          customerSegmentIds: [],
          ...(propertyId ? { propertyId } : {}),
        });

      // Parts: the list applies → $80. Donuts: it does NOT → base $100.
      expect((await priceOn(parts)).unitPriceCents).toBe(8000);
      expect((await priceOn(donuts)).unitPriceCents).toBe(10000);
      // Unscoped (admin/preview): sees every list → $80, so the filter is opt-in.
      expect((await priceOn()).unitPriceCents).toBe(8000);
    } finally {
      await dropTestTenant(t.tenantId);
    }
  });
});
