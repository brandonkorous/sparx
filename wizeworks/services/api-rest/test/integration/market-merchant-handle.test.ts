// sparx.market merchant identity — a site-chosen global handle (docs/131 §7).
//
// Before, the public merchant URL `/merchants/{slug}` used the TENANT slug, so two
// sibling businesses under one owner shared a URL namespace that disclosed the shared
// owner. Now the merchant IS a specific SITE with a globally-unique, site-chosen handle:
// the projection's slug is the handle (never the tenant slug), and the merchant name is
// the marketed Property's name (never the legal Tenant name).
//
// PREREQUISITES (migration-gated — authored as the post-migration guard):
//   1. Apply migration 20270107_market_merchant_handle (adds handle + market_property_id).
//   2. Regenerate the Prisma client so MarketMerchantProfile.handle exists.
// Then: `pnpm --filter @wizeworks/api-rest test -- market-merchant-handle`.

import { describe, expect, it } from 'vitest';
import crypto from 'node:crypto';
import { invalidateModuleCache } from '@wizeworks/auth';
import { marketService } from '@wizeworks/commerce';
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

describe('sparx.market merchant identity — site-chosen handle (docs/131 §7)', () => {
  it('projects the merchant under its handle + marketed-site name, not the tenant slug', async () => {
    // A FRESH handle per run. The handle is GLOBALLY unique, so a fixed one makes this
    // test pass exactly once against a given database and fail forever after — which is
    // what happened: an earlier run died before its cleanup, and every subsequent run of
    // the entire api-rest suite failed on a unique violation deep inside the projection
    // writer. Randomising means an abandoned row costs the next run nothing.
    const handle = `savory-donuts-${crypto.randomBytes(3).toString('hex')}`;
    const t = await createTestTenant('owner');
    try {
      await enableCommerce(t.tenantId);
      const ctx = { tenantId: t.tenantId, userId: t.userId };

      // The tenant markets AS "Savory Donuts" (a specific site), NOT as the tenant.
      const donuts = await createSite(t, 'Savory Donuts');
      const tenant = await prisma.tenant.findUniqueOrThrow({
        where: { id: t.tenantId },
        select: { slug: true },
      });

      // Claim a handle + market site, and list a product so the merchant projects.
      await withTenant({ tenantId: t.tenantId }, (tx) =>
        tx.product.create({
          data: {
            tenantId: t.tenantId,
            title: 'Glazed Dozen',
            handle: `dozen-${Date.now()}`,
            status: 'active',
            marketListed: true,
          },
        })
      );
      await marketService.updateMerchantProfile(ctx, {
        enabled: true,
        marketPropertyId: donuts,
        handle,
      });

      // The public projection: slug = the handle (NOT the tenant slug), name = the
      // marketed site's name.
      const merchant = await marketService.getMerchant(handle);
      expect(merchant).not.toBeNull();
      expect(merchant?.slug).toBe(handle);
      expect(merchant?.slug).not.toBe(tenant.slug);
      expect(merchant?.name).toBe('Savory Donuts');

      // A second tenant cannot claim the same handle (global uniqueness).
      const other = await createTestTenant('owner');
      try {
        await enableCommerce(other.tenantId);
        await expect(
          marketService.updateMerchantProfile(
            { tenantId: other.tenantId, userId: other.userId },
            { enabled: true, handle }
          )
        ).rejects.toThrow(/already taken/i);
      } finally {
        await dropTestTenant(other.tenantId);
      }
    } finally {
      await dropTestTenant(t.tenantId);
    }
  });
});
