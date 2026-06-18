// DB-backed coverage for the inventory analytics surface (docs/100 P6b): valuation,
// turnover / DIO, aging + dead-stock, and reorder analysis. Builds a ledger with
// BACKDATED sale movements so the date-window logic (velocity, aging buckets) is
// exercised against real `now()` SQL. Requires `pnpm db:up`; skipped in CI.

import crypto from 'node:crypto';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { withTenant } from '@sparx/db';

import { adjust } from '../../src/services/movements.js';
import { setReorderPolicy } from '../../src/services/levels.js';
import { createSupplier } from '../../src/services/suppliers.js';
import { upsertSupplierVariant } from '../../src/services/supplier-variants.js';
import {
  inventoryValuation,
  turnoverReport,
  agingReport,
  reorderAnalysis,
} from '../../src/services/analytics.js';
import { createInventoryFixture, createTestTenant, dropTestTenant } from '../helpers.js';

describe('inventory analytics', () => {
  let tenantId: string;
  let userId: string;
  let warehouseId: string;
  const ctx = (): { tenantId: string; userId: string } => ({ tenantId, userId });

  // Variants exercising each path.
  let recent: string; // sold recently → 0-30 bucket, not dead
  let stale: string; // sold 120 days ago → 90+ bucket, dead
  let never: string; // never sold → never bucket, dead
  let low: string; // below reorder point + velocity → reorder analysis

  beforeAll(async () => {
    const t = await createTestTenant();
    tenantId = t.tenantId;
    userId = t.userId;
    const fixture = await createInventoryFixture(tenantId);
    warehouseId = fixture.warehouseId;

    recent = await newVariant('AN-RECENT', 'Recent Mover');
    stale = await newVariant('AN-STALE', 'Stale Item');
    never = await newVariant('AN-NEVER', 'Never Sold');
    low = await newVariant('AN-LOW', 'Low Stock');

    // Costed receipts set the moving-average basis (→ valuation + COGS).
    await receive(recent, 100, 500);
    await receive(stale, 50, 800);
    await receive(never, 30, 200);
    await receive(low, 20, 500);

    await sell(recent, 10, 2); // 2 days ago → in the 30-day window + 0-30 bucket
    await sell(stale, 5, 120); // 120 days ago → 90+ bucket, outside velocity window
    await sell(low, 6, 5); // 5 days ago → velocity for reorder analysis

    // `low` falls below its reorder point and has a preferred supplier.
    await setReorderPolicy(ctx(), {
      variantId: low,
      warehouseId,
      reorderPoint: 25,
      reorderQuantity: 40,
    });
    const supplier = await createSupplier(ctx(), { name: 'Acme Parts', code: 'ACME' });
    await upsertSupplierVariant(ctx(), supplier.id, {
      variantId: low,
      unitCostCents: 450,
      minOrderQty: 10,
      isPreferred: true,
    });
  });
  afterAll(async () => {
    await dropTestTenant(tenantId);
  });

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
  async function receive(variantId: string, qty: number, cost: number): Promise<void> {
    await adjust(ctx(), {
      variantId,
      warehouseId,
      delta: qty,
      reason: 'receive',
      unitCostCents: cost,
    });
  }
  async function sell(variantId: string, qty: number, daysAgo: number): Promise<void> {
    await adjust(ctx(), { variantId, warehouseId, delta: -qty, reason: 'sale' });
    if (daysAgo > 0) {
      await withTenant(ctx(), async (tx) => {
        const m = await tx.inventoryMovement.findFirstOrThrow({
          where: { variantId, warehouseId, reason: 'sale' },
          orderBy: { createdAt: 'desc' },
        });
        await tx.inventoryMovement.update({
          where: { id: m.id },
          data: { createdAt: new Date(Date.now() - daysAgo * 86_400_000) },
        });
      });
    }
  }

  it('computes current valuation at moving-average cost', async () => {
    const v = await inventoryValuation(ctx());
    // on-hand: recent 90, stale 45, never 30, low 14 = 179 units.
    expect(v.totalUnits).toBe(179);
    // cost: 90*500 + 45*800 + 30*200 + 14*500 = 45000+36000+6000+7000 = 94000.
    expect(v.totalCostCents).toBe(94_000);
    expect(v.totalAvailable).toBe(179);
  });

  it('computes turnover + DIO over a window (recent sales only)', async () => {
    const to = new Date();
    const from = new Date(to.getTime() - 30 * 86_400_000);
    const r = await turnoverReport(ctx(), { from, to });
    // In-window sales: recent 10 @ 500 + low 6 @ 500 = 8000 cents COGS, 16 units.
    expect(r.unitsSold).toBe(16);
    expect(r.cogsCents).toBe(8_000);
    expect(r.periodDays).toBe(30);
    expect(r.turnover).toBeGreaterThan(0);
    expect(r.daysInventoryOutstanding).not.toBeNull();
  });

  it('buckets aging and surfaces dead-stock', async () => {
    const r = await agingReport(ctx(), { deadStockDays: 90 });
    const bucket = (name: string) => r.buckets.find((b) => b.bucket === name)!;
    expect(bucket('0-30').levels).toBeGreaterThanOrEqual(2); // recent + low sold recently
    expect(bucket('90+').units).toBe(45); // stale's on-hand
    expect(bucket('never').units).toBe(30); // never's on-hand

    const deadSkus = r.deadStock.map((d) => d.sku);
    expect(deadSkus).toContain('AN-STALE');
    expect(deadSkus).toContain('AN-NEVER');
    expect(deadSkus).not.toContain('AN-RECENT');
    const staleRow = r.deadStock.find((d) => d.sku === 'AN-STALE')!;
    expect(staleRow.daysSinceLastSale).toBeGreaterThanOrEqual(90);
    const neverRow = r.deadStock.find((d) => d.sku === 'AN-NEVER')!;
    expect(neverRow.daysSinceLastSale).toBeNull();
  });

  it('analyzes reorder items with velocity, cover, and supplier', async () => {
    const r = await reorderAnalysis(ctx(), { velocityDays: 30 });
    const row = r.rows.find((x) => x.sku === 'AN-LOW')!;
    expect(row).toBeDefined();
    expect(row.available).toBe(14);
    expect(row.reorderPoint).toBe(25);
    // 6 units sold over the 30-day window → 0.2/day.
    expect(row.velocityPerDay).toBeCloseTo(0.2, 5);
    expect(row.daysOfCover).toBeGreaterThan(0);
    expect(row.projectedStockoutAt).not.toBeNull();
    expect(row.suggestedQuantity).toBe(40); // the configured reorder quantity
    expect(row.supplierName).toBe('Acme Parts');
  });
});
