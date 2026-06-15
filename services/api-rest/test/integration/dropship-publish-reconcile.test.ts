// Printify "publishing" lockup fix. When a merchant clicks Publish in Printify,
// Printify LOCKS the product pending a callback from our integration; until we
// POST publishing_succeeded it's stuck "publishing". reconcileSupplierPublishes
// closes that handshake: for each locked product it (a) imports it into the
// catalog and (b) confirms the publish back. Pinned against real Postgres + RLS
// with a FAKE supplier adapter (so no Printify HTTP), asserting:
//   • a pending product is imported (product + variants + options + link) AND a
//     confirmPublish callback fires with our product id + handle;
//   • a re-run for an already-imported product re-confirms without re-importing;
//   • a per-product import failure reports publishing_failed (never left stuck).

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type { PendingPublish, PublishExternalRef, SupplierAdapter } from '@sparx/dropship';
import { withTenant } from '@sparx/db';
import { createApp } from '../../src/app.js';
import { reconcileSupplierPublishes } from '../../src/routes/v1/dropship/suppliers.js';
import { createTestTenant, dropTestTenant, type TestTenant } from '../helpers.js';

async function seedSupplier(t: TestTenant): Promise<string> {
  return withTenant({ tenantId: t.tenantId }, async (tx) => {
    const s = await tx.dropshipSupplier.create({
      data: { tenantId: t.tenantId, name: 'Printify Test', type: 'printify', status: 'active' },
      select: { id: true },
    });
    return s.id;
  });
}

// A Printify-shaped locked product: one Color option, two variants, each with its
// own mockup plus a shared one (exercises the per-variant image attach + dedupe).
function pendingTee(supplierProductId: string, skuPrefix: string): PendingPublish {
  return {
    supplierProductId,
    product: {
      supplierProductId,
      title: 'Publish-Me Tee',
      description: 'A made-to-order tee.',
      category: null,
      tags: ['tee'],
      imageUrls: ['https://img.test/hero.png'],
      variants: [
        {
          supplierSku: `${skuPrefix}:red`,
          title: 'Red',
          options: { Color: 'Red' },
          costPriceCents: 1000,
          msrpCents: 2400,
          inventoryQuantity: null,
          weight: 180,
          imageUrls: ['https://img.test/red.png', 'https://img.test/shared.png'],
        },
        {
          supplierSku: `${skuPrefix}:blue`,
          title: 'Blue',
          options: { Color: 'Blue' },
          costPriceCents: 1000,
          msrpCents: 2400,
          inventoryQuantity: null,
          weight: 180,
          imageUrls: ['https://img.test/blue.png', 'https://img.test/shared.png'],
        },
      ],
      raw: {},
    },
  };
}

// A fake adapter exposing only the publish handshake; records its callbacks.
function fakeAdapter(
  pending: PendingPublish[],
  log: {
    confirmed: { id: string; external: PublishExternalRef }[];
    failed: { id: string; reason: string }[];
  }
): SupplierAdapter {
  return {
    listPendingPublish: vi.fn(() => Promise.resolve(pending)),
    confirmPublish: vi.fn((id: string, external: PublishExternalRef) => {
      log.confirmed.push({ id, external });
      return Promise.resolve();
    }),
    failPublish: vi.fn((id: string, reason: string) => {
      log.failed.push({ id, reason });
      return Promise.resolve();
    }),
  } as unknown as SupplierAdapter;
}

describe('dropship publish reconcile — unlock the "publishing" handshake', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await createApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('imports a locked product and confirms the publish back', async () => {
    const t = await createTestTenant('owner');
    try {
      const supplierId = await seedSupplier(t);
      const log = {
        confirmed: [] as { id: string; external: PublishExternalRef }[],
        failed: [] as { id: string; reason: string }[],
      };
      const adapter = fakeAdapter([pendingTee('PUB-1', 'PUB1')], log);

      const summary = await reconcileSupplierPublishes(
        adapter,
        { tenantId: t.tenantId, supplierId, pricingRule: null, siteScopeIds: [] },
        () => Promise.resolve()
      );

      expect(summary).toMatchObject({ pending: 1, imported: 1, confirmed: 1, failed: 0 });

      // The commerce product exists with both variants, the Color option, and a link.
      const product = await withTenant({ tenantId: t.tenantId }, async (tx) => {
        const links = await tx.dropshipProductLink.findMany({
          where: { tenantId: t.tenantId, status: 'active' },
          select: { productId: true },
        });
        const productId = links[0]!.productId;
        return tx.product.findUniqueOrThrow({
          where: { id: productId },
          select: {
            handle: true,
            status: true,
            variants: { select: { sku: true } },
            options: { select: { name: true } },
            images: { select: { variantId: true } },
          },
        });
      });
      expect(product.status).toBe('draft');
      expect(product.variants.map((v) => v.sku).sort()).toEqual(['PUB1:blue', 'PUB1:red']);
      expect(product.options.map((o) => o.name)).toEqual(['Color']);
      // Per-variant images attached (2 each) + the product-level hero.
      expect(product.images.filter((i) => i.variantId !== null)).toHaveLength(4);

      // The confirm callback fired once, pointing Printify at our product + handle.
      expect(log.confirmed).toHaveLength(1);
      expect(log.confirmed[0]!.external.handle).toBe(product.handle);
      expect(log.confirmed[0]!.id).toBe('PUB-1');
      expect(log.failed).toHaveLength(0);
    } finally {
      await dropTestTenant(t.tenantId);
    }
  });

  it('re-confirms an already-imported product without re-importing', async () => {
    const t = await createTestTenant('owner');
    try {
      const supplierId = await seedSupplier(t);
      const log = {
        confirmed: [] as { id: string; external: PublishExternalRef }[],
        failed: [] as { id: string; reason: string }[],
      };
      const adapter = fakeAdapter([pendingTee('PUB-2', 'PUB2')], log);
      const deps = { tenantId: t.tenantId, supplierId, pricingRule: null, siteScopeIds: [] };

      const first = await reconcileSupplierPublishes(adapter, deps, () => Promise.resolve());
      expect(first).toMatchObject({ imported: 1, confirmed: 1 });

      const second = await reconcileSupplierPublishes(adapter, deps, () => Promise.resolve());
      // Already linked → no second import, but still re-confirmed (idempotent unlock).
      expect(second).toMatchObject({ pending: 1, imported: 0, confirmed: 1, failed: 0 });

      // Exactly one commerce product across both runs (no duplicate).
      const productCount = await withTenant({ tenantId: t.tenantId }, (tx) =>
        tx.product.count({ where: { tenantId: t.tenantId, deletedAt: null } })
      );
      expect(productCount).toBe(1);
    } finally {
      await dropTestTenant(t.tenantId);
    }
  });

  it('reports a publish failure when an import errors, never leaving it stuck', async () => {
    const t = await createTestTenant('owner');
    try {
      const supplierId = await seedSupplier(t);

      // Pre-create a variant whose sku collides with the pending product's first
      // variant — the unique (tenant, sku) constraint makes the import throw.
      await withTenant({ tenantId: t.tenantId }, async (tx) => {
        const p = await tx.product.create({
          data: {
            tenantId: t.tenantId,
            title: 'Existing',
            handle: `existing-${Date.now()}`,
            status: 'active',
          },
          select: { id: true },
        });
        await tx.productVariant.create({
          data: {
            tenantId: t.tenantId,
            productId: p.id,
            sku: 'CLASH:red',
            priceCents: 100,
            currency: 'USD',
          },
        });
      });

      const log = {
        confirmed: [] as { id: string; external: PublishExternalRef }[],
        failed: [] as { id: string; reason: string }[],
      };
      const adapter = fakeAdapter([pendingTee('PUB-3', 'CLASH')], log);

      const summary = await reconcileSupplierPublishes(
        adapter,
        { tenantId: t.tenantId, supplierId, pricingRule: null, siteScopeIds: [] },
        () => Promise.resolve()
      );

      // Import failed → reported as a publish failure (unlocks the product), not confirmed.
      expect(summary).toMatchObject({ pending: 1, imported: 0, confirmed: 0, failed: 1 });
      // The cause is captured (keyed by supplier product id) rather than swallowed.
      expect(summary.errors).toHaveLength(1);
      expect(summary.errors[0]).toContain('PUB-3');
      expect(log.confirmed).toHaveLength(0);
      expect(log.failed).toHaveLength(1);
      expect(log.failed[0]!.id).toBe('PUB-3');
    } finally {
      await dropTestTenant(t.tenantId);
    }
  });
});
