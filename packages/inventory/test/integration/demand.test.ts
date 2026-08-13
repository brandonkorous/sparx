// DB-backed coverage for demand-side commitments (docs/146 Phase 9).
//
// The claims worth pinning, because each one is a promise to a person that goes
// wrong quietly if it breaks:
//
//   1. Selling past zero WRITES A COMMITMENT — for the shortfall only, not the
//      whole line — and a sale that stock covered writes nothing.
//   2. A commitment nobody can date carries NULL, not a guessed date. Raising a
//      purchase order with an expected arrival is what gives it one, and the row
//      records that the date came from that order.
//   3. A delivery fills the queue IN ORDER, first come first served, and the
//      last one reached is filled partially rather than everybody getting a
//      useless share.
//   4. Cancelling the order drops its commitments, so a delivery is never held
//      for somebody who has already been refunded.
//   5. A preorder cap REFUSES the hold that would break it, at the moment the
//      customer can still be told no.
//   6. Consigned stock is excluded from valuation and stays fully sellable.
//   7. A settlement values sales at what they cost WHEN THEY SOLD, refuses to
//      close while any of them is uncosted, and is immutable once closed.
//   8. A returns disposition routes to the right shelf, and quarantined units
//      come off what a customer can buy.
//   9. FEFO refuses an expired batch — the case where the old query would ship
//      the worst possible lot first.
//
// Requires `pnpm db:up`; skipped in CI (no DB) per vitest.config.ts.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { withTenant } from '@sparx/db';

import { adjust } from '../../src/services/movements.js';
import { commitSaleOnTx } from '../../src/services/sell-path.js';
import {
  allocateBackordersOnTx,
  cancelBackordersForHolderOnTx,
  listBackorders,
  refreshBackorderPromises,
} from '../../src/services/backorders.js';
import {
  closePreorderWindow,
  openPreorderWindow,
  assertPreorderHeadroomOnTx,
} from '../../src/services/preorders.js';
import { listNonOwnedStock, setStockOwnership } from '../../src/services/stock-ownership.js';
import {
  closeConsignmentSettlement,
  createConsignmentSettlement,
} from '../../src/services/consignment.js';
import { inventoryValuation } from '../../src/services/analytics.js';
import { computeAvailability } from '../../src/services/availability.js';
import { enableBinsForWarehouse } from '../../src/services/bins.js';
import { systemBinFor } from '../../src/services/bin-routing.js';
import { resolveFefoLot } from '../../src/services/pick-allocation.js';
import { createLotBatch } from '../../src/services/lots.js';
import { listExpiringStock, writeOffExpiringLot } from '../../src/services/expiry.js';
import { createSupplier } from '../../src/services/suppliers.js';
import { createPurchaseOrder } from '../../src/services/purchase-orders.js';
import { submitPurchaseOrder } from '../../src/services/purchase-order-lifecycle.js';
import { createGoodsReceipt } from '../../src/services/goods-receipts.js';
import {
  createInventoryFixture,
  createTestTenant,
  dropTestTenant,
  type InventoryFixture,
} from '../helpers.js';

describe('demand-side commitments — DB-backed', () => {
  let tenantId: string;
  let userId: string;
  const ctx = () => ({ tenantId, userId });

  beforeAll(async () => {
    const tenant = await createTestTenant();
    tenantId = tenant.tenantId;
    userId = tenant.userId;
  });
  afterAll(async () => {
    await dropTestTenant(tenantId);
  });

  /* ── Fixtures ───────────────────────────────────────────────────────────── */

  let nextCode = 0;

  const makeCustomer = async (name: string) =>
    withTenant(ctx(), async (tx) => {
      nextCode += 1;
      const c = await tx.customer.create({
        data: {
          tenantId,
          email: `${name.toLowerCase()}-${nextCode}@example.test`,
          firstName: name,
          lastName: 'Buyer',
        },
        select: { id: true },
      });
      return c.id;
    });

  /** An order row the sell path can commit against. `commitSaleOnTx` reads the
   *  order for its customer, so a real one has to exist — and `customerId` is
   *  NOT NULL on `orders`, so every order gets one. */
  const makeOrder = async (customerId?: string) => {
    const buyer = customerId ?? (await makeCustomer('Guest'));
    nextCode += 1;
    return withTenant(ctx(), async (tx) => {
      const order = await tx.order.create({
        data: {
          tenantId,
          customerId: buyer,
          orderNumber: `SO-${String(nextCode).padStart(5, '0')}`,
          status: 'placed',
          paymentStatus: 'paid',
          currency: 'USD',
          subtotal: 10,
          total: 10,
          placedAt: new Date(),
        },
        select: { id: true },
      });
      return order.id;
    });
  };

  /** Sell `quantity` of the fixture's item against `orderId`, through the real
   *  commit path — which is where a backorder is written. */
  const sell = (f: InventoryFixture, orderId: string, quantity: number, lineKey: string) =>
    withTenant(ctx(), (tx) =>
      commitSaleOnTx(tx, ctx(), {
        orderId,
        lines: [{ variantId: f.variantId, quantity, reservationId: null, lineKey }],
      })
    );

  const levelOf = (f: InventoryFixture) =>
    withTenant(ctx(), (tx) =>
      tx.inventoryLevel.findUnique({
        where: { variantId_warehouseId: { variantId: f.variantId, warehouseId: f.warehouseId } },
      })
    );

  /** Put stock on the shelf without going through purchasing. */
  const stockUp = (f: InventoryFixture, quantity: number, unitCostCents = 500) =>
    adjust(ctx(), {
      variantId: f.variantId,
      warehouseId: f.warehouseId,
      delta: quantity,
      reason: 'receive',
      unitCostCents,
    });

  /** Variants default to `deny`, which throws rather than backordering. */
  const allowOversell = (f: InventoryFixture, policy: 'continue' | 'preorder' = 'continue') =>
    withTenant(ctx(), (tx) =>
      tx.productVariant.update({ where: { id: f.variantId }, data: { inventoryPolicy: policy } })
    );

  /* ── 1 + 2. Writing the commitment down ─────────────────────────────────── */

  describe('recording a shortfall', () => {
    let f: InventoryFixture;
    let orderId: string;

    beforeAll(async () => {
      f = await createInventoryFixture(tenantId);
      await allowOversell(f);
      await stockUp(f, 4);
      orderId = await makeOrder(await makeCustomer('Ada'));
    });

    it('backorders only the units the shelf could not cover', async () => {
      // 10 ordered against 4 on hand: 4 ship, 6 are owed. A commitment for the
      // whole line would have the business chasing stock it already has.
      const [sale] = await sell(f, orderId, 10, 'line-a');
      expect(sale?.backorderedQuantity).toBe(6);
      expect(sale?.backorderId).not.toBeNull();

      const list = await listBackorders(ctx(), { variantId: f.variantId });
      expect(list.items).toHaveLength(1);
      expect(list.items[0]?.quantity).toBe(6);
      expect(list.items[0]?.outstanding).toBe(6);
      expect(list.items[0]?.customerName).toBe('Ada Buyer');
    });

    it('promises nothing when nothing can promise it', async () => {
      const list = await listBackorders(ctx(), { variantId: f.variantId });
      const row = list.items[0];
      // The heart of the phase. No purchase order exists and no lead time has
      // been measured, so there is no honest date — and the row says so rather
      // than inventing one from a default.
      expect(row?.promisedAt).toBeNull();
      expect(row?.promiseSource).toBeNull();
      // …and it is NOT overdue. You cannot be late for a date nobody set.
      expect(row?.isOverdue).toBe(false);
      expect(list.undatedCount).toBe(1);
      expect(list.overdueCount).toBe(0);
    });

    it('gives it a date once a purchase order carries one, and says where from', async () => {
      nextCode += 1;
      const supplierId = (
        await createSupplier(ctx(), {
          name: `Supplier ${nextCode}`,
          code: `SUP${nextCode}`,
          currency: 'USD',
        })
      ).id;
      const po = await createPurchaseOrder(ctx(), {
        supplierId,
        warehouseId: f.warehouseId,
        expectedArrivalAt: new Date(Date.now() + 14 * 86_400_000).toISOString(),
        lines: [{ variantId: f.variantId, quantity: 20, unitCostCents: 500 }],
      });
      await submitPurchaseOrder(ctx(), po.id, {});

      const sweep = await refreshBackorderPromises(ctx());
      expect(sweep.newlyDated).toBe(1);
      expect(sweep.stillUndated).toBe(0);

      const list = await listBackorders(ctx(), { variantId: f.variantId });
      expect(list.items[0]?.promisedAt).not.toBeNull();
      expect(list.items[0]?.promiseSource).toBe('purchase_order');
      expect(list.items[0]?.expectedPurchaseOrderNumber).toBe(po.number);
      expect(list.undatedCount).toBe(0);
    });

    it('writes nothing when the shelf covered the sale', async () => {
      const covered = await createInventoryFixture(tenantId);
      await allowOversell(covered);
      await stockUp(covered, 50);
      const order = await makeOrder();
      const [sale] = await sell(covered, order, 5, 'line-covered');
      expect(sale?.backorderedQuantity).toBe(0);
      expect(sale?.backorderId).toBeNull();

      const list = await listBackorders(ctx(), { variantId: covered.variantId });
      expect(list.items).toHaveLength(0);
    });
  });

  /* ── 3 + 4. Filling and dropping the queue ──────────────────────────────── */

  describe('filling the queue', () => {
    let f: InventoryFixture;
    /** Where the sale actually landed.
     *
     *  `commitSaleOnTx` routes through the stock-aware allocator when no hold
     *  exists, and this tenant has a warehouse per fixture — so the sale does
     *  not necessarily use the one the fixture created. The commitment is
     *  written against wherever the units were taken from, which is the whole
     *  point (a backorder is per-location because that is where the delivery
     *  clearing it will land), so the test follows the sale rather than
     *  assuming. */
    let soldWarehouseId: string;

    beforeAll(async () => {
      f = await createInventoryFixture(tenantId);
      await allowOversell(f);
      // Nothing on the shelf, three customers, ten each.
      for (const name of ['First', 'Second', 'Third']) {
        const order = await makeOrder(await makeCustomer(name));
        const [sale] = await sell(f, order, 10, `line-${name}`);
        soldWarehouseId = sale!.warehouseId;
      }
    });

    it('queues them in arrival order', async () => {
      const list = await listBackorders(ctx(), { variantId: f.variantId, status: 'open' });
      expect(list.items).toHaveLength(3);
      expect(list.unitsOutstanding).toBe(30);
      // Positions are derived, so they are always 1..n with no holes.
      expect(list.items.map((i) => i.position).sort()).toEqual([1, 2, 3]);
    });

    it('gives an arrival to the front of the queue rather than spreading it thin', async () => {
      // 15 units for three customers who each want 10. Pro-rata would give
      // everybody 5 and let nobody be shipped.
      const result = await withTenant(ctx(), (tx) =>
        allocateBackordersOnTx(tx, ctx(), {
          variantId: f.variantId,
          warehouseId: soldWarehouseId,
          unitsArrived: 15,
          sourceType: 'manual',
        })
      );
      expect(result.filled).toHaveLength(2);
      expect(result.filled[0]?.quantityFilled).toBe(10);
      expect(result.filled[0]?.isComplete).toBe(true);
      expect(result.filled[1]?.quantityFilled).toBe(5);
      expect(result.filled[1]?.isComplete).toBe(false);
      expect(result.unitsStillOwed).toBe(15);
    });

    it('moves no stock while doing it', async () => {
      // The hold already exists in `allocated`; a second writer to on_hand is
      // the one thing docs/146 §7 forbids outright. Allocation wrote allocation
      // rows and nothing else, so on-hand is still exactly what the three sales
      // left it at.
      const level = await withTenant(ctx(), (tx) =>
        tx.inventoryLevel.findUnique({
          where: {
            variantId_warehouseId: {
              variantId: f.variantId,
              warehouseId: soldWarehouseId,
            },
          },
        })
      );
      expect(level?.onHand).toBe(-30);
    });

    it('drops the commitments when the order is cancelled', async () => {
      const order = await makeOrder(await makeCustomer('Fourth'));
      await sell(f, order, 7, 'line-fourth');
      await withTenant(ctx(), (tx) =>
        cancelBackordersForHolderOnTx(tx, ctx(), {
          holderType: 'order',
          holderId: order,
          reason: 'The order was cancelled.',
        })
      );
      const list = await listBackorders(ctx(), { variantId: f.variantId, status: 'cancelled' });
      expect(list.items.some((i) => i.holderId === order)).toBe(true);
      // …and it no longer holds a place in the queue.
      const open = await listBackorders(ctx(), { variantId: f.variantId, status: 'open' });
      expect(open.items.some((i) => i.holderId === order)).toBe(false);
    });
  });

  /* ── 5. Preorder caps ───────────────────────────────────────────────────── */

  describe('preorder windows', () => {
    let f: InventoryFixture;

    beforeAll(async () => {
      f = await createInventoryFixture(tenantId);
      await allowOversell(f, 'preorder');
    });

    it('opens with no date at all, because a maker who has not committed is ordinary', async () => {
      const window = await openPreorderWindow(ctx(), f.variantId, {
        availabilityNote: 'Ships with the spring run',
        isCapped: true,
        maxQuantity: 5,
      });
      expect(window.availableAt).toBeNull();
      expect(window.availabilityNote).toBe('Ships with the spring run');
      expect(window.isTakingOrders).toBe(true);
      expect(window.remaining).toBe(5);
    });

    it('refuses a second live window for the same item', async () => {
      await expect(openPreorderWindow(ctx(), f.variantId, {})).rejects.toThrow();
    });

    it('refuses a hold that would break the cap', async () => {
      await expect(
        withTenant(ctx(), (tx) =>
          assertPreorderHeadroomOnTx(tx, ctx(), { variantId: f.variantId, quantity: 6 })
        )
      ).rejects.toThrow(/Only 5 left/);
      // …and permits one that fits.
      await expect(
        withTenant(ctx(), (tx) =>
          assertPreorderHeadroomOnTx(tx, ctx(), { variantId: f.variantId, quantity: 5 })
        )
      ).resolves.toBeUndefined();
    });

    it('counts what sells against the cap and then sells out', async () => {
      const order = await makeOrder(await makeCustomer('Preorderer'));
      await sell(f, order, 5, 'line-preorder');

      await expect(
        withTenant(ctx(), (tx) =>
          assertPreorderHeadroomOnTx(tx, ctx(), { variantId: f.variantId, quantity: 1 })
        )
      ).rejects.toThrow(/sold out/i);
    });

    it('stops taking orders once closed, and keeps the history', async () => {
      const list = await withTenant(ctx(), (tx) =>
        tx.preorderWindow.findFirst({ where: { tenantId, variantId: f.variantId } })
      );
      const closed = await closePreorderWindow(ctx(), list!.id);
      expect(closed.isTakingOrders).toBe(false);
      expect(closed.soldQuantity).toBe(5);
    });
  });

  /* ── 6 + 7. Ownership and settlement ────────────────────────────────────── */

  describe('consigned stock', () => {
    let f: InventoryFixture;
    let supplierId: string;

    beforeAll(async () => {
      f = await createInventoryFixture(tenantId);
      nextCode += 1;
      supplierId = (
        await createSupplier(ctx(), {
          name: `Consignor ${nextCode}`,
          code: `CON${nextCode}`,
          currency: 'USD',
        })
      ).id;
      await stockUp(f, 100, 250);
      await setStockOwnership(ctx(), {
        variantId: f.variantId,
        warehouseId: f.warehouseId,
        ownership: 'consignment',
        ownerSupplierId: supplierId,
      });
    });

    it('refuses consigned stock with nobody to owe', async () => {
      const orphan = await createInventoryFixture(tenantId);
      await stockUp(orphan, 5);
      await expect(
        setStockOwnership(ctx(), {
          variantId: orphan.variantId,
          warehouseId: orphan.warehouseId,
          ownership: 'consignment',
        })
      ).rejects.toThrow(/needs an owner/i);
    });

    it('keeps it out of valuation while leaving it fully sellable', async () => {
      const listed = await listNonOwnedStock(ctx());
      const row = listed.items.find((i) => i.variantId === f.variantId);
      expect(row?.ownership).toBe('consignment');
      expect(row?.countsTowardValuation).toBe(false);
      expect(row?.onHand).toBe(100);

      const valuation = await inventoryValuation(ctx());
      expect(valuation.nonOwnedUnits).toBeGreaterThanOrEqual(100);

      // The asymmetry that IS the feature: not an asset, still on sale.
      const availability = computeAvailability(
        [{ onHand: 100, allocated: 0, safetyBuffer: 0, unsellableOnHand: 0 }],
        'deny',
        { inventoryActive: true }
      );
      expect(availability.available).toBe(100);
      expect(availability.inStock).toBe(true);
    });

    it('settles what sold at the cost it sold AT, and refuses to close while any is uncosted', async () => {
      await allowOversell(f);
      const order = await makeOrder(await makeCustomer('Consignment'));
      await sell(f, order, 20, 'line-consigned');

      const periodStart = new Date(Date.now() - 86_400_000).toISOString();
      const periodEnd = new Date(Date.now() + 86_400_000).toISOString();
      const draft = await createConsignmentSettlement(ctx(), {
        ownerType: 'supplier',
        supplierId,
        periodStart,
        periodEnd,
      });

      expect(draft.status).toBe('draft');
      expect(draft.unitsSold).toBe(20);
      // 20 units at the 250c they cost when they sold.
      expect(draft.totalCents).toBe(20 * 250);
      expect(draft.unpricedUnits).toBe(0);

      const closed = await closeConsignmentSettlement(ctx(), draft.id);
      expect(closed.status).toBe('closed');
      expect(closed.closedAt).not.toBeNull();
    });

    it('will not rebuild a period once it is closed', async () => {
      const list = await withTenant(ctx(), (tx) =>
        tx.consignmentSettlement.findFirst({ where: { tenantId, status: 'closed' } })
      );
      await expect(
        createConsignmentSettlement(ctx(), {
          ownerType: 'supplier',
          supplierId,
          periodStart: list!.periodStart.toISOString(),
          periodEnd: list!.periodEnd.toISOString(),
        })
      ).rejects.toThrow(/already covers/i);
    });

    it('stamps ownership on the movement, so buying the consignment out cannot rewrite history', async () => {
      await setStockOwnership(ctx(), {
        variantId: f.variantId,
        warehouseId: f.warehouseId,
        ownership: 'owned',
      });
      const stamped = await withTenant(ctx(), (tx) =>
        tx.inventoryMovement.findFirst({
          where: { tenantId, variantId: f.variantId, reason: 'sale' },
          select: { ownership: true },
        })
      );
      expect(stamped?.ownership).toBe('consignment');
    });
  });

  /* ── 8. Unsellable shelves ──────────────────────────────────────────────── */

  describe('stock on a shelf nothing sells from', () => {
    let f: InventoryFixture;

    beforeAll(async () => {
      f = await createInventoryFixture(tenantId);
      await enableBinsForWarehouse(ctx(), f.warehouseId);
      await stockUp(f, 30);
    });

    it('nets quarantined units out of what a customer can buy', async () => {
      const quarantine = await withTenant(ctx(), (tx) =>
        systemBinFor(tx, f.warehouseId, 'quarantine')
      );
      expect(quarantine).not.toBeNull();

      await adjust(ctx(), {
        variantId: f.variantId,
        warehouseId: f.warehouseId,
        delta: 8,
        reason: 'return',
        binId: quarantine!,
      });

      const level = await levelOf(f);
      // Still in the building…
      expect(level?.onHand).toBe(38);
      // …and eight of them are not for sale, which is the whole point of the
      // shelf. Without this the disposition workflow is decoration.
      expect(level?.unsellableOnHand).toBe(8);

      const availability = computeAvailability(
        [
          {
            onHand: level!.onHand,
            allocated: level!.allocated,
            safetyBuffer: level!.safetyBuffer,
            unsellableOnHand: level!.unsellableOnHand,
          },
        ],
        'deny',
        { inventoryActive: true }
      );
      expect(availability.available).toBe(30);
    });

    it('provisions a repair shelf alongside quarantine and damaged', async () => {
      const repair = await withTenant(ctx(), (tx) => systemBinFor(tx, f.warehouseId, 'repair'));
      expect(repair).not.toBeNull();
    });
  });

  /* ── 9. FEFO and expiry ─────────────────────────────────────────────────── */

  describe('expiring stock', () => {
    let f: InventoryFixture;

    beforeAll(async () => {
      f = await createInventoryFixture(tenantId);
      await stockUp(f, 60, 400);
      await createLotBatch(ctx(), {
        variantId: f.variantId,
        warehouseId: f.warehouseId,
        lotNumber: 'EXPIRED-1',
        expiresAt: new Date(Date.now() - 5 * 86_400_000).toISOString(),
        quantity: 20,
        hazmatClass: 'none',
      });
      await createLotBatch(ctx(), {
        variantId: f.variantId,
        warehouseId: f.warehouseId,
        lotNumber: 'SOON-1',
        expiresAt: new Date(Date.now() + 10 * 86_400_000).toISOString(),
        quantity: 20,
        hazmatClass: 'none',
      });
      await createLotBatch(ctx(), {
        variantId: f.variantId,
        warehouseId: f.warehouseId,
        lotNumber: 'UNDATED-1',
        quantity: 20,
        hazmatClass: 'none',
      });
    });

    it('never picks an expired batch, even though it sorts first by date', async () => {
      // The exact failure FEFO exists to prevent: `ORDER BY expires_at ASC` puts
      // the MOST expired lot at the front, so before Phase 9.8 a location
      // holding one out-of-date box shipped it to every customer until it ran
      // out.
      const lot = await withTenant(ctx(), (tx) =>
        resolveFefoLot(tx, { tenantId, variantId: f.variantId, warehouseId: f.warehouseId })
      );
      expect(lot?.lotNumber).toBe('SOON-1');
    });

    it('buckets by horizon and keeps undated batches out of the safe end', async () => {
      const report = await listExpiringStock(ctx(), { withinDays: 90 });
      const mine = report.items.filter((i) => i.variantId === f.variantId);
      expect(mine.find((i) => i.lotNumber === 'EXPIRED-1')?.bucket).toBe('expired');
      expect(mine.find((i) => i.lotNumber === 'SOON-1')?.bucket).toBe('d30');
      // Its own bucket, not folded into "more than 90 days" — a batch nobody
      // dated is a data-entry finding, not a reassuring green row.
      expect(mine.find((i) => i.lotNumber === 'UNDATED-1')?.bucket).toBe('undated');
      expect(report.undatedLots).toBeGreaterThanOrEqual(1);
    });

    it('writes an expired batch off as a LOSS, not as damage', async () => {
      const report = await listExpiringStock(ctx(), { withinDays: 90 });
      const expired = report.items.find((i) => i.lotNumber === 'EXPIRED-1');
      const before = await levelOf(f);

      const result = await writeOffExpiringLot(ctx(), {
        lotId: expired!.lotId,
        reason: 'Past its use-by date',
      });
      expect(result.unitsWrittenOff).toBe(20);

      const after = await levelOf(f);
      expect(after!.onHand).toBe(before!.onHand - 20);

      const movement = await withTenant(ctx(), (tx) =>
        tx.inventoryMovement.findFirst({
          where: { tenantId, referenceType: 'LotBatch', referenceId: expired!.lotId },
          select: { reason: true },
        })
      );
      // Expired goods are a buying problem, not a shrinkage one. Filing them as
      // damage sends somebody looking for a thief who does not exist.
      expect(movement?.reason).toBe('loss');
    });
  });

  /* ── A delivery clears the queue, end to end ────────────────────────────── */

  describe('a real delivery clears a real queue', () => {
    it('allocates on receipt, in order, inside the receipt transaction', async () => {
      const f = await createInventoryFixture(tenantId);
      await allowOversell(f);
      nextCode += 1;
      const supplierId = (
        await createSupplier(ctx(), {
          name: `Replenisher ${nextCode}`,
          code: `REP${nextCode}`,
          currency: 'USD',
        })
      ).id;

      const early = await makeOrder(await makeCustomer('Early'));
      const late = await makeOrder(await makeCustomer('Late'));
      const [firstSale] = await sell(f, early, 6, 'line-early');
      await sell(f, late, 6, 'line-late');

      // Against the location the sale drew from — see the note in "filling the
      // queue". A delivery into a different warehouse would (correctly) clear
      // nothing, because the people waiting are waiting somewhere else.
      const po = await createPurchaseOrder(ctx(), {
        supplierId,
        warehouseId: firstSale!.warehouseId,
        lines: [{ variantId: f.variantId, quantity: 8, unitCostCents: 500 }],
      });
      await submitPurchaseOrder(ctx(), po.id, {});
      const poLine = await withTenant(ctx(), (tx) =>
        tx.purchaseOrderLine.findFirst({ where: { purchaseOrderId: po.id } })
      );
      await createGoodsReceipt(ctx(), {
        purchaseOrderId: po.id,
        lines: [{ purchaseOrderLineId: poLine!.id, quantity: 8 }],
      });

      const list = await listBackorders(ctx(), { variantId: f.variantId });
      const first = list.items.find((i) => i.holderId === early);
      const second = list.items.find((i) => i.holderId === late);
      // Eight units against two sixes: the first is covered, the second gets the
      // remaining two. Whoever ordered first is served first, and it is written
      // down rather than decided at the receiving desk.
      expect(first?.status).toBe('allocated');
      expect(first?.allocatedQuantity).toBe(6);
      expect(second?.status).toBe('partial');
      expect(second?.allocatedQuantity).toBe(2);
    });
  });
});
