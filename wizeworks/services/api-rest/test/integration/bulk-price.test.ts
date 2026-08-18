// Bulk price adjustment + 30-minute revert (docs/69 B-3) — service behaviour
// against real Postgres + RLS. Seeds a product with two variants, then exercises
// preview (no writes), apply (prices + revert ledger + product range), the
// reversible list, RLS isolation (another tenant can't undo it), revert
// (restores), and the double-revert guard.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { withTenant } from '@wizeworks/db';
import { bulkPriceService } from '@wizeworks/commerce';

import { createTestTenant, dropTestTenant, type TestTenant } from '../helpers.js';

describe('bulk price adjustment + revert', () => {
  let t1: TestTenant;
  let t2: TestTenant;
  let productId: string;

  const ctx1 = () => ({ tenantId: t1.tenantId, userId: t1.userId });
  const pricesAsc = (pid: string) =>
    withTenant(ctx1(), (tx) =>
      tx.productVariant.findMany({ where: { productId: pid }, orderBy: { sku: 'asc' } })
    ).then((vs) => vs.map((v) => v.priceCents));

  beforeAll(async () => {
    t1 = await createTestTenant('owner');
    t2 = await createTestTenant('owner');
    await withTenant(ctx1(), async (tx) => {
      const product = await tx.product.create({
        data: { tenantId: t1.tenantId, title: 'Widget', handle: `widget-${Date.now()}` },
      });
      productId = product.id;
      await tx.productVariant.create({
        data: { tenantId: t1.tenantId, productId, sku: 'W-1', priceCents: 1000, currency: 'USD' },
      });
      await tx.productVariant.create({
        data: { tenantId: t1.tenantId, productId, sku: 'W-2', priceCents: 2000, currency: 'USD' },
      });
      await tx.product.update({
        where: { id: productId },
        data: { priceMinCents: 1000, priceMaxCents: 2000 },
      });
    });
  });

  afterAll(async () => {
    await dropTestTenant(t1.tenantId);
    await dropTestTenant(t2.tenantId);
  });

  let opId: string;

  it('previews before→after without writing', async () => {
    const preview = await bulkPriceService.previewBulkPriceAdjust(ctx1(), {
      productIds: [productId],
      adjustment: { mode: 'percent', percent: 10 },
    });
    expect(preview.variantCount).toBe(2);
    expect(preview.changedVariantCount).toBe(2);
    const row = preview.products.find((p) => p.productId === productId)!;
    expect(row.currentMinCents).toBe(1000);
    expect(row.newMinCents).toBe(1100);
    expect(row.newMaxCents).toBe(2200);
    // Dry run — DB untouched.
    expect(await pricesAsc(productId)).toEqual([1000, 2000]);
  });

  it('applies, records the revert ledger, and refreshes the product range', async () => {
    const res = await bulkPriceService.applyBulkPriceAdjust(ctx1(), {
      productIds: [productId],
      adjustment: { mode: 'percent', percent: 10 },
    });
    opId = res.operationId;
    expect(res.productCount).toBe(1);
    expect(res.variantCount).toBe(2);

    expect(await pricesAsc(productId)).toEqual([1100, 2200]);

    const product = await withTenant(ctx1(), (tx) =>
      tx.product.findUniqueOrThrow({ where: { id: productId } })
    );
    expect(product.priceMinCents).toBe(1100);
    expect(product.priceMaxCents).toBe(2200);

    const reverts = await withTenant(ctx1(), (tx) =>
      tx.bulkOpRevert.findMany({ where: { operationId: opId } })
    );
    expect(reverts).toHaveLength(2);
    expect(reverts.every((r) => r.valueAfter > r.valueBefore && r.revertedAt === null)).toBe(true);
  });

  it('lists the operation as reversible', async () => {
    const ops = await bulkPriceService.listReversibleOps(ctx1());
    const op = ops.find((o) => o.operationId === opId)!;
    expect(op.productCount).toBe(1);
    expect(op.variantCount).toBe(2);
  });

  it('does not let another tenant revert it (RLS isolation)', async () => {
    await expect(
      bulkPriceService.revertBulkPriceAdjust({ tenantId: t2.tenantId, userId: t2.userId }, opId)
    ).rejects.toThrow();
    // Prices remain adjusted.
    expect(await pricesAsc(productId)).toEqual([1100, 2200]);
  });

  it('reverts within the window, restoring the original prices', async () => {
    const res = await bulkPriceService.revertBulkPriceAdjust(ctx1(), opId);
    expect(res.variantCount).toBe(2);

    expect(await pricesAsc(productId)).toEqual([1000, 2000]);
    const product = await withTenant(ctx1(), (tx) =>
      tx.product.findUniqueOrThrow({ where: { id: productId } })
    );
    expect(product.priceMinCents).toBe(1000);
    expect(product.priceMaxCents).toBe(2000);

    const ops = await bulkPriceService.listReversibleOps(ctx1());
    expect(ops.find((o) => o.operationId === opId)).toBeUndefined();
  });

  it('rejects a second revert of the same operation', async () => {
    await expect(bulkPriceService.revertBulkPriceAdjust(ctx1(), opId)).rejects.toThrow();
  });
});
