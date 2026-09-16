// DB-backed coverage for the inventory analytics surface (docs/100 P6b): valuation,
// turnover / DIO, aging + dead-stock, and reorder analysis. Builds a ledger with
// BACKDATED sale movements so the date-window logic (velocity, aging buckets) is
// exercised against real `now()` SQL. Requires `pnpm db:up`; skipped in CI.

import crypto from 'node:crypto';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { withTenant } from '@wizeworks/db';

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
  let never: string; // never sold, and held 200 days → never bucket, dead
  let fresh: string; // never sold, but only just arrived → never bucket, NOT dead
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
    fresh = await newVariant('AN-FRESH', 'Just Arrived');
    low = await newVariant('AN-LOW', 'Low Stock');

    // Costed receipts set the moving-average basis (→ valuation + COGS).
    await receive(recent, 100, 500);
    await receive(stale, 50, 800);
    await receive(never, 30, 200, 200);
    await receive(fresh, 12, 300, 3);
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
  async function receive(variantId: string, qty: number, cost: number, daysAgo = 0): Promise<void> {
    await adjust(ctx(), {
      variantId,
      warehouseId,
      delta: qty,
      reason: 'receive',
      unitCostCents: cost,
    });
    // A receipt is when the shop GOT the thing, and that is the clock a line
    // which has never sold is measured against. A fixture that can only receive
    // "now" cannot tell dead stock from a delivery that just landed.
    if (daysAgo > 0) {
      await withTenant(ctx(), async (tx) => {
        const m = await tx.inventoryMovement.findFirstOrThrow({
          where: { variantId, warehouseId, reason: 'receive' },
          orderBy: { createdAt: 'desc' },
        });
        await tx.inventoryMovement.update({
          where: { id: m.id },
          data: { createdAt: new Date(Date.now() - daysAgo * 86_400_000) },
        });
      });
    }
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
    // on-hand: recent 90, stale 45, never 30, fresh 12, low 14 = 191 units.
    expect(v.totalUnits).toBe(191);
    // cost: 90*500 + 45*800 + 30*200 + 12*300 + 14*500
    //     = 45000 + 36000 + 6000 + 3600 + 7000 = 97600.
    expect(v.totalCostCents).toBe(97_600);
    expect(v.totalAvailable).toBe(191);
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
    expect(bucket('never').units).toBe(42); // never's 30 + fresh's 12

    const deadSkus = r.deadStock.map((d) => d.sku);
    expect(deadSkus).toContain('AN-STALE');
    expect(deadSkus).toContain('AN-NEVER');
    expect(deadSkus).not.toContain('AN-RECENT');
    const staleRow = r.deadStock.find((d) => d.sku === 'AN-STALE')!;
    expect(staleRow.daysSinceLastSale).toBeGreaterThanOrEqual(90);
    const neverRow = r.deadStock.find((d) => d.sku === 'AN-NEVER')!;
    expect(neverRow.daysSinceLastSale).toBeNull();
  });

  it('does not call a delivery dead the week it arrives', async () => {
    const r = await agingReport(ctx(), { deadStockDays: 90 });
    // AN-FRESH has never sold and arrived three days ago. It belongs in the
    // "never" bucket, which is a statement about its sales; it does not belong
    // in dead stock, which is an instruction to discount or write it off.
    expect(r.deadStock.map((d) => d.sku)).not.toContain('AN-FRESH');
  });

  it('takes the dead-stock window from the tenant, not from a number of its own', async () => {
    // No filter passed: the report has to reach for the policy the owner can see
    // and change on Planning settings. It used to keep a private 90 while that
    // policy said 180, so two screens described the same stock differently.
    const r = await agingReport(ctx());
    expect(r.deadStockDays).toBe(180);
    // AN-NEVER was held 200 days, so it is still dead at the wider window;
    // AN-STALE last sold 120 days ago, so at 180 it no longer is.
    const skus = r.deadStock.map((d) => d.sku);
    expect(skus).toContain('AN-NEVER');
    expect(skus).not.toContain('AN-STALE');
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
