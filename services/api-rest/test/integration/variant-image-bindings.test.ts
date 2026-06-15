// Per-variant (and per-option-value) image bindings, pinned against real
// Postgres + RLS through the live authenticated route. This is the write side
// of the storefront "click a color, the photos match" behavior: an image row's
// `variant_id` decides which SKU it represents, and the PDP gallery prefers a
// resolved variant's own images. Covered here:
//   • PUT binds an existing image to a specific variant of its product;
//   • passing variantId: null clears it back to a product-level image;
//   • option-value bindings still work and leave variant_id null;
//   • a variant from a DIFFERENT product is rejected (cross-product guard).

import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { invalidateModuleCache } from '@sparx/auth';
import { prisma, withTenant } from '@sparx/db';
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

interface Fixture {
  productId: string;
  redValueId: string;
  blueValueId: string;
  redVariantId: string;
  blueVariantId: string;
  imageId: string;
}

// A product with a Color option (Red/Blue), one variant per color, and a single
// product-level image to (re)bind.
async function setupProduct(t: TestTenant, tag: string): Promise<Fixture> {
  return withTenant({ tenantId: t.tenantId }, async (tx) => {
    const product = await tx.product.create({
      data: { tenantId: t.tenantId, title: 'Tee', handle: `tee-${tag}`, status: 'active' },
      select: { id: true },
    });
    const option = await tx.productOption.create({
      data: { tenantId: t.tenantId, productId: product.id, name: 'Color', displayType: 'swatch' },
      select: { id: true },
    });
    const red = await tx.productOptionValue.create({
      data: { tenantId: t.tenantId, optionId: option.id, value: 'Red', position: 0 },
      select: { id: true },
    });
    const blue = await tx.productOptionValue.create({
      data: { tenantId: t.tenantId, optionId: option.id, value: 'Blue', position: 1 },
      select: { id: true },
    });
    const redVariant = await tx.productVariant.create({
      data: {
        tenantId: t.tenantId,
        productId: product.id,
        sku: `RED-${tag}`,
        priceCents: 1999,
        currency: 'USD',
        isDefault: true,
      },
      select: { id: true },
    });
    const blueVariant = await tx.productVariant.create({
      data: {
        tenantId: t.tenantId,
        productId: product.id,
        sku: `BLUE-${tag}`,
        priceCents: 1999,
        currency: 'USD',
      },
      select: { id: true },
    });
    await tx.productVariantOptionValue.createMany({
      data: [
        { variantId: redVariant.id, optionValueId: red.id },
        { variantId: blueVariant.id, optionValueId: blue.id },
      ],
    });
    const image = await tx.variantImage.create({
      data: {
        tenantId: t.tenantId,
        productId: product.id,
        mediaAssetId: randomUUID(),
        position: 0,
      },
      select: { id: true },
    });
    return {
      productId: product.id,
      redValueId: red.id,
      blueValueId: blue.id,
      redVariantId: redVariant.id,
      blueVariantId: blueVariant.id,
      imageId: image.id,
    };
  });
}

function imageRow(t: TestTenant, imageId: string) {
  return withTenant({ tenantId: t.tenantId }, (tx) =>
    tx.variantImage.findUniqueOrThrow({
      where: { id: imageId },
      select: { variantId: true, optionValueLinks: { select: { optionValueId: true } } },
    })
  );
}

describe('variant image bindings — bind to a variant, clear, option values, guard', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await createApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('binds an image to a variant, then clears it back to product-level', async () => {
    const t = await createTestTenant('owner');
    try {
      await enableCommerce(t.tenantId);
      const token = signToken(app, t, 'owner');
      const fx = await setupProduct(t, `bind-${Date.now()}`);

      // Bind to the Red variant.
      const bound = await app.inject({
        method: 'PUT',
        url: '/v1/commerce/variant-image-bindings',
        headers: authHeader(token),
        payload: { variantImageId: fx.imageId, variantId: fx.redVariantId },
      });
      expect(bound.statusCode).toBe(200);
      expect(await imageRow(t, fx.imageId)).toMatchObject({ variantId: fx.redVariantId });

      // Clear it (product-level again).
      const cleared = await app.inject({
        method: 'PUT',
        url: '/v1/commerce/variant-image-bindings',
        headers: authHeader(token),
        payload: { variantImageId: fx.imageId, variantId: null },
      });
      expect(cleared.statusCode).toBe(200);
      expect(await imageRow(t, fx.imageId)).toMatchObject({ variantId: null });
    } finally {
      await dropTestTenant(t.tenantId);
    }
  });

  it('option-value bindings still work and leave variant_id null', async () => {
    const t = await createTestTenant('owner');
    try {
      await enableCommerce(t.tenantId);
      const token = signToken(app, t, 'owner');
      const fx = await setupProduct(t, `optval-${Date.now()}`);

      const res = await app.inject({
        method: 'PUT',
        url: '/v1/commerce/variant-image-bindings',
        headers: authHeader(token),
        payload: { variantImageId: fx.imageId, optionValueIds: [fx.redValueId] },
      });
      expect(res.statusCode).toBe(200);
      const row = await imageRow(t, fx.imageId);
      expect(row.variantId).toBeNull();
      expect(row.optionValueLinks.map((l) => l.optionValueId)).toEqual([fx.redValueId]);
    } finally {
      await dropTestTenant(t.tenantId);
    }
  });

  it('rejects a variant that belongs to a different product', async () => {
    const t = await createTestTenant('owner');
    try {
      await enableCommerce(t.tenantId);
      const token = signToken(app, t, 'owner');
      const fx = await setupProduct(t, `a-${Date.now()}`);
      const other = await setupProduct(t, `b-${Date.now()}`);

      const res = await app.inject({
        method: 'PUT',
        url: '/v1/commerce/variant-image-bindings',
        headers: authHeader(token),
        payload: { variantImageId: fx.imageId, variantId: other.redVariantId },
      });
      expect(res.statusCode).toBe(404);
      // The image stays unbound — the bad write never landed.
      expect(await imageRow(t, fx.imageId)).toMatchObject({ variantId: null });
    } finally {
      await dropTestTenant(t.tenantId);
    }
  });
});
