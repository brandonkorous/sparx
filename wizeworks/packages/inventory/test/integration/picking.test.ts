// DB-backed coverage for picking and packing (docs/146 Phase 4).
//
// Almost every claim this phase makes is a claim about how three ledgers move
// relative to each other, so almost none of it can be proven with a fake. The
// tests are chosen to pin the three decisions that would be expensive to get
// wrong and cheap to break later:
//
//   1. A confirmed pick changes NO warehouse quantity. The sale already did.
//      A regression here sells one unit twice in the books and nothing else in
//      the system would notice.
//   2. A pick from a different shelf corrects the BIN ledger and only the bin
//      ledger, keeping `Σ(bins) == level` intact.
//   3. A short pick puts the units back AND holds them, so `available` does not
//      move — the whole point being that nobody can buy stock we have just said
//      we cannot find.
//
// Plus the refusals that are the product: packing something not on the order,
// and sealing a box that does not complete it.
//
// Requires `pnpm db:up`; skipped in CI (no DB) per vitest.config.ts.

import crypto from 'node:crypto';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { withTenant } from '@wizeworks/db';

import { enableBinsForWarehouse, createBin } from '../../src/services/bins.js';
import { applyMovement } from '../../src/services/ledger.js';
import { commitSaleOnTx } from '../../src/services/sell-path.js';
import { generatePickList, getPickList } from '../../src/services/pick-lists.js';
import { confirmPick, shortPick, skipPick } from '../../src/services/pick-lifecycle.js';
import { closePackage, createPackage, getPackage, packItem } from '../../src/services/packing.js';
import { buildPackingSlipHtml } from '../../src/services/packing-slip.js';
import { pickThroughput } from '../../src/services/pick-analytics.js';
import {
  createInventoryFixture,
  createTestTenant,
  dropTestTenant,
  type InventoryFixture,
} from '../helpers.js';

describe('picking and packing — DB-backed', () => {
  let tenantId: string;
  let customerId: string;
  // A real uuid: `withTenant` sets `app.user_id` as a GUC and asserts the shape,
  // because a malformed one would silently attribute a ledger row to nobody.
  const pickerId = crypto.randomUUID();
  const ctx = () => ({ tenantId, userId: pickerId });

  beforeAll(async () => {
    tenantId = (await createTestTenant()).tenantId;
    customerId = await withTenant({ tenantId }, async (tx) => {
      const customer = await tx.customer.create({
        data: {
          tenantId,
          firstName: 'Dana',
          lastName: 'Okonkwo',
          email: `pick-${crypto.randomBytes(4).toString('hex')}@example.test`,
        },
        select: { id: true },
      });
      return customer.id;
    });
  });
  afterAll(async () => {
    await dropTestTenant(tenantId);
  });

  /* ── Fixtures ───────────────────────────────────────────────────────────── */

  /** Stock on the shelf, through the ledger like everything else. */
  const receive = (f: InventoryFixture, delta: number, binId?: string) =>
    withTenant(ctx(), (tx) =>
      applyMovement(tx, {
        tenantId,
        variantId: f.variantId,
        warehouseId: f.warehouseId,
        delta,
        reason: 'receive',
        actorType: 'system',
        ...(binId ? { binId } : {}),
      })
    );

  /**
   * A placed order whose stock has actually been committed.
   *
   * The commit matters: everything in Phase 4 reads the decision checkout made,
   * so an order created without one would exercise only the fallback path and
   * prove nothing about the real one.
   */
  async function placeOrder(
    f: InventoryFixture,
    quantity: number
  ): Promise<{ orderId: string; orderItemId: string; orderNumber: string }> {
    return withTenant(ctx(), async (tx) => {
      const number = `SO-${crypto.randomBytes(4).toString('hex')}`;
      const order = await tx.order.create({
        data: {
          tenantId,
          customerId,
          orderNumber: number,
          status: 'placed',
          placedAt: new Date(),
          items: {
            create: [
              {
                tenantId,
                productId: f.productId,
                variantId: f.variantId,
                sku: `SKU-${number}`,
                name: 'Test item',
                quantity,
              },
            ],
          },
        },
        select: { id: true, orderNumber: true, items: { select: { id: true } } },
      });

      await commitSaleOnTx(tx, ctx(), {
        orderId: order.id,
        lines: [
          {
            variantId: f.variantId,
            quantity,
            reservationId: null,
            lineKey: order.items[0]?.id ?? 'line',
          },
        ],
      });

      return {
        orderId: order.id,
        orderItemId: order.items[0]?.id ?? '',
        orderNumber: order.orderNumber,
      };
    });
  }

  async function level(f: InventoryFixture): Promise<{ onHand: number; allocated: number }> {
    const row = await withTenant(ctx(), (tx) =>
      tx.inventoryLevel.findFirst({
        where: { variantId: f.variantId, warehouseId: f.warehouseId },
        select: { onHand: true, allocated: true },
      })
    );
    return { onHand: row?.onHand ?? 0, allocated: row?.allocated ?? 0 };
  }

  async function binSum(f: InventoryFixture): Promise<number> {
    const rows = await withTenant(
      ctx(),
      (tx) =>
        tx.$queryRaw<{ sum: bigint }[]>`
        SELECT COALESCE(SUM(on_hand), 0)::bigint AS sum
          FROM inventory_bin_levels
         WHERE variant_id = ${f.variantId}::uuid AND warehouse_id = ${f.warehouseId}::uuid
      `
    );
    return Number(rows[0]?.sum ?? 0);
  }

  async function movementCount(f: InventoryFixture): Promise<number> {
    const rows = await withTenant(
      ctx(),
      (tx) =>
        tx.$queryRaw<{ n: bigint }[]>`
        SELECT COUNT(*)::bigint AS n
          FROM inventory_movements
         WHERE variant_id = ${f.variantId}::uuid AND warehouse_id = ${f.warehouseId}::uuid
      `
    );
    return Number(rows[0]?.n ?? 0);
  }

  /* ── 1. Generation ──────────────────────────────────────────────────────── */

  it('generates a walk from an order and refuses to generate a second one for the same units', async () => {
    const f = await createInventoryFixture(tenantId);
    await receive(f, 10);
    const order = await placeOrder(f, 4);

    const walk = await generatePickList(ctx(), { orderIds: [order.orderId] });

    expect(walk.number).toMatch(/^PICK-\d{6}$/);
    expect(walk.kind).toBe('single');
    expect(walk.orderCount).toBe(1);
    expect(walk.lines).toHaveLength(1);
    expect(walk.lines[0]?.quantity).toBe(4);
    expect(walk.lines[0]?.status).toBe('pending');

    // Those units are now spoken for by an open walk. Generating again would
    // send a second person to fetch the same box.
    await expect(generatePickList(ctx(), { orderIds: [order.orderId] })).rejects.toThrow(
      /already picked|another walk|nothing left/i
    );
  });

  it('refuses to pick a cancelled order', async () => {
    const f = await createInventoryFixture(tenantId);
    await receive(f, 5);
    const order = await placeOrder(f, 2);
    await withTenant(ctx(), (tx) =>
      tx.order.update({ where: { id: order.orderId }, data: { status: 'cancelled' } })
    );

    await expect(generatePickList(ctx(), { orderIds: [order.orderId] })).rejects.toThrow(
      /cancelled/i
    );
  });

  /* ── 2. Confirming changes no stock number ──────────────────────────────── */

  it('a confirmed pick writes no warehouse movement — the sale already did', async () => {
    const f = await createInventoryFixture(tenantId);
    await receive(f, 10);
    const order = await placeOrder(f, 3);

    const before = await level(f);
    const movementsBefore = await movementCount(f);

    const walk = await generatePickList(ctx(), { orderIds: [order.orderId] });
    const line = walk.lines[0];
    expect(line).toBeDefined();

    const result = await confirmPick(ctx(), walk.id, { lineId: line?.id ?? '' });

    expect(result.status).toBe('picked');
    expect(result.pickedQuantity).toBe(3);
    // The whole decision of the phase, asserted directly.
    expect(await level(f)).toEqual(before);
    expect(await movementCount(f)).toBe(movementsBefore);

    const after = await getPickList(ctx(), walk.id);
    expect(after.status).toBe('picked');
    expect(after.startedAt).not.toBeNull();
  });

  /* ── 3. The bin correction ──────────────────────────────────────────────── */

  it('picking from a different shelf corrects the bin ledger and leaves the location alone', async () => {
    const f = await createInventoryFixture(tenantId);
    await enableBinsForWarehouse(ctx(), f.warehouseId);

    const shelfA = await createBin(ctx(), {
      warehouseId: f.warehouseId,
      code: 'A-01-01',
      type: 'pick',
      pickSequence: 1,
    });
    const shelfB = await createBin(ctx(), {
      warehouseId: f.warehouseId,
      code: 'B-04-02',
      type: 'pick',
      pickSequence: 2,
    });

    // Both shelves hold stock. The sale will draw from one; the picker will
    // take from the other.
    await receive(f, 6, shelfA.id);
    await receive(f, 6, shelfB.id);

    const order = await placeOrder(f, 2);
    const levelBefore = await level(f);
    const sumBefore = await binSum(f);
    expect(sumBefore).toBe(levelBefore.onHand);

    const walk = await generatePickList(ctx(), { orderIds: [order.orderId] });
    const line = walk.lines[0];
    const instructed = line?.binId;
    expect(instructed).toBeTruthy();

    // Deliberately the OTHER shelf.
    const actual = instructed === shelfA.id ? shelfB.id : shelfA.id;
    await confirmPick(ctx(), walk.id, { lineId: line?.id ?? '', binId: actual });

    // The location did not move…
    expect(await level(f)).toEqual(levelBefore);
    // …the shelves still add up to it…
    expect(await binSum(f)).toBe(levelBefore.onHand);

    // …and the correction landed on the two shelves, in the right directions.
    const shelves = await withTenant(ctx(), (tx) =>
      tx.inventoryBinLevel.findMany({
        where: { variantId: f.variantId, warehouseId: f.warehouseId },
        select: { binId: true, onHand: true },
      })
    );
    const byBin = new Map(shelves.map((s) => [s.binId, s.onHand]));
    expect(byBin.get(actual)).toBe(4);
    expect(byBin.get(instructed ?? '')).toBe(6);
  });

  /* ── 4. The short pick ──────────────────────────────────────────────────── */

  it('a short pick restores the units AND holds them, so available does not move', async () => {
    const f = await createInventoryFixture(tenantId);
    await receive(f, 10);
    const order = await placeOrder(f, 4);

    const before = await level(f);
    const availableBefore = before.onHand - before.allocated;

    const walk = await generatePickList(ctx(), { orderIds: [order.orderId] });
    const line = walk.lines[0];

    const result = await shortPick(ctx(), walk.id, {
      lineId: line?.id ?? '',
      quantity: 1, // found one of the four
      reason: 'insufficient',
    });

    expect(result.status).toBe('short');
    expect(result.pickedQuantity).toBe(1);
    expect(result.shortQuantity).toBe(3);

    const after = await level(f);
    // The three that were not found came BACK…
    expect(after.onHand).toBe(before.onHand + 3);
    // …and are held for the order that still wants them…
    expect(after.allocated).toBe(before.allocated + 3);
    // …so nobody else can buy them.
    expect(after.onHand - after.allocated).toBe(availableBefore);

    // The reservation is visible and releasable rather than a bare number.
    const holds = await withTenant(ctx(), (tx) =>
      tx.inventoryReservation.findMany({
        where: { holderType: 'order', holderId: order.orderId, status: 'active' },
        select: { quantity: true },
      })
    );
    expect(holds.map((h) => h.quantity)).toContain(3);

    // And a count was raised so somebody settles what is really there.
    const reloaded = await getPickList(ctx(), walk.id);
    expect(reloaded.lines[0]?.shortCountId).toBeTruthy();
  });

  it('a short pick is idempotent on the ledger — the restore key is the line', async () => {
    const f = await createInventoryFixture(tenantId);
    await receive(f, 10);
    const order = await placeOrder(f, 2);

    const walk = await generatePickList(ctx(), { orderIds: [order.orderId] });
    const line = walk.lines[0];

    await shortPick(ctx(), walk.id, { lineId: line?.id ?? '', reason: 'not_found' });
    const after = await level(f);

    // A second attempt is refused — and which refusal fires is itself worth
    // pinning: that line was the only one, so the walk COMPLETED, and the guard
    // that catches the retry is the walk-level one rather than the line-level
    // one. Either is correct; what must never happen is a second restore.
    await expect(
      shortPick(ctx(), walk.id, { lineId: line?.id ?? '', reason: 'not_found' })
    ).rejects.toThrow(/is picked and can no longer be worked|already finished/i);
    expect(await level(f)).toEqual(after);
  });

  /* ── 5. Skipping ────────────────────────────────────────────────────────── */

  it('a skipped line keeps the walk open — a skip is "coming back to it"', async () => {
    const f = await createInventoryFixture(tenantId);
    await receive(f, 6);
    const order = await placeOrder(f, 2);

    const walk = await generatePickList(ctx(), { orderIds: [order.orderId] });
    const result = await skipPick(ctx(), walk.id, { lineId: walk.lines[0]?.id ?? '' });

    expect(result.status).toBe('skipped');
    expect(result.list.status).not.toBe('picked');

    // …and it can still be picked afterwards.
    const done = await confirmPick(ctx(), walk.id, { lineId: walk.lines[0]?.id ?? '' });
    expect(done.status).toBe('picked');
    expect(done.list.status).toBe('picked');
  });

  /* ── 6. Packing ─────────────────────────────────────────────────────────── */

  it('refuses to pack more than the order wants, and refuses to seal an incomplete box', async () => {
    const f = await createInventoryFixture(tenantId);
    await receive(f, 20);
    const order = await placeOrder(f, 5);

    const box = await createPackage(ctx(), { orderId: order.orderId });
    expect(box.status).toBe('open');
    expect(box.orderFullyPacked).toBe(false);

    await expect(
      packItem(ctx(), box.id, { orderItemId: order.orderItemId, quantity: 6 })
    ).rejects.toThrow(/only for 5|at most/i);

    const partial = await packItem(ctx(), box.id, {
      orderItemId: order.orderItemId,
      quantity: 3,
    });
    expect(partial.unitCount).toBe(3);
    expect(partial.orderFullyPacked).toBe(false);
    expect(partial.outstanding[0]?.remaining).toBe(2);

    // Sealing an incomplete box has to be a decision, and the refusal names what
    // is missing rather than saying "invalid".
    await expect(closePackage(ctx(), box.id, {})).rejects.toThrow(/still to pack/i);

    const sealed = await closePackage(ctx(), box.id, {
      allowPartial: true,
      weightGrams: 1200,
    });
    expect(sealed.status).toBe('packed');
    expect(sealed.weightGrams).toBe(1200);
  });

  it('a second box takes only what the first one left, and packing nothing is refused', async () => {
    const f = await createInventoryFixture(tenantId);
    await receive(f, 20);
    const order = await placeOrder(f, 4);

    const first = await createPackage(ctx(), { orderId: order.orderId });
    await packItem(ctx(), first.id, { orderItemId: order.orderItemId, quantity: 3 });
    await closePackage(ctx(), first.id, { allowPartial: true });

    const second = await createPackage(ctx(), { orderId: order.orderId });
    await expect(
      packItem(ctx(), second.id, { orderItemId: order.orderItemId, quantity: 2 })
    ).rejects.toThrow(/already in another box/i);

    // An empty box has no legitimate reading.
    await expect(closePackage(ctx(), second.id, {})).rejects.toThrow(/nothing in this box/i);

    const filled = await packItem(ctx(), second.id, {
      orderItemId: order.orderItemId,
      quantity: 1,
    });
    expect(filled.orderFullyPacked).toBe(true);
    const sealed = await closePackage(ctx(), second.id, {});
    expect(sealed.status).toBe('packed');
  });

  /* ── 7. The packing slip ────────────────────────────────────────────────── */

  it('the packing slip carries what is in THIS box, what is still to come, and no prices', async () => {
    const f = await createInventoryFixture(tenantId);
    await receive(f, 20);
    const order = await placeOrder(f, 4);

    const box = await createPackage(ctx(), { orderId: order.orderId });
    await packItem(ctx(), box.id, { orderItemId: order.orderItemId, quantity: 1 });
    await closePackage(ctx(), box.id, { allowPartial: true });

    const html = await buildPackingSlipHtml(ctx(), box.id);

    expect(html).toContain(order.orderNumber);
    expect(html).toContain('Packing slip');
    // The partial-shipment block, which is the whole reason it does not generate
    // a support ticket.
    expect(html).toContain('sent separately');
    // No money, anywhere. A gift, a dropship, and one box of four all break if
    // a price appears here.
    expect(html).not.toMatch(/\$\d/);
  });

  /* ── 8. Throughput ──────────────────────────────────────────────────────── */

  it('reports what happened, separating scanned confirmations from tapped ones', async () => {
    const f = await createInventoryFixture(tenantId);
    await receive(f, 30);
    const order = await placeOrder(f, 6);

    const walk = await generatePickList(ctx(), { orderIds: [order.orderId] });
    await confirmPick(ctx(), walk.id, { lineId: walk.lines[0]?.id ?? '' });

    const report = await pickThroughput(ctx(), {});

    expect(report.totals.linesPicked).toBeGreaterThan(0);
    // Everything in this suite was TAPPED, never scanned — so the honest number
    // is zero, and a report that flattered it would be the bug.
    expect(report.totals.scanVerifiedRate).toBe(0);
    expect(report.pickers.some((p) => p.pickedBy === pickerId)).toBe(true);
    // The shorts raised earlier in the suite show up with a reason attached.
    expect(report.shortReasons.length).toBeGreaterThan(0);
  });

  /* ── 9. Reading back ────────────────────────────────────────────────────── */

  it('a package reads back with its lines, its order, and what the order still owes', async () => {
    const f = await createInventoryFixture(tenantId);
    await receive(f, 10);
    const order = await placeOrder(f, 2);

    const box = await createPackage(ctx(), { orderId: order.orderId });
    await packItem(ctx(), box.id, { orderItemId: order.orderItemId, quantity: 2 });

    const read = await getPackage(ctx(), box.id);
    expect(read.number).toMatch(/^PKG-\d{6}$/);
    expect(read.orderNumber).toBe(order.orderNumber);
    expect(read.lines).toHaveLength(1);
    expect(read.lines[0]?.quantity).toBe(2);
    expect(read.lines[0]?.scannedQuantity).toBe(0);
    expect(read.orderFullyPacked).toBe(true);
    expect(read.outstanding).toHaveLength(0);
  });
});
