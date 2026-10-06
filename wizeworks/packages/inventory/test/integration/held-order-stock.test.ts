// A held order's stock, against a real Postgres (docs/100 §7.4).
//
// MEASURED 2026-10-03 on Gillett Diesel: Renée Castañeda's wholesale order
// O-000014 (3 CP4 kits, 40 O-rings) went over a spending limit and waited for a
// sign-off. Checkout left the basket's holds where they were, the approval hours
// later committed without them, and the same units were counted out twice: the
// warehouse read 0 on hand / 3 allocated for the kits and 11 / 40 for the rings,
// and the shop's grid called the kits sold out. These pin, through the real
// services:
//
//   1. A held order keeps the basket's hold, as an order hold with no timer, so
//      the reaper cannot let it go; approving commits from that hold and the
//      units are counted out once.
//   2. Turning it down lets the hold go.
//   3. An order with no basket hold (a quote held over a limit) holds what is
//      free and never more, once however often it is asked.
//   4. An approval short of stock books the shortfall where the item lives,
//      never at a location that never stocked it, owes the rest to the customer
//      and says so; one that takes units another order is holding records the
//      oversell.
//   5. An item nobody has counted is not given a level row by a sale.
//   6. The product's in-stock flag asks the product page's question, and the
//      reaper keeps it current when it frees a basket's units.
//   7. A refused basket is told how many one location could give it, not the
//      figure at the location the allocator fell back to.
//
// Requires `pnpm db:up`; skipped in CI (no DB) per vitest.config.ts.

import crypto from 'node:crypto';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { withTenant } from '@wizeworks/db';

import { InventoryOutOfStockError } from '../../src/errors.js';
import { syncProductInStock } from '../../src/services/internal.js';
import { applyMovement } from '../../src/services/ledger.js';
import { expireDueReservations, reserveOnTx } from '../../src/services/reservations.js';
import {
  commitSaleOnTx,
  holdStockForOrderOnTx,
  orderStockOutcomeOnTx,
  releaseOrderHoldsOnTx,
} from '../../src/services/sell-path.js';
import {
  createInventoryFixture,
  createTestTenant,
  dropTestTenant,
  type InventoryFixture,
} from '../helpers.js';

describe('a held order’s stock', () => {
  let tenantId: string;
  let f: InventoryFixture;
  const ctx = (): { tenantId: string } => ({ tenantId });

  beforeEach(async () => {
    // A tenant per test: the allocator routes across EVERY location a tenant
    // has, so another test's warehouses would change the answer.
    tenantId = (await createTestTenant()).tenantId;
    f = await createInventoryFixture(tenantId);
  });
  afterEach(async () => {
    vi.useRealTimers();
    await dropTestTenant(tenantId);
  });

  async function receive(warehouseId: string, qty: number): Promise<void> {
    await withTenant(ctx(), (tx) =>
      applyMovement(tx, {
        tenantId,
        variantId: f.variantId,
        warehouseId,
        delta: qty,
        reason: 'receive',
        actorType: 'system',
        unitCostCents: 500,
      })
    );
  }

  async function level(warehouseId: string): Promise<{ onHand: number; allocated: number } | null> {
    return withTenant(ctx(), (tx) =>
      tx.inventoryLevel.findUnique({
        where: { variantId_warehouseId: { variantId: f.variantId, warehouseId } },
        select: { onHand: true, allocated: true },
      })
    );
  }

  async function location(name: string, defaultForChannel: string[] = []): Promise<string> {
    const w = await withTenant(ctx(), (tx) =>
      tx.warehouse.create({
        data: {
          tenantId,
          name,
          code: `WH-${crypto.randomBytes(3).toString('hex')}`,
          defaultForChannel,
        },
      })
    );
    return w.id;
  }

  async function basketHold(qty: number): Promise<string> {
    const hold = await withTenant(ctx(), (tx) =>
      reserveOnTx(tx, ctx(), {
        variantId: f.variantId,
        warehouseId: f.warehouseId,
        quantity: qty,
        holderType: 'cart',
        holderId: crypto.randomUUID(),
      })
    );
    if (!hold) throw new Error('the fixture is counted, so the basket must hold something');
    return hold.reservationId;
  }

  it('keeps the basket’s hold past its timer, and approval counts the units out once', async () => {
    await receive(f.warehouseId, 3);
    const basket = await basketHold(3);
    const orderId = crypto.randomUUID();

    const held = await withTenant(ctx(), (tx) =>
      holdStockForOrderOnTx(tx, ctx(), {
        orderId,
        lines: [{ variantId: f.variantId, quantity: 3, reservationId: basket }],
      })
    );
    expect(held).toEqual({ reservationIds: [basket], unheldQuantity: 0 });
    const kept = await withTenant(ctx(), (tx) =>
      tx.inventoryReservation.findUnique({ where: { id: basket } })
    );
    expect(kept).toMatchObject({
      holderType: 'order',
      holderId: orderId,
      status: 'active',
      expiresAt: null,
    });

    // Hours later: the basket's thirty minutes are long gone, and the reaper
    // runs. The order's hold is not the reaper's to let go.
    vi.useFakeTimers({ toFake: ['Date'], now: Date.now() + 6 * 60 * 60 * 1000 });
    await expireDueReservations(ctx());
    vi.useRealTimers();
    expect(await level(f.warehouseId)).toEqual({ onHand: 3, allocated: 3 });

    // Approved: the approval passes no hold, and commits from the order's own.
    const lines = [{ variantId: f.variantId, quantity: 3, reservationId: null, lineKey: 'item-1' }];
    const committed = await withTenant(ctx(), (tx) =>
      commitSaleOnTx(tx, ctx(), { orderId, lines })
    );
    expect(committed).toHaveLength(1);
    expect(committed[0]).toMatchObject({
      warehouseId: f.warehouseId,
      quantity: 3,
      backorderedQuantity: 0,
      shortQuantity: 0,
    });
    // Off the shelf AND out of allocated, in one write: counted out once.
    expect(await level(f.warehouseId)).toEqual({ onHand: 0, allocated: 0 });
    const done = await withTenant(ctx(), (tx) =>
      tx.inventoryReservation.findUnique({ where: { id: basket } })
    );
    expect(done?.status).toBe('committed');
    expect(
      await withTenant(ctx(), (tx) => orderStockOutcomeOnTx(tx, { orderId, committed }))
    ).toBeNull();

    // A repeated approval takes nothing more.
    const replay = await withTenant(ctx(), (tx) => commitSaleOnTx(tx, ctx(), { orderId, lines }));
    expect(replay.every((sale) => sale.result.deduped)).toBe(true);
    expect(await level(f.warehouseId)).toEqual({ onHand: 0, allocated: 0 });
  });

  it('lets the stock go when the order is turned down', async () => {
    await receive(f.warehouseId, 3);
    const basket = await basketHold(3);
    const orderId = crypto.randomUUID();
    await withTenant(ctx(), (tx) =>
      holdStockForOrderOnTx(tx, ctx(), {
        orderId,
        lines: [{ variantId: f.variantId, quantity: 3, reservationId: basket }],
      })
    );
    expect(await level(f.warehouseId)).toEqual({ onHand: 3, allocated: 3 });

    const released = await withTenant(ctx(), (tx) => releaseOrderHoldsOnTx(tx, ctx(), { orderId }));
    expect(released).toBe(1);
    expect(await level(f.warehouseId)).toEqual({ onHand: 3, allocated: 0 });
  });

  it('holds what is free for an order with no basket hold, never more, and only once', async () => {
    await receive(f.warehouseId, 2);
    const orderId = crypto.randomUUID();
    const lines = [{ variantId: f.variantId, quantity: 3, reservationId: null }];

    const first = await withTenant(ctx(), (tx) =>
      holdStockForOrderOnTx(tx, ctx(), { orderId, lines })
    );
    expect(first.reservationIds).toHaveLength(1);
    expect(first.unheldQuantity).toBe(1);
    expect(await level(f.warehouseId)).toEqual({ onHand: 2, allocated: 2 });

    // Stock arrives, and the order is asked again (a redelivered announcement):
    // it holds the one it was short, and nothing twice.
    await receive(f.warehouseId, 5);
    const again = await withTenant(ctx(), (tx) =>
      holdStockForOrderOnTx(tx, ctx(), { orderId, lines })
    );
    expect(again.reservationIds).toHaveLength(2);
    expect(again.unheldQuantity).toBe(0);
    expect(await level(f.warehouseId)).toEqual({ onHand: 7, allocated: 3 });

    const third = await withTenant(ctx(), (tx) =>
      holdStockForOrderOnTx(tx, ctx(), { orderId, lines })
    );
    expect(third.reservationIds).toEqual(again.reservationIds);
    expect(await level(f.warehouseId)).toEqual({ onHand: 7, allocated: 3 });
  });

  // O-000014's kits, approved with no hold of their own: one on the shop's
  // shelf, none free at the warehouse, and a third location (the default for
  // orders typed in by the team) that has never stocked the item.
  it('books a short approval where the item lives, owes the rest, and says so', async () => {
    const shop = await location('Main Office & Shop', []);
    const annex = await location('Annex', ['admin']);
    await receive(shop, 1);
    const orderId = crypto.randomUUID();

    const committed = await withTenant(ctx(), (tx) =>
      commitSaleOnTx(tx, ctx(), {
        orderId,
        lines: [{ variantId: f.variantId, quantity: 3, reservationId: null, lineKey: 'item-1' }],
      })
    );
    expect(committed[0]).toMatchObject({
      warehouseId: shop,
      quantity: 3,
      backorderedQuantity: 2,
      shortQuantity: 2,
    });
    expect(await level(shop)).toEqual({ onHand: -2, allocated: 0 });
    // No level row invented at the location that never held it.
    expect(await level(annex)).toBeNull();

    const outcome = await withTenant(ctx(), (tx) =>
      orderStockOutcomeOnTx(tx, { orderId, committed })
    );
    expect(outcome?.lines).toEqual([
      expect.objectContaining({ variantId: f.variantId, notFree: 2, owed: 2 }),
    ]);
    expect(outcome?.note).toContain('2 of');
    expect(outcome?.note).toContain('owed to the customer');
  });

  it('records the oversell when an approval takes units another order is holding', async () => {
    await receive(f.warehouseId, 3);
    await basketHold(3); // somebody else's basket
    const orderId = crypto.randomUUID();

    const committed = await withTenant(ctx(), (tx) =>
      commitSaleOnTx(tx, ctx(), {
        orderId,
        lines: [{ variantId: f.variantId, quantity: 3, reservationId: null, lineKey: 'item-1' }],
      })
    );
    expect(committed[0]).toMatchObject({ backorderedQuantity: 0, shortQuantity: 3 });
    expect(await level(f.warehouseId)).toEqual({ onHand: 0, allocated: 3 });

    const incidents = await withTenant(ctx(), (tx) =>
      tx.inventoryOversellIncident.findMany({ where: { variantId: f.variantId } })
    );
    expect(incidents).toEqual([
      expect.objectContaining({
        kind: 'allowed',
        requestedQuantity: 3,
        availableQuantity: 0,
        holderType: 'order',
        holderId: orderId,
      }),
    ]);
  });

  it('gives an item nobody has counted no level row when it sells', async () => {
    const orderId = crypto.randomUUID();
    const committed = await withTenant(ctx(), (tx) =>
      commitSaleOnTx(tx, ctx(), {
        orderId,
        lines: [{ variantId: f.variantId, quantity: 2, reservationId: null, lineKey: 'item-1' }],
      })
    );
    expect(committed).toEqual([]);
    const rows = await withTenant(ctx(), (tx) =>
      tx.inventoryLevel.count({ where: { variantId: f.variantId } })
    );
    expect(rows).toBe(0);
  });

  // The buyer asked for more than any one location has. The refusal says how
  // many one basket line could hold (the shop's one), not the figure at the
  // location the allocator fell back to (the warehouse's none), which the shop
  // printed as "sold out" beside a product page offering the one.
  it('tells a refused basket how many one location could give it', async () => {
    const shop = await location('Main Office & Shop', []);
    await withTenant(ctx(), (tx) =>
      tx.warehouse.update({
        where: { id: f.warehouseId },
        data: { defaultForChannel: ['storefront'] },
      })
    );
    await receive(f.warehouseId, 0);
    await receive(shop, 1);
    const refused = await withTenant(ctx(), (tx) =>
      reserveOnTx(tx, ctx(), {
        variantId: f.variantId,
        quantity: 4,
        holderType: 'cart',
        holderId: crypto.randomUUID(),
      })
    ).catch((err: unknown) => err);
    expect(refused).toBeInstanceOf(InventoryOutOfStockError);
    expect((refused as InventoryOutOfStockError).available).toBe(1);
    expect((refused as InventoryOutOfStockError).requested).toBe(4);
  });

  it('keeps the product in stock when one location is oversold and another has one', async () => {
    const shop = await location('Main Office & Shop', []);
    await receive(shop, 1);
    // The warehouse: nothing on the shelf, three allocated.
    await withTenant(ctx(), (tx) =>
      tx.inventoryLevel.create({
        data: { tenantId, variantId: f.variantId, warehouseId: f.warehouseId, allocated: 3 },
      })
    );
    await withTenant(ctx(), (tx) => syncProductInStock(tx, f.variantId));
    const product = await withTenant(ctx(), (tx) =>
      tx.product.findUnique({ where: { id: f.productId }, select: { inStock: true } })
    );
    expect(product?.inStock).toBe(true);
  });

  it('puts the product back in stock in the grid when the reaper frees a basket’s units', async () => {
    await receive(f.warehouseId, 3);
    await basketHold(3);
    const inStock = () =>
      withTenant(ctx(), (tx) =>
        tx.product.findUnique({ where: { id: f.productId }, select: { inStock: true } })
      );
    expect((await inStock())?.inStock).toBe(false);

    vi.useFakeTimers({ toFake: ['Date'], now: Date.now() + 60 * 60 * 1000 });
    const { released } = await expireDueReservations(ctx());
    vi.useRealTimers();
    expect(released).toBe(1);
    expect(await level(f.warehouseId)).toEqual({ onHand: 3, allocated: 0 });
    expect((await inStock())?.inStock).toBe(true);
  });
});
