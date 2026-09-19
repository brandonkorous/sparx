// THE TILL OFFERS WHAT THIS SITE SELLS.
//
// WHY THIS EXISTS. `GET /v1/commerce/variants` was labelled "Variants
// tenant-wide" and was. It answers two pickers — Take a sale, and the bundle
// builder — and both of them ask "what can I sell from where I am standing".
//
// Measured 2026-09-17 on a clothing maker who runs seven sites: her counter
// offered 108 versions where the site sells 75, sorted by title, so the first
// two rows under the search box were a $1,450 signet ring from her jewelry line
// and a $6,800 tennis bracelet sat four rows below. The products LIST in the
// same app showed 10 of her 34 products, correctly. Within one app the list was
// scoped and the till was not (issue 625, [[feedback_site_is_the_business]]).
//
// The rule is the platform's own `productSiteVisibilityWhere`: a product linked
// to NO site belongs to every site, one linked to sites belongs only to those.

import { describe, expect, it } from 'vitest';
import crypto from 'node:crypto';
import { invalidateModuleCache } from '@wizeworks/auth';
import { prisma, withTenant } from '@wizeworks/db';
import { createApp } from '../../src/app.js';
import {
  authHeader,
  createTestTenant,
  dropTestTenant,
  signToken,
  type TestTenant,
} from '../helpers.js';

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

/** One product with one version, pinned to the given sites — an empty list
 *  meaning no links at all, which the model reads as every site. */
async function seedProduct(t: TestTenant, title: string, sites: string[]): Promise<void> {
  await withTenant({ tenantId: t.tenantId }, async (tx) => {
    const product = await tx.product.create({
      data: {
        tenantId: t.tenantId,
        title,
        handle: `${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${crypto.randomBytes(3).toString('hex')}`,
        status: 'active',
        ...(sites.length > 0
          ? { propertyLinks: { create: sites.map((propertyId) => ({ propertyId })) } }
          : {}),
      },
      select: { id: true },
    });
    await tx.productVariant.create({
      data: {
        tenantId: t.tenantId,
        productId: product.id,
        sku: `SKU-${crypto.randomBytes(4).toString('hex')}`,
        priceCents: 1000,
        currency: 'USD',
      },
    });
  });
}

interface Row {
  productTitle: string;
}

function titles(res: { json: () => { data: Row[] } }): string[] {
  return res.json().data.map((r) => r.productTitle);
}

describe('the sellable catalog is the site you are standing on', () => {
  it('leaves another business out of this one’s till', async () => {
    const t = await createTestTenant('owner');
    const app = await createApp();
    try {
      await enableCommerce(t.tenantId);
      const shop = t.propertyId;
      const jewelry = await createSite(t, 'Astrid Fine');
      await seedProduct(t, 'The Everyday Tee', [shop]);
      await seedProduct(t, 'Astrid Signet Ring', [jewelry]);
      await seedProduct(t, 'Colette Tennis Bracelet', [jewelry]);
      const token = signToken(app, t);

      const res = await app.inject({
        method: 'GET',
        url: '/v1/commerce/variants',
        headers: { ...authHeader(token), 'x-sparx-property-id': shop },
      });

      // Before the fix all three were offered at the clothing counter.
      expect(titles(res)).toEqual(['The Everyday Tee']);
    } finally {
      await app.close();
      await dropTestTenant(t.tenantId);
    }
  });

  it('offers a product pinned to no site at every counter', async () => {
    // The platform's empty-means-all rule. A one-off she sells everywhere must
    // not disappear from a till because nobody pinned it.
    const t = await createTestTenant('owner');
    const app = await createApp();
    try {
      await enableCommerce(t.tenantId);
      const jewelry = await createSite(t, 'Astrid Fine');
      await seedProduct(t, 'Gift Wrap', []);
      const token = signToken(app, t);

      for (const [where, id] of [
        ['her shop', t.propertyId],
        ['her jewelry line', jewelry],
      ] as const) {
        const res = await app.inject({
          method: 'GET',
          url: '/v1/commerce/variants',
          headers: { ...authHeader(token), 'x-sparx-property-id': id },
        });
        expect(titles(res), where).toEqual(['Gift Wrap']);
      }
    } finally {
      await app.close();
      await dropTestTenant(t.tenantId);
    }
  });

  it('offers the other site’s stock when you are standing on the other site', async () => {
    // Scoping has to work in both directions, or it is a filter that happens to
    // hide the right rows once.
    const t = await createTestTenant('owner');
    const app = await createApp();
    try {
      await enableCommerce(t.tenantId);
      const jewelry = await createSite(t, 'Astrid Fine');
      await seedProduct(t, 'The Everyday Tee', [t.propertyId]);
      await seedProduct(t, 'Astrid Signet Ring', [jewelry]);
      const token = signToken(app, t);

      const res = await app.inject({
        method: 'GET',
        url: '/v1/commerce/variants',
        headers: { ...authHeader(token), 'x-sparx-property-id': jewelry },
      });

      expect(titles(res)).toEqual(['Astrid Signet Ring']);
    } finally {
      await app.close();
      await dropTestTenant(t.tenantId);
    }
  });

  it('reads the whole business only when asked for it by name', async () => {
    // The platform's convention, and this endpoint now keeps it: ABSENCE means
    // "the site I am working in", and `?property=all` is the explicit opt-out
    // (see `ALL_SITES` in lib/property.ts). Sending no header is how a donut
    // shop employee ends up looking at the machine shop, so absence must not be
    // the way across.
    const t = await createTestTenant('owner');
    const app = await createApp();
    try {
      await enableCommerce(t.tenantId);
      const jewelry = await createSite(t, 'Astrid Fine');
      await seedProduct(t, 'The Everyday Tee', [t.propertyId]);
      await seedProduct(t, 'Astrid Signet Ring', [jewelry]);
      const token = signToken(app, t);

      const noHeader = await app.inject({
        method: 'GET',
        url: '/v1/commerce/variants',
        headers: authHeader(token),
      });
      expect(titles(noHeader), 'no header falls back to her working site').toEqual([
        'The Everyday Tee',
      ]);

      const everywhere = await app.inject({
        method: 'GET',
        url: '/v1/commerce/variants?property=all',
        headers: authHeader(token),
      });
      expect(titles(everywhere).sort(), 'asked for by name').toEqual([
        'Astrid Signet Ring',
        'The Everyday Tee',
      ]);
    } finally {
      await app.close();
      await dropTestTenant(t.tenantId);
    }
  });
});
