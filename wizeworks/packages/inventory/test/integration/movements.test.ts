// DB-backed coverage for the movement / audit-log read path (docs/100 P4, docs/99
// D5): `listMovements` is a filterable, paginated view over the append-only
// `inventory_movements` ledger. Every stock mutation already records a row, so this
// just proves the filters (variant / warehouse / reason / actor) + pagination select
// the right rows. Requires `pnpm db:up`; skipped in CI per vitest.config.

import crypto from 'node:crypto';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { withTenant } from '@wizeworks/db';

import { adjust, transfer } from '../../src/services/movements.js';
import { listMovements } from '../../src/services/movement-log.js';
import { createInventoryFixture, createTestTenant, dropTestTenant } from '../helpers.js';

describe('inventory movement log', () => {
  let tenantId: string;
  let warehouseId: string;
  let otherWarehouseId: string;
  let variantA: string;
  let variantB: string;
  const ctx = (): { tenantId: string } => ({ tenantId });

  beforeAll(async () => {
    const t = await createTestTenant();
    tenantId = t.tenantId;
    const fixture = await createInventoryFixture(tenantId);
    warehouseId = fixture.warehouseId;
    variantA = fixture.variantId;
    variantB = await newVariant();
    otherWarehouseId = await newWarehouse();

    // Stock + a varied ledger: a receive, a sale, a manual adjust on A; a receive on
    // B; and a transfer A → otherWarehouse (transfer_out + transfer_in legs).
    await adjust(ctx(), { variantId: variantA, warehouseId, delta: 50, reason: 'receive' });
    await adjust(ctx(), { variantId: variantA, warehouseId, delta: -3, reason: 'sale' });
    await adjust(ctx(), { variantId: variantA, warehouseId, delta: -1, reason: 'manual' });
    await adjust(ctx(), { variantId: variantB, warehouseId, delta: 20, reason: 'receive' });
    await transfer(ctx(), {
      variantId: variantA,
      fromWarehouseId: warehouseId,
      toWarehouseId: otherWarehouseId,
      quantity: 10,
    });
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

  async function newWarehouse(): Promise<string> {
    const tag = crypto.randomBytes(3).toString('hex');
    return withTenant(ctx(), async (tx) => {
      const w = await tx.warehouse.create({
        data: { tenantId, name: `WH ${tag}`, code: `WH-${tag}` },
      });
      return w.id;
    });
  }

  it('returns the whole ledger newest-first with a correct total', async () => {
    const { items, total } = await listMovements(ctx());
    // receive A, sale A, manual A, receive B, transfer_out A, transfer_in A = 6.
    expect(total).toBe(6);
    expect(items).toHaveLength(6);
    // Newest first.
    const times = items.map((m) => new Date(m.createdAt).getTime());
    expect(times).toEqual([...times].sort((a, b) => b - a));
    // Enriched with the item + location.
    const sale = items.find((m) => m.reason === 'sale')!;
    expect(sale.variantSku).not.toBeNull();
    expect(sale.warehouseName).not.toBeNull();
    expect(sale.delta).toBe(-3);
    expect(sale.actorType).toBe('system'); // ctx has no userId
  });

  it('filters by reason, variant, and warehouse', async () => {
    const byReason = await listMovements(ctx(), { reason: 'receive' });
    expect(byReason.total).toBe(2); // A + B receipts
    expect(byReason.items.every((m) => m.reason === 'receive')).toBe(true);

    const byVariant = await listMovements(ctx(), { variantId: variantB });
    expect(byVariant.total).toBe(1);
    expect(byVariant.items[0]!.variantId).toBe(variantB);

    // The destination warehouse only saw the transfer_in leg.
    const byWarehouse = await listMovements(ctx(), { warehouseId: otherWarehouseId });
    expect(byWarehouse.total).toBe(1);
    expect(byWarehouse.items[0]!.reason).toBe('transfer_in');

    // Combined filters AND together.
    const combined = await listMovements(ctx(), { variantId: variantA, reason: 'transfer_out' });
    expect(combined.total).toBe(1);
    expect(combined.items[0]!.warehouseId).toBe(warehouseId);
  });

  it('filters by actor type and paginates with a stable total', async () => {
    // Everything was written by the system actor (no userId on ctx).
    const system = await listMovements(ctx(), { actorType: 'system' });
    expect(system.total).toBe(6);
    const ai = await listMovements(ctx(), { actorType: 'ai' });
    expect(ai.total).toBe(0);

    // Page through: take=2 yields the first 2 of 6, total stays 6.
    const page1 = await listMovements(ctx(), { take: 2, skip: 0 });
    expect(page1.items).toHaveLength(2);
    expect(page1.total).toBe(6);
    const page2 = await listMovements(ctx(), { take: 2, skip: 2 });
    expect(page2.items).toHaveLength(2);
    // No overlap between pages.
    const ids1 = new Set(page1.items.map((m) => m.id));
    expect(page2.items.some((m) => ids1.has(m.id))).toBe(false);
  });

  it('filters by a created-at date range', async () => {
    const now = await withTenant(ctx(), (tx) =>
      tx.$queryRaw<{ now: Date }[]>`SELECT now() AS now`.then((r) => r[0]!.now)
    );
    const future = new Date(now.getTime() + 60_000).toISOString();
    const past = new Date(now.getTime() - 60_000).toISOString();

    // The whole window contains everything just written.
    expect((await listMovements(ctx(), { from: past, to: future })).total).toBe(6);
    // A window entirely in the future excludes it all.
    const farFuture = new Date(now.getTime() + 3_600_000).toISOString();
    expect((await listMovements(ctx(), { from: future, to: farFuture })).total).toBe(0);
  });
});
