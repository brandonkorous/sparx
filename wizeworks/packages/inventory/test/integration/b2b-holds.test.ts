// DB-backed coverage for the B2B inventory consumer (docs/100 P6d): account-scoped
// availability, fleet/work-order hold lifecycle (reserve → release / consume), and
// the per-account min/max order-qty limits. A hold moves `allocated` (not on_hand)
// so total stock is conserved until consumed; consume funnels a `sale` through the
// ledger. Requires `pnpm db:up`; skipped in CI.

import crypto from 'node:crypto';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { withTenant } from '@wizeworks/db';

import { adjust } from '../../src/services/movements.js';
import {
  accountAvailability,
  createFleetHold,
  releaseFleetHold,
  consumeFleetHold,
  listFleetHolds,
} from '../../src/services/b2b-holds.js';
import { createInventoryFixture, createTestTenant, dropTestTenant } from '../helpers.js';

describe('b2b fleet holds', () => {
  let tenantId: string;
  let userId: string;
  let warehouseId: string;
  let accountId: string;
  let variant: string; // sku FH-MAIN, 50 on hand, deny policy
  const ctx = (): { tenantId: string; userId: string } => ({ tenantId, userId });

  beforeAll(async () => {
    const t = await createTestTenant();
    tenantId = t.tenantId;
    userId = t.userId;
    const fixture = await createInventoryFixture(tenantId);
    warehouseId = fixture.warehouseId;

    accountId = await withTenant(ctx(), async (tx) => {
      const a = await tx.company.create({
        data: { tenantId, companyName: 'Acme Fleet Co' },
      });
      return a.id;
    });
    variant = await newVariant('FH-MAIN', 'deny');
    await adjust(ctx(), { variantId: variant, warehouseId, delta: 50, reason: 'receive' });
  });
  afterAll(async () => {
    await dropTestTenant(tenantId);
  });

  async function newVariant(sku: string, policy: string): Promise<string> {
    const tag = crypto.randomBytes(3).toString('hex');
    return withTenant(ctx(), async (tx) => {
      const product = await tx.product.create({
        data: { tenantId, title: sku, handle: `${sku.toLowerCase()}-${tag}`, status: 'active' },
      });
      const v = await tx.productVariant.create({
        data: {
          tenantId,
          productId: product.id,
          sku,
          priceCents: 1000,
          currency: 'USD',
          inventoryPolicy: policy,
        },
      });
      return v.id;
    });
  }
  it('reports account-scoped availability with limits', async () => {
    await withTenant(ctx(), (tx) =>
      tx.b2bAccountProductOverride.deleteMany({ where: { accountId, variantId: variant } })
    );
    await withTenant(ctx(), (tx) =>
      tx.b2bAccountProductOverride.create({
        data: { tenantId, accountId, variantId: variant, minOrderQty: 5, maxOrderQty: 40 },
      })
    );

    const [row] = await accountAvailability(ctx(), { accountId, variantIds: [variant] });
    expect(row).toMatchObject({
      variantId: variant,
      available: 50,
      heldForAccount: 0,
      minOrderQty: 5,
      maxOrderQty: 40,
    });
  });

  it('places a hold (allocated, not sold) and releases it', async () => {
    const hold = await createFleetHold(ctx(), {
      accountId,
      variantId: variant,
      quantity: 10,
      workOrderRef: 'WO-1001',
    });
    expect(hold).toMatchObject({ status: 'active', quantity: 10, workOrderRef: 'WO-1001' });
    expect(hold.reservationId).not.toBeNull();

    // Available drops by the hold; on_hand unchanged (conserved).
    const [held] = await accountAvailability(ctx(), { accountId, variantIds: [variant] });
    expect(held).toMatchObject({ available: 40, heldForAccount: 10 });
    const level = await withTenant(ctx(), (tx) =>
      tx.inventoryLevel.findUniqueOrThrow({
        where: { variantId_warehouseId: { variantId: variant, warehouseId } },
      })
    );
    expect(level.onHand).toBe(50);
    expect(level.allocated).toBe(10);

    // Release frees it.
    const released = await releaseFleetHold(ctx(), hold.id);
    expect(released.status).toBe('released');
    const [back] = await accountAvailability(ctx(), { accountId, variantIds: [variant] });
    expect(back).toMatchObject({ available: 50, heldForAccount: 0 });
  });

  it('consumes a hold — the stock leaves through the ledger', async () => {
    const hold = await createFleetHold(ctx(), {
      accountId,
      variantId: variant,
      quantity: 8,
      workOrderRef: 'WO-1002',
    });
    const consumed = await consumeFleetHold(ctx(), hold.id);
    expect(consumed.status).toBe('consumed');

    const sums = await withTenant(ctx(), async (tx) => {
      const level = await tx.inventoryLevel.findUniqueOrThrow({
        where: { variantId_warehouseId: { variantId: variant, warehouseId } },
      });
      const agg = await tx.inventoryMovement.aggregate({
        where: { variantId: variant, warehouseId },
        _sum: { delta: true },
      });
      return { onHand: level.onHand, allocated: level.allocated, delta: agg._sum.delta ?? 0 };
    });
    // 50 received − 8 sold = 42; allocation cleared; Σ(delta) == on_hand.
    expect(sums.onHand).toBe(42);
    expect(sums.allocated).toBe(0);
    expect(sums.delta).toBe(42);

    // Idempotent — re-consuming a consumed hold is a no-op.
    const again = await consumeFleetHold(ctx(), hold.id);
    expect(again.status).toBe('consumed');
  });

  it('enforces the account min/max order quantity', async () => {
    await withTenant(ctx(), (tx) =>
      tx.b2bAccountProductOverride.deleteMany({ where: { accountId, variantId: variant } })
    );
    await withTenant(ctx(), (tx) =>
      tx.b2bAccountProductOverride.create({
        data: { tenantId, accountId, variantId: variant, minOrderQty: 5, maxOrderQty: 20 },
      })
    );

    await expect(
      createFleetHold(ctx(), { accountId, variantId: variant, quantity: 3, workOrderRef: 'WO-X' })
    ).rejects.toThrow(/minimum order quantity/i);
    await expect(
      createFleetHold(ctx(), { accountId, variantId: variant, quantity: 25, workOrderRef: 'WO-Y' })
    ).rejects.toThrow(/maximum order quantity/i);
  });

  it('refuses a hold that oversells a deny-policy variant', async () => {
    const scarce = await newVariant('FH-SCARCE', 'deny');
    await adjust(ctx(), { variantId: scarce, warehouseId, delta: 3, reason: 'receive' });
    await expect(
      createFleetHold(ctx(), {
        accountId,
        variantId: scarce,
        quantity: 10,
        workOrderRef: 'WO-Z',
      })
    ).rejects.toThrow();

    // The failed hold left no orphan row (the tx rolled back).
    const { total } = await listFleetHolds(ctx(), { accountId, variantId: scarce });
    expect(total).toBe(0);
  });
});
