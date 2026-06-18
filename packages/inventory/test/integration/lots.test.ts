// DB-backed coverage for the lot/serial management surface (docs/100 P4d): the
// create primitives (./lots) plus the management reads + status mutations
// (./lot-management) — a filterable lot list, a lot detail with its serial roster,
// per-serial status changes, recalls, and clearing a recall. Lot/serial quantities
// are traceability metadata; on-hand is untouched here. Requires `pnpm db:up`;
// skipped in CI per vitest.config.

import crypto from 'node:crypto';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { withTenant } from '@sparx/db';

import { createLotBatch, createSerialUnit, initiateRecall } from '../../src/services/lots.js';
import {
  clearRecall,
  getLotBatch,
  listLots,
  listSerials,
  updateSerialStatus,
} from '../../src/services/lot-management.js';
import { createInventoryFixture, createTestTenant, dropTestTenant } from '../helpers.js';

describe('inventory lots + serials', () => {
  let tenantId: string;
  let warehouseId: string;
  let variantA: string;
  const ctx = (): { tenantId: string } => ({ tenantId });

  beforeAll(async () => {
    tenantId = (await createTestTenant()).tenantId;
    const fixture = await createInventoryFixture(tenantId);
    warehouseId = fixture.warehouseId;
    variantA = fixture.variantId;
  });
  afterAll(async () => {
    await dropTestTenant(tenantId);
  });

  async function newVariant(): Promise<string> {
    const tag = crypto.randomBytes(3).toString('hex');
    return withTenant(ctx(), async (tx) => {
      const product = await tx.product.create({
        data: { tenantId, title: `Part ${tag}`, handle: `part-${tag}`, status: 'active' },
      });
      const v = await tx.productVariant.create({
        data: {
          tenantId,
          productId: product.id,
          sku: `SKU-${tag}`,
          priceCents: 1000,
          costCents: 500,
          currency: 'USD',
          isDefault: true,
        },
      });
      return v.id;
    });
  }

  it('creates a lot and lists it enriched + filtered', async () => {
    const variantB = await newVariant();
    const lotA = await createLotBatch(ctx(), {
      variantId: variantA,
      warehouseId,
      lotNumber: 'LOT-AAA-1',
      quantity: 40,
      hazmatClass: 'class_3_flammable_liquid',
    });
    await createLotBatch(ctx(), {
      variantId: variantB,
      warehouseId,
      lotNumber: 'LOT-BBB-1',
      quantity: 10,
    });

    const all = await listLots(ctx());
    expect(all.total).toBe(2);
    const rowA = all.items.find((l) => l.id === lotA.id)!;
    expect(rowA.variantSku).not.toBeNull();
    expect(rowA.serialCount).toBe(0);
    expect(rowA.hazmatClass).toBe('class_3_flammable_liquid');

    // Filter by variant + by lot-number search.
    expect((await listLots(ctx(), { variantId: variantB })).total).toBe(1);
    const byQuery = await listLots(ctx(), { q: 'aaa' });
    expect(byQuery.total).toBe(1);
    expect(byQuery.items[0]!.lotNumber).toBe('LOT-AAA-1');

    const detail = await getLotBatch(ctx(), lotA.id);
    expect(detail.lotNumber).toBe('LOT-AAA-1');
    expect(detail.serialCounts).toEqual([]);
  });

  it('adds serials, lists them, and changes a serial status', async () => {
    const lot = await createLotBatch(ctx(), {
      variantId: variantA,
      warehouseId,
      lotNumber: 'LOT-SER-1',
      quantity: 3,
    });
    const s1 = await createSerialUnit(ctx(), {
      variantId: variantA,
      warehouseId,
      lotBatchId: lot.id,
      serial: 'SN-0001',
      status: 'in_stock',
    });
    await createSerialUnit(ctx(), {
      variantId: variantA,
      warehouseId,
      lotBatchId: lot.id,
      serial: 'SN-0002',
      status: 'in_stock',
    });

    const serials = await listSerials(ctx(), { lotBatchId: lot.id });
    expect(serials.total).toBe(2);
    expect(serials.items.every((s) => s.lotNumber === 'LOT-SER-1')).toBe(true);

    const updated = await updateSerialStatus(ctx(), s1.id, { status: 'scrapped' });
    expect(updated.status).toBe('scrapped');

    // The lot detail's roster breakdown reflects the change.
    const detail = await getLotBatch(ctx(), lot.id);
    const counts = Object.fromEntries(detail.serialCounts.map((c) => [c.status, c.count]));
    expect(counts.in_stock).toBe(1);
    expect(counts.scrapped).toBe(1);

    // Filter serials by status.
    expect((await listSerials(ctx(), { lotBatchId: lot.id, status: 'scrapped' })).total).toBe(1);
  });

  it('recalls a lot, finds it by recall filter, then clears the recall', async () => {
    const lot = await createLotBatch(ctx(), {
      variantId: variantA,
      warehouseId,
      lotNumber: 'LOT-RECALL-1',
      quantity: 5,
    });
    await createSerialUnit(ctx(), {
      variantId: variantA,
      warehouseId,
      lotBatchId: lot.id,
      serial: 'SN-SOLD-1',
      status: 'sold',
    });

    const recall = await initiateRecall(ctx(), {
      lotBatchIds: [lot.id],
      reason: 'Contaminated batch',
      notifyCustomers: true,
    });
    expect(recall.affectedLotBatches).toBe(1);
    expect(recall.affectedSerialUnits).toBe(1); // the one sold unit

    const active = await listLots(ctx(), { recallStatus: 'active' });
    expect(active.items.some((l) => l.id === lot.id)).toBe(true);
    expect((await getLotBatch(ctx(), lot.id)).recallStatus).toBe('active');

    const cleared = await clearRecall(ctx(), lot.id);
    expect(cleared.recallStatus).toBe('cleared');
    // Clearing again is rejected — there's no open recall.
    await expect(clearRecall(ctx(), lot.id)).rejects.toThrow(/no open recall/i);
  });

  it('filters lots by an expiry horizon', async () => {
    const variantC = await newVariant();
    const soon = new Date(Date.now() + 20 * 86_400_000).toISOString();
    const far = new Date(Date.now() + 400 * 86_400_000).toISOString();
    await createLotBatch(ctx(), {
      variantId: variantC,
      warehouseId,
      lotNumber: 'LOT-EXP-SOON',
      quantity: 1,
      expiresAt: soon,
    });
    await createLotBatch(ctx(), {
      variantId: variantC,
      warehouseId,
      lotNumber: 'LOT-EXP-FAR',
      quantity: 1,
      expiresAt: far,
    });

    const horizon = new Date(Date.now() + 90 * 86_400_000).toISOString();
    const expiring = await listLots(ctx(), { variantId: variantC, expiringBefore: horizon });
    expect(expiring.total).toBe(1);
    expect(expiring.items[0]!.lotNumber).toBe('LOT-EXP-SOON');
  });
});
