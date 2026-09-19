// What the number beside a GROUP means.
//
// WHY THIS EXISTS. This is `category-product-counts.test.ts` one screen over, and
// it exists because that fix was never carried across. `collectionService`
// reported `productCount` as `_count.products` — a count of rows in the
// `commerce_collection_products` join table. A membership row outlives everything
// that would take its product off the website: archiving it, saving it back to
// draft, or scoping it to one of the tenant's other sites.
//
// Measured on Juniper Row (a clothing maker with seven sites) before the fix:
// Sell › Groups of products listed her eight clothing groups correctly, and beside
// the one called "New arrivals" it printed **5**. All five were jewelry and
// fragrance belonging to her other websites; nothing in that group is sold on the
// site she was standing on. The AISLE list one screen away already said "7 · 2 not
// shown" for exactly this reason (issue 382). The group list said 5 (issue 626).
//
// The predicate is now shared — `shopperVisibleProduct` in the commerce package's
// `site-visibility` — so the two lists cannot drift apart again by one of them
// being fixed.

import { describe, expect, it } from 'vitest';
import crypto from 'node:crypto';
import { invalidateModuleCache } from '@wizeworks/auth';
import { collectionService } from '@wizeworks/commerce';
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

interface Seeded {
  title: string;
  status?: string;
  sites?: string[];
  deleted?: boolean;
}

/** One group holding these products, each pinned to the given sites — an empty
 *  list meaning no links at all, which the model reads as every site. */
async function seedGroup(t: TestTenant, name: string, products: Seeded[]): Promise<string> {
  return withTenant({ tenantId: t.tenantId }, async (tx) => {
    const collection = await tx.productCollection.create({
      data: {
        tenantId: t.tenantId,
        name,
        handle: `${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${crypto.randomBytes(3).toString('hex')}`,
        type: 'manual',
      },
      select: { id: true },
    });
    for (const spec of products) {
      const product = await tx.product.create({
        data: {
          tenantId: t.tenantId,
          title: spec.title,
          handle: `${spec.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${crypto.randomBytes(3).toString('hex')}`,
          status: spec.status ?? 'active',
          ...(spec.deleted === true ? { deletedAt: new Date() } : {}),
          ...(spec.sites && spec.sites.length > 0
            ? { propertyLinks: { create: spec.sites.map((propertyId) => ({ propertyId })) } }
            : {}),
        },
        select: { id: true },
      });
      await tx.collectionProduct.create({
        data: { collectionId: collection.id, productId: product.id },
      });
    }
    return collection.id;
  });
}

describe('the number beside a group is what a shopper would find in it', () => {
  it('her group: five filed, none of them sold on this site', async () => {
    const t = await createTestTenant('owner');
    try {
      await enableCommerce(t.tenantId);
      const ctx = { tenantId: t.tenantId };
      const jewelry = await createSite(t, 'Astrid Fine');
      await seedGroup(t, 'New arrivals', [
        { title: 'Astrid Signet Ring', sites: [jewelry] },
        { title: 'Colette Tennis Bracelet', sites: [jewelry] },
        { title: 'Lune Pendant Necklace', sites: [jewelry] },
        { title: 'No 3 Black Rose and Oud', sites: [jewelry] },
        { title: 'The Four Eaux Discovery Set', sites: [jewelry] },
      ]);

      const { items } = await collectionService.list(ctx, { propertyId: t.propertyId });
      const row = items.find((i) => i.name === 'New arrivals');

      // It read 5 before the fix, over a group page holding nothing.
      expect(row?.productCount, 'on her clothing site').toBe(0);
      // And the row must SAY so, or a truthful 0 reads as "my products vanished".
      expect(row?.hiddenProductCount, 'said out loud on the row').toBe(5);
    } finally {
      await dropTestTenant(t.tenantId);
    }
  });

  it('counts the same group correctly from the site that does sell it', async () => {
    const t = await createTestTenant('owner');
    try {
      await enableCommerce(t.tenantId);
      const ctx = { tenantId: t.tenantId };
      const jewelry = await createSite(t, 'Astrid Fine');
      await seedGroup(t, 'New arrivals', [
        { title: 'Astrid Signet Ring', sites: [jewelry] },
        { title: 'Colette Tennis Bracelet', sites: [jewelry] },
      ]);

      const { items } = await collectionService.list(ctx, { propertyId: jewelry });
      const row = items.find((i) => i.name === 'New arrivals');
      expect(row?.productCount).toBe(2);
      expect(row?.hiddenProductCount).toBe(0);
    } finally {
      await dropTestTenant(t.tenantId);
    }
  });

  it('leaves out a draft and an archived product, like the shop page does', async () => {
    // The other two ways a membership row outlives what it points at. The aisle
    // list has excluded these since issue 382; this list did not.
    const t = await createTestTenant('owner');
    try {
      await enableCommerce(t.tenantId);
      const ctx = { tenantId: t.tenantId };
      await seedGroup(t, 'Winter layers', [
        { title: 'Ridge Wool Coat' },
        { title: 'Marlow Knit', status: 'draft' },
        { title: 'Old Parka', status: 'archived' },
      ]);

      const { items } = await collectionService.list(ctx, { propertyId: t.propertyId });
      const row = items.find((i) => i.name === 'Winter layers');
      expect(row?.productCount, 'only the one on sale').toBe(1);
      expect(row?.hiddenProductCount, 'the draft and the archived one').toBe(2);
    } finally {
      await dropTestTenant(t.tenantId);
    }
  });

  it('does not count a soft-deleted product as filed either', async () => {
    // A deleted product is not in the group at all, so it belongs in NEITHER
    // number — not the visible one, and not the "not shown" footnote, which
    // would otherwise promise something is there to recover.
    const t = await createTestTenant('owner');
    try {
      await enableCommerce(t.tenantId);
      const ctx = { tenantId: t.tenantId };
      await seedGroup(t, 'Last chance', [
        { title: 'The Ash Overshirt' },
        { title: 'Binned Shirt', deleted: true },
      ]);

      const { items } = await collectionService.list(ctx, { propertyId: t.propertyId });
      const row = items.find((i) => i.name === 'Last chance');
      expect(row?.productCount).toBe(1);
      expect(row?.hiddenProductCount).toBe(0);
    } finally {
      await dropTestTenant(t.tenantId);
    }
  });

  it('gives the PANE the same two numbers as the row', async () => {
    // The pane used to read `productCount` on its own and word a sentence from
    // it. Both have to come from the same place or the row and the pane it
    // opens disagree in front of somebody.
    const t = await createTestTenant('owner');
    try {
      await enableCommerce(t.tenantId);
      const ctx = { tenantId: t.tenantId };
      const jewelry = await createSite(t, 'Astrid Fine');
      const id = await seedGroup(t, 'New arrivals', [
        { title: 'Astrid Signet Ring', sites: [jewelry] },
        { title: 'The Everyday Tee', sites: [t.propertyId] },
      ]);

      const detail = await collectionService.get(ctx, id, t.propertyId);
      expect(detail.productCount).toBe(1);
      expect(detail.hiddenProductCount).toBe(1);
    } finally {
      await dropTestTenant(t.tenantId);
    }
  });

  it('answers for the whole business when no site is named', async () => {
    // A caller standing nowhere gets what the business holds, not one site's
    // slice — the same rule `categoryService` follows.
    const t = await createTestTenant('owner');
    try {
      await enableCommerce(t.tenantId);
      const ctx = { tenantId: t.tenantId };
      const jewelry = await createSite(t, 'Astrid Fine');
      await seedGroup(t, 'New arrivals', [
        { title: 'Astrid Signet Ring', sites: [jewelry] },
        { title: 'The Everyday Tee', sites: [t.propertyId] },
      ]);

      const { items } = await collectionService.list(ctx, {});
      const row = items.find((i) => i.name === 'New arrivals');
      expect(row?.productCount).toBe(2);
      expect(row?.hiddenProductCount).toBe(0);
    } finally {
      await dropTestTenant(t.tenantId);
    }
  });
});
