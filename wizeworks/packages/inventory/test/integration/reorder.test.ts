// DB-backed coverage for the reorder engine (docs/100 P3d): low levels become
// suggestions grouped by (supplier, warehouse) with a suggested quantity + the
// preferred supplier; the manual draft groups selected lines into one PO per
// supplier (line costs defaulted from the link); the auto-draft (the inventory.low
// action) find-or-appends into one open draft and skips what's already on order /
// recovered / has no supplier. Requires `pnpm db:up`; skipped in CI per vitest.config.

import crypto from 'node:crypto';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { withTenant } from '@wizeworks/db';

import { setReorderPolicy } from '../../src/services/levels.js';
import { adjust } from '../../src/services/movements.js';
import { createSupplier } from '../../src/services/suppliers.js';
import { upsertSupplierVariant } from '../../src/services/supplier-variants.js';
import { getPurchaseOrder } from '../../src/services/purchase-orders.js';
import {
  autoDraftReorder,
  draftReorderPurchaseOrders,
  listReorderSuggestions,
} from '../../src/services/reorder.js';
import { createInventoryFixture, createTestTenant, dropTestTenant } from '../helpers.js';

describe('reorder engine', () => {
  let tenantId: string;
  let warehouseId: string;
  const ctx = (): { tenantId: string } => ({ tenantId });

  beforeAll(async () => {
    tenantId = (await createTestTenant()).tenantId;
    // One shared warehouse so same-supplier variants group into a single PO.
    warehouseId = (await createInventoryFixture(tenantId)).warehouseId;
  });
  afterAll(async () => {
    await dropTestTenant(tenantId);
  });

  /** A fresh variant (its own product) in the shared warehouse. */
  async function newVariant(costCents = 500): Promise<string> {
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
          costCents,
          currency: 'USD',
          isDefault: true,
        },
      });
      return v.id;
    });
  }

  /** Set a reorder policy then stock the level (below the point unless told). */
  async function stock(
    variantId: string,
    opts: { reorderPoint: number; reorderQuantity: number; onHand: number; leadTimeDays?: number }
  ): Promise<void> {
    await setReorderPolicy(ctx(), {
      variantId,
      warehouseId,
      reorderPoint: opts.reorderPoint,
      reorderQuantity: opts.reorderQuantity,
      ...(opts.leadTimeDays !== undefined ? { leadTimeDays: opts.leadTimeDays } : {}),
    });
    if (opts.onHand !== 0) {
      await adjust(ctx(), { variantId, warehouseId, delta: opts.onHand, reason: 'manual' });
    }
  }

  async function linkSupplier(
    supplierId: string,
    variantId: string,
    unitCostCents: number,
    minOrderQty = 5
  ): Promise<void> {
    await upsertSupplierVariant(ctx(), supplierId, {
      variantId,
      unitCostCents,
      minOrderQty,
      isPreferred: true,
    });
  }

  it('groups low levels by supplier with a suggested quantity; flags unsupplied', async () => {
    const sup = await createSupplier(ctx(), {
      name: 'Bosch',
      code: `BO-${rand()}`,
      leadTimeDays: 7,
    });
    // Fixed-lot item: reorderQuantity 40 wins over top-up.
    const a = await newVariant();
    await stock(a, { reorderPoint: 10, reorderQuantity: 40, onHand: 3 });
    await linkSupplier(sup.id, a, 250);
    // Top-up item: no reorderQuantity → top back up to the point (20 - 5 = 15).
    const b = await newVariant();
    await setReorderPolicy(ctx(), {
      variantId: b,
      warehouseId,
      reorderPoint: 20,
      reorderQuantity: 1,
    });
    // Clear the placeholder reorderQuantity so the top-up branch is exercised.
    await withTenant(ctx(), (tx) =>
      tx.inventoryLevel.update({
        where: { variantId_warehouseId: { variantId: b, warehouseId } },
        data: { reorderQuantity: null },
      })
    );
    await adjust(ctx(), { variantId: b, warehouseId, delta: 5, reason: 'manual' });
    await linkSupplier(sup.id, b, 99, 5);
    // Low but no supplier link → unsupplied.
    const c = await newVariant();
    await stock(c, { reorderPoint: 5, reorderQuantity: 10, onHand: 2 });

    const result = await listReorderSuggestions(ctx());

    expect(result.counts.groups).toBe(1);
    const group = result.groups[0]!;
    expect(group.supplierId).toBe(sup.id);
    expect(group.warehouseId).toBe(warehouseId);
    expect(group.lines).toHaveLength(2);
    expect(group.expectedArrivalAt).not.toBeNull(); // today + 7d lead

    const byVariant = new Map(group.lines.map((l) => [l.variantId, l]));
    expect(byVariant.get(a)!.suggestedQuantity).toBe(40); // fixed lot
    expect(byVariant.get(a)!.unitCostCents).toBe(250);
    expect(byVariant.get(a)!.onOrder).toBe(0);
    expect(byVariant.get(b)!.suggestedQuantity).toBe(15); // top-up 20-5

    expect(result.counts.unsupplied).toBe(1);
    expect(result.unsupplied[0]!.variantId).toBe(c);
  });

  it('drafts one PO per supplier with defaulted line costs; on-order then reflects it', async () => {
    const supX = await createSupplier(ctx(), { name: 'Acme', code: `AC-${rand()}` });
    const supY = await createSupplier(ctx(), { name: 'Gates', code: `GA-${rand()}` });
    const v1 = await newVariant();
    const v2 = await newVariant();
    const v3 = await newVariant();
    await stock(v1, { reorderPoint: 10, reorderQuantity: 30, onHand: 1 });
    await stock(v2, { reorderPoint: 10, reorderQuantity: 20, onHand: 1 });
    await stock(v3, { reorderPoint: 10, reorderQuantity: 12, onHand: 1 });
    await linkSupplier(supX.id, v1, 700);
    await linkSupplier(supX.id, v2, 350);
    await linkSupplier(supY.id, v3, 1500);

    const drafted = await draftReorderPurchaseOrders(ctx(), {
      lines: [
        { variantId: v1, warehouseId, supplierId: supX.id, quantity: 30 },
        { variantId: v2, warehouseId, supplierId: supX.id, quantity: 20 },
        { variantId: v3, warehouseId, supplierId: supY.id, quantity: 12 },
      ],
    });

    expect(drafted.count).toBe(2); // one per supplier
    const supXpo = drafted.purchaseOrders.find((p) => p.supplierId === supX.id)!;
    expect(supXpo.lineCount).toBe(2);

    // Line costs defaulted from the (supplier, variant) links.
    const detail = await getPurchaseOrder(ctx(), supXpo.id);
    const byV = new Map(detail.lines.map((l) => [l.variantId, l]));
    expect(byV.get(v1)!.unitCostCents).toBe(700);
    expect(byV.get(v2)!.unitCostCents).toBe(350);

    // The drafted variants now read as on-order, so they won't be re-suggested blind.
    const after = await listReorderSuggestions(ctx());
    const onOrder = new Map(
      after.groups.flatMap((g) => g.lines).map((l) => [l.variantId, l.onOrder])
    );
    expect(onOrder.get(v1)).toBe(30);
    expect(onOrder.get(v3)).toBe(12);
  });

  it('auto-draft creates, appends, then skips already-on-order / recovered / no-supplier', async () => {
    const sup = await createSupplier(ctx(), {
      name: 'Stanadyne',
      code: `ST-${rand()}`,
      leadTimeDays: 5,
    });
    const a = await newVariant();
    const b = await newVariant();
    await stock(a, { reorderPoint: 10, reorderQuantity: 40, onHand: 2 });
    await stock(b, { reorderPoint: 10, reorderQuantity: 25, onHand: 2 });
    await linkSupplier(sup.id, a, 400);
    await linkSupplier(sup.id, b, 600);

    // First low → a new draft PO.
    const r1 = await autoDraftReorder(ctx(), { variantId: a, warehouseId });
    expect(r1.outcome).toBe('created');
    expect(r1.quantity).toBe(40);
    const poId = r1.purchaseOrderId!;

    // Second variant, same supplier+warehouse → appended into the SAME draft.
    const r2 = await autoDraftReorder(ctx(), { variantId: b, warehouseId });
    expect(r2.outcome).toBe('appended');
    expect(r2.purchaseOrderId).toBe(poId);
    const po = await getPurchaseOrder(ctx(), poId);
    expect(po.lines).toHaveLength(2);

    // Re-firing for an already-on-order variant is a no-op.
    const r3 = await autoDraftReorder(ctx(), { variantId: a, warehouseId });
    expect(r3.outcome).toBe('skipped_already_drafted');

    // Recovered (above the point) → skip.
    const recovered = await newVariant();
    await stock(recovered, { reorderPoint: 10, reorderQuantity: 10, onHand: 25 });
    await linkSupplier(sup.id, recovered, 100);
    expect((await autoDraftReorder(ctx(), { variantId: recovered, warehouseId })).outcome).toBe(
      'skipped_recovered'
    );

    // Low but no supplier → skip.
    const orphan = await newVariant();
    await stock(orphan, { reorderPoint: 10, reorderQuantity: 10, onHand: 1 });
    expect((await autoDraftReorder(ctx(), { variantId: orphan, warehouseId })).outcome).toBe(
      'skipped_no_supplier'
    );
  });
});

function rand(): string {
  return crypto.randomBytes(3).toString('hex');
}
