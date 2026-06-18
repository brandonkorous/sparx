// DB-backed coverage for the documented public API service surface (docs/06 §7,
// docs/100 P6a): `listInventory` (cross-warehouse enriched + paginated + search),
// `updateLevelCount` (absolute set vs signed delta, through the ledger), and
// `bulkAdjust` (SKU resolution + per-row isolation so one bad row can't roll back
// the rest). Requires `pnpm db:up`; skipped in CI per vitest.config.

import crypto from 'node:crypto';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { withTenant } from '@sparx/db';

import { listInventory, updateLevelCount, bulkAdjust } from '../../src/services/public-api.js';
import { createInventoryFixture, createTestTenant, dropTestTenant } from '../helpers.js';

describe('inventory public API', () => {
  let tenantId: string;
  let warehouseId: string;
  let warehouseCode: string;
  let otherWarehouseId: string;
  let variantA: string; // sku PA-ALPHA, title "Alpha Pump"
  let variantB: string; // sku PA-BETA,  title "Beta Filter"
  const ctx = (): { tenantId: string; userId: string } => ({ tenantId, userId });
  let userId: string;

  beforeAll(async () => {
    const t = await createTestTenant();
    tenantId = t.tenantId;
    userId = t.userId;
    const fixture = await createInventoryFixture(tenantId);
    warehouseId = fixture.warehouseId;

    warehouseCode = await withTenant(ctx(), async (tx) => {
      const w = await tx.warehouse.findUniqueOrThrow({ where: { id: warehouseId } });
      return w.code;
    });
    otherWarehouseId = await newWarehouse('WEST');
    variantA = await newVariant('PA-ALPHA', 'Alpha Pump');
    variantB = await newVariant('PA-BETA', 'Beta Filter');

    // Seed some stock so the level rows exist and carry on-hand.
    await updateLevelCount(ctx(), variantA, { warehouseId, onHand: 40, reason: 'recount' });
    await updateLevelCount(ctx(), variantB, { warehouseId, onHand: 10, reason: 'recount' });
    await updateLevelCount(ctx(), variantA, { warehouseId: otherWarehouseId, onHand: 5 });
  });
  afterAll(async () => {
    await dropTestTenant(tenantId);
  });

  async function newWarehouse(code: string): Promise<string> {
    const tag = crypto.randomBytes(3).toString('hex');
    return withTenant(ctx(), async (tx) => {
      const w = await tx.warehouse.create({
        data: { tenantId, name: `${code} WH`, code: `${code}-${tag}` },
      });
      return w.id;
    });
  }
  async function newVariant(sku: string, title: string): Promise<string> {
    const tag = crypto.randomBytes(3).toString('hex');
    return withTenant(ctx(), async (tx) => {
      const product = await tx.product.create({
        data: { tenantId, title, handle: `${sku.toLowerCase()}-${tag}`, status: 'active' },
      });
      const v = await tx.productVariant.create({
        data: { tenantId, productId: product.id, sku, priceCents: 1000, currency: 'USD' },
      });
      return v.id;
    });
  }

  it('lists levels across warehouses, enriched + paginated + searchable', async () => {
    const all = await listInventory(ctx(), {});
    // variantA at two warehouses + variantB at one = 3 levels.
    expect(all.total).toBe(3);
    const alphaMain = all.items.find(
      (r) => r.variantId === variantA && r.warehouseId === warehouseId
    );
    expect(alphaMain).toMatchObject({
      sku: 'PA-ALPHA',
      productTitle: 'Alpha Pump',
      warehouseCode,
      onHand: 40,
      available: 40,
    });

    // Pagination — total is the full count, the page is bounded by `take`.
    const firstPage = await listInventory(ctx(), { take: 2, skip: 0 });
    expect(firstPage.items).toHaveLength(2);
    expect(firstPage.total).toBe(3);

    // Search narrows by SKU or product title (case-insensitive).
    const byTitle = await listInventory(ctx(), { q: 'beta' });
    expect(byTitle.total).toBe(1);
    expect(byTitle.items[0]?.sku).toBe('PA-BETA');

    // Warehouse filter scopes the list.
    const west = await listInventory(ctx(), { warehouseId: otherWarehouseId });
    expect(west.total).toBe(1);
    expect(west.items[0]?.variantId).toBe(variantA);
  });

  it('updates a level by absolute set and by signed delta', async () => {
    // Absolute set computes the corrective delta against current on-hand.
    const set = await updateLevelCount(ctx(), variantB, { warehouseId, onHand: 25 });
    expect(set).toMatchObject({ onHand: 25, available: 25, appliedDelta: 15, deduped: false });

    // Signed delta is an ordinary movement.
    const dec = await updateLevelCount(ctx(), variantB, {
      warehouseId,
      delta: -5,
      reason: 'damage',
    });
    expect(dec).toMatchObject({ onHand: 20, available: 20, appliedDelta: -5 });

    // Re-asserting the same on-hand is an idempotent no-op (no ledger row).
    const noop = await updateLevelCount(ctx(), variantB, { warehouseId, onHand: 20 });
    expect(noop).toMatchObject({ onHand: 20, appliedDelta: 0, deduped: true });

    // The ledger invariant holds: on_hand == Σ(delta).
    const sum = await withTenant(ctx(), async (tx) => {
      const agg = await tx.inventoryMovement.aggregate({
        where: { variantId: variantB, warehouseId },
        _sum: { delta: true },
      });
      const level = await tx.inventoryLevel.findUniqueOrThrow({
        where: { variantId_warehouseId: { variantId: variantB, warehouseId } },
      });
      return { delta: agg._sum.delta ?? 0, onHand: level.onHand };
    });
    expect(sum.delta).toBe(sum.onHand);
  });

  it('bulk-adjusts with SKU resolution and per-row isolation', async () => {
    const before = await withTenant(ctx(), (tx) =>
      tx.inventoryLevel.findUniqueOrThrow({
        where: { variantId_warehouseId: { variantId: variantA, warehouseId } },
      })
    );

    const result = await bulkAdjust(ctx(), {
      adjustments: [
        { sku: 'PA-ALPHA', warehouseId, delta: 5, reason: 'receive' },
        { sku: 'DOES-NOT-EXIST', warehouseId, delta: 99, reason: 'receive' },
        { variantId: variantB, warehouseId, onHand: 100, reason: 'recount' },
      ],
    });

    expect(result.applied).toBe(2);
    expect(result.failed).toBe(1);
    expect(result.results[0]).toMatchObject({ status: 'applied', sku: 'PA-ALPHA' });
    expect(result.results[1]).toMatchObject({ status: 'error', sku: 'DOES-NOT-EXIST' });
    expect(result.results[2]).toMatchObject({ status: 'applied', onHand: 100 });

    // The good rows applied even though row 2 failed (per-row tx isolation).
    const after = await withTenant(ctx(), async (tx) => {
      const a = await tx.inventoryLevel.findUniqueOrThrow({
        where: { variantId_warehouseId: { variantId: variantA, warehouseId } },
      });
      const b = await tx.inventoryLevel.findUniqueOrThrow({
        where: { variantId_warehouseId: { variantId: variantB, warehouseId } },
      });
      return { a: a.onHand, b: b.onHand };
    });
    expect(after.a).toBe(before.onHand + 5);
    expect(after.b).toBe(100);
  });
});
