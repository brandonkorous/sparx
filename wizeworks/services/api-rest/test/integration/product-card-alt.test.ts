// The description an owner writes for a photo travels with the CARD, not only
// with the product page (issue 338).
//
// The console's Photos tab labels the field "Description for screen readers" and
// promises it is "read aloud to shoppers who cannot see the picture" — no
// qualification. The list select fetched the thumbnail's id and nothing else, so
// every shop grid, home rail and search result announced the product title,
// which is already the heading beside it, and the sentence she wrote was used on
// exactly one page.
//
// These go through the real HTTP routes so the SELECT is what is under test: a
// mapper reading a field the query never asked for returns undefined and passes
// a unit test that hands it a hand-built row.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import crypto from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { invalidateModuleCache } from '@wizeworks/auth';
import { prisma, withTenant } from '@wizeworks/db';
import { createApp } from '../../src/app.js';
import { createTestTenant, dropTestTenant, type TestTenant } from '../helpers.js';

const DESCRIBED = 'A bone corduroy overshirt with a collar and patch pockets, worn open.';
/** The description on the FILE, not on the photo-on-this-product. Deliberately
 *  describes something else: one media asset can be attached to several
 *  products, which is how a belt came to carry a photograph the library still
 *  calls a tote bag. */
const ASSET_LEVEL = 'A tan vegetable-tanned leather tote bag';

interface Fixture {
  tenant: TestTenant;
  slug: string;
  describedHandle: string;
  bareHandle: string;
}

async function seedProductWithPhoto(
  t: TestTenant,
  handle: string,
  title: string,
  alt: string | null
): Promise<void> {
  await withTenant({ tenantId: t.tenantId }, async (tx) => {
    const product = await tx.product.create({
      data: { tenantId: t.tenantId, title, handle, status: 'active' },
      select: { id: true },
    });
    const asset = await tx.mediaAsset.create({
      data: {
        tenantId: t.tenantId,
        key: `test/${handle}.jpg`,
        originalFilename: `${handle}.jpg`,
        mimeType: 'image/jpeg',
        byteSize: BigInt(412_000),
        altText: ASSET_LEVEL,
      },
      select: { id: true },
    });
    await tx.variantImage.create({
      data: {
        tenantId: t.tenantId,
        productId: product.id,
        mediaAssetId: asset.id,
        isPrimary: true,
        position: 0,
        alt,
      },
    });
  });
}

describe('the description written for a photo reaches the card', () => {
  let app: FastifyInstance;
  let fx: Fixture;

  beforeAll(async () => {
    app = await createApp();
    await app.ready();
    const tenant = await createTestTenant('owner');
    await prisma.tenant.update({
      where: { id: tenant.tenantId },
      data: { settings: { modules: { commerce: { enabled: true } } } },
    });
    invalidateModuleCache();
    const row = await prisma.tenant.findUniqueOrThrow({
      where: { id: tenant.tenantId },
      select: { slug: true },
    });
    const suffix = crypto.randomBytes(3).toString('hex');
    fx = {
      tenant,
      slug: row.slug,
      describedHandle: `overshirt-${suffix}`,
      bareHandle: `belt-${suffix}`,
    };
    await seedProductWithPhoto(tenant, fx.describedHandle, 'The Ash Overshirt', DESCRIBED);
    await seedProductWithPhoto(tenant, fx.bareHandle, 'Leather-covered belt', null);
  });

  afterAll(async () => {
    await app.close();
    await dropTestTenant(fx.tenant.tenantId);
  });

  async function listed(handle: string): Promise<Record<string, unknown>> {
    const res = await app.inject({
      method: 'GET',
      url: `/v1/public/commerce/products?tenant=${fx.slug}`,
    });
    expect(res.statusCode).toBe(200);
    const items = res.json().data as Record<string, unknown>[];
    const found = items.find((p) => p.handle === handle);
    expect(found, `no card for ${handle}`).toBeDefined();
    return found!;
  }

  it('carries her sentence on the list card, not just the product page', async () => {
    expect((await listed(fx.describedHandle)).primaryImageAlt).toBe(DESCRIBED);

    const detail = await app.inject({
      method: 'GET',
      url: `/v1/public/commerce/products/${fx.describedHandle}?tenant=${fx.slug}`,
    });
    expect(detail.statusCode).toBe(200);
    // The two pages agree, which is the whole point — the card was the odd one
    // out, and a fix that only moved the disagreement is not a fix.
    expect(detail.json().data.primaryImageAlt).toBe(DESCRIBED);
    expect(detail.json().data.images[0].alt).toBe(DESCRIBED);
  });

  it('says nothing when she has written nothing, rather than the file description', async () => {
    // Null, not ASSET_LEVEL. The storefront falls back to the product title, so
    // this card announces "Leather-covered belt" — and never "a tan
    // vegetable-tanned leather tote bag", which is what the shared library row
    // for that photograph actually says.
    expect((await listed(fx.bareHandle)).primaryImageAlt).toBeNull();
  });
});
