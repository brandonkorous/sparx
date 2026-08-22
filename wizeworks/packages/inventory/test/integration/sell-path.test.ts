// DB-backed coverage for the commerce → inventory sell-path seam (docs/100 §2.4,
// P2): the cart soft-hold + oversell guard (`reserveOnTx`), the checkout decrement
// (`commitSaleOnTx`), and the cancel restock (`reverseOrderSale`). Proves the
// guarantees only a real Postgres shows — the FOR UPDATE availability check that
// blocks oversell under `deny`, that a commit releases the hold AND pulls onHand
// in one shot keeping `onHand == Σ(movements)`, and that commit/reverse are
// idempotency-keyed so a retried completion / redelivered cancel applies once.
// Requires `pnpm db:up`; skipped in CI (no DB) per vitest.config.ts.

import crypto from 'node:crypto';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { withTenant } from '@wizeworks/db';

import { InventoryOutOfStockError } from '../../src/errors.js';
import { applyMovement } from '../../src/services/ledger.js';
import { reserveOnTx } from '../../src/services/reservations.js';
import {
  commitSaleOnTx,
  reverseOrderSale,
  resolveDefaultWarehouseId,
} from '../../src/services/sell-path.js';
import {
  createInventoryFixture,
  createTestTenant,
  dropTestTenant,
  type InventoryFixture,
} from '../helpers.js';

describe('sell-path seam — reserve · commit · reverse', () => {
  let tenantId: string;
  const ctx = (): { tenantId: string } => ({ tenantId });

  beforeAll(async () => {
    tenantId = (await createTestTenant()).tenantId;
  });
  afterAll(async () => {
    await dropTestTenant(tenantId);
  });

  /** Σ(delta) over the ledger for one (variant, warehouse) — must equal onHand. */
  async function ledgerSum(f: InventoryFixture): Promise<number> {
    const rows = await withTenant(
      ctx(),
      (tx) =>
        tx.$queryRaw<{ sum: bigint }[]>`
        SELECT COALESCE(SUM(delta), 0)::bigint AS sum
        FROM inventory_movements
        WHERE variant_id = ${f.variantId}::uuid AND warehouse_id = ${f.warehouseId}::uuid
      `
    );
    return Number(rows[0]?.sum ?? 0);
  }

  async function receive(f: InventoryFixture, qty: number): Promise<void> {
    await withTenant(ctx(), (tx) =>
      applyMovement(tx, {
        tenantId,
        variantId: f.variantId,
        warehouseId: f.warehouseId,
        delta: qty,
        reason: 'receive',
        actorType: 'system',
        unitCostCents: 500,
      })
    );
  }

  async function setPolicy(f: InventoryFixture, policy: string): Promise<void> {
    await withTenant(ctx(), (tx) =>
      tx.productVariant.update({ where: { id: f.variantId }, data: { inventoryPolicy: policy } })
    );
  }

  async function levelOf(f: InventoryFixture): Promise<{ onHand: number; allocated: number }> {
    const level = await withTenant(ctx(), (tx) =>
      tx.inventoryLevel.findUnique({
        where: { variantId_warehouseId: { variantId: f.variantId, warehouseId: f.warehouseId } },
        select: { onHand: true, allocated: true },
      })
    );
    return { onHand: level?.onHand ?? 0, allocated: level?.allocated ?? 0 };
  }

  it('holds allocated and blocks oversell under a deny policy, allows backorder under continue', async () => {
    const f = await createInventoryFixture(tenantId); // default policy = deny
    await receive(f, 5);

    // A 3-unit hold leaves 2 available.
    await withTenant(ctx(), (tx) =>
      reserveOnTx(tx, ctx(), {
        variantId: f.variantId,
        warehouseId: f.warehouseId,
        quantity: 3,
        holderType: 'cart',
        holderId: crypto.randomUUID(),
      })
    );
    expect(await levelOf(f)).toEqual({ onHand: 5, allocated: 3 });

    // A 5-unit hold can't be satisfied (only 2 available) under deny.
    await expect(
      withTenant(ctx(), (tx) =>
        reserveOnTx(tx, ctx(), {
          variantId: f.variantId,
          warehouseId: f.warehouseId,
          quantity: 5,
          holderType: 'cart',
          holderId: crypto.randomUUID(),
        })
      )
    ).rejects.toBeInstanceOf(InventoryOutOfStockError);
    expect(await levelOf(f)).toEqual({ onHand: 5, allocated: 3 }); // unchanged

    // Switch to continue → the same short hold succeeds (a backorder).
    await setPolicy(f, 'continue');
    await withTenant(ctx(), (tx) =>
      reserveOnTx(tx, ctx(), {
        variantId: f.variantId,
        warehouseId: f.warehouseId,
        quantity: 5,
        holderType: 'cart',
        holderId: crypto.randomUUID(),
      })
    );
    expect(await levelOf(f)).toEqual({ onHand: 5, allocated: 8 });
  });

  it('commits a cart hold: drops onHand + releases allocated, writes a sale movement, idempotent', async () => {
    const f = await createInventoryFixture(tenantId);
    await receive(f, 10);

    const cartId = crypto.randomUUID();
    const hold = await withTenant(ctx(), (tx) =>
      reserveOnTx(tx, ctx(), {
        variantId: f.variantId,
        warehouseId: f.warehouseId,
        quantity: 4,
        holderType: 'cart',
        holderId: cartId,
      })
    );
    expect(await levelOf(f)).toEqual({ onHand: 10, allocated: 4 });

    // The fixture counted this variant, so the reserve above must have held
    // something. Asserted rather than `!`-ed so a regression in the
    // never-counted branch fails here instead of further down.
    expect(hold).not.toBeNull();
    if (!hold) throw new Error('unreachable');

    const orderId = crypto.randomUUID();
    const lines = [
      { variantId: f.variantId, quantity: 4, reservationId: hold.reservationId, lineKey: 'L1' },
    ];
    const committed = await withTenant(ctx(), (tx) =>
      commitSaleOnTx(tx, ctx(), { orderId, lines })
    );
    expect(committed[0]?.result.onHand).toBe(6);
    expect(committed[0]?.result.deduped).toBe(false);
    // onHand pulled, allocated released in the one write.
    expect(await levelOf(f)).toEqual({ onHand: 6, allocated: 0 });
    expect(await ledgerSum(f)).toBe(6);

    // The hold is now an order-keyed committed reservation.
    const res = await withTenant(ctx(), (tx) =>
      tx.inventoryReservation.findUnique({ where: { id: hold.reservationId } })
    );
    expect(res?.status).toBe('committed');
    expect(res?.holderType).toBe('order');
    expect(res?.holderId).toBe(orderId);

    // A `sale` movement references the order.
    const sale = await withTenant(ctx(), (tx) =>
      tx.inventoryMovement.findFirst({
        where: { referenceType: 'Order', referenceId: orderId, reason: 'sale' },
      })
    );
    expect(sale?.delta).toBe(-4);

    // Re-committing the SAME order is a no-op (idempotency key on the movement).
    const replay = await withTenant(ctx(), (tx) => commitSaleOnTx(tx, ctx(), { orderId, lines }));
    expect(replay[0]?.result.deduped).toBe(true);
    expect(await levelOf(f)).toEqual({ onHand: 6, allocated: 0 });
    expect(await ledgerSum(f)).toBe(6);
  });

  it('commits without a hold (approval path): decrements directly', async () => {
    const f = await createInventoryFixture(tenantId);
    await receive(f, 10);

    const orderId = crypto.randomUUID();
    const committed = await withTenant(ctx(), (tx) =>
      commitSaleOnTx(tx, ctx(), {
        orderId,
        lines: [{ variantId: f.variantId, quantity: 3, reservationId: null, lineKey: 'L1' }],
      })
    );
    expect(committed[0]?.result.onHand).toBe(7);
    expect(await levelOf(f)).toEqual({ onHand: 7, allocated: 0 });
    expect(await ledgerSum(f)).toBe(7);
  });

  it('reverses a cancelled order: restocks onHand, idempotent', async () => {
    const f = await createInventoryFixture(tenantId);
    await receive(f, 10);

    const orderId = crypto.randomUUID();
    await withTenant(ctx(), (tx) =>
      commitSaleOnTx(tx, ctx(), {
        orderId,
        lines: [{ variantId: f.variantId, quantity: 4, reservationId: null, lineKey: 'L1' }],
      })
    );
    expect((await levelOf(f)).onHand).toBe(6);

    const first = await reverseOrderSale(ctx(), { orderId });
    expect(first.reversed).toBe(1);
    expect((await levelOf(f)).onHand).toBe(10);
    expect(await ledgerSum(f)).toBe(10); // receive +10, sale −4, cancel +4

    // A redelivered cancel reverses nothing more.
    const second = await reverseOrderSale(ctx(), { orderId });
    expect(second.reversed).toBe(0);
    expect((await levelOf(f)).onHand).toBe(10);
    expect(await ledgerSum(f)).toBe(10);
  });

  it('resolves a default warehouse for the tenant', async () => {
    const f = await createInventoryFixture(tenantId);
    const warehouseId = await resolveDefaultWarehouseId(ctx());
    // At least one active warehouse exists (the fixture's), so this is non-null.
    expect(typeof warehouseId).toBe('string');
    expect(warehouseId).not.toBeNull();
    // The fixture's warehouse is a valid candidate.
    expect(warehouseId).toBeTruthy();
    void f;
  });
});
