// DB-backed coverage for supplier performance and procurement discipline
// (docs/146 Phase 8).
//
// The claims worth pinning, because each one is a decision about money that goes
// wrong quietly if it breaks:
//
//   1. A supplier nobody can measure scores NULL, not zero — and each component
//      is null on its own terms rather than defaulting to a rate.
//   2. A supplier who delivered late, short and dear scores badly, and the
//      figures behind the grade are the real ones.
//   3. A quantity price break is applied by the PURCHASE-ORDER path, so the cost
//      a buyer is shown and the cost the order records cannot diverge.
//   4. A spending limit HOLDS an order: it goes to `pending_approval`, nothing is
//      stamped as ordered, and receiving against it is refused.
//   5. Approving places the order (and only then); rejecting returns it to draft
//      and leaves the refusal on the trail.
//   6. A late order is flagged ONCE, and rescheduling re-arms it.
//   7. An advance ship notice moves no stock, and its discrepancy is null until
//      a delivery is actually booked against it.
//   8. Sending a return takes the units off the shelf, records what is owed, and
//      leaves `creditReceivedCents` NULL until somebody records a credit.
//   9. The three-way match compares against what was RECEIVED, and an unexplained
//      variance BLOCKS approval until it is accepted with a reason.
//
// Requires `pnpm db:up`; skipped in CI (no DB) per vitest.config.ts.

import crypto from 'node:crypto';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { withTenant } from '@wizeworks/db';

import { createGoodsReceipt } from '../../src/services/goods-receipts.js';
import { createPurchaseOrder } from '../../src/services/purchase-orders.js';
import {
  cancelPurchaseOrder,
  reschedulePurchaseOrderArrival,
  submitPurchaseOrder,
} from '../../src/services/purchase-order-lifecycle.js';
import {
  createPoApprovalRule,
  decidePoApproval,
  listPoApprovals,
  updatePoApprovalRule,
} from '../../src/services/purchase-order-approvals.js';
import {
  listLatePurchaseOrders,
  sweepLatePurchaseOrders,
} from '../../src/services/purchase-order-alerts.js';
import { createSupplier } from '../../src/services/suppliers.js';
import { upsertSupplierVariant } from '../../src/services/supplier-variants.js';
import { getPriceLadder, setPriceBreaks } from '../../src/services/supplier-price-breaks.js';
import {
  getSupplierScorecard,
  recomputeSupplierScorecards,
} from '../../src/services/supplier-scorecard.js';
import { recomputeLeadTimes } from '../../src/services/lead-times.js';
import {
  cancelAdvanceShipNotice,
  createAdvanceShipNotice,
  getAdvanceShipNotice,
  prefillFromAdvanceShipNotice,
} from '../../src/services/advance-ship-notices.js';
import {
  createSupplierReturn,
  getSupplierReturn,
  listSupplierReturns,
  recordSupplierCredit,
  sendSupplierReturn,
} from '../../src/services/supplier-returns.js';
import {
  approveSupplierBill,
  acceptBillVariance,
  createSupplierBill,
  disputeSupplierBill,
  settleBillQuery,
  getSupplierBill,
} from '../../src/services/supplier-bills.js';
import {
  createInventoryFixture,
  createTestTenant,
  dropTestTenant,
  type InventoryFixture,
} from '../helpers.js';

describe('supplier performance + procurement — DB-backed', () => {
  let tenantId: string;
  // A REAL user row: the approval trail carries a foreign key to `users`,
  // deliberately — a signature attributed to a uuid nobody can look up is not
  // an audit trail. A random id here fails the constraint, which is the
  // constraint doing its job.
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
  const supplier = async (leadTimeDays?: number) => {
    nextCode += 1;
    const created = await createSupplier(ctx(), {
      name: `Supplier ${nextCode}`,
      code: `SUP${nextCode}`,
      currency: 'USD',
      ...(leadTimeDays !== undefined ? { leadTimeDays } : {}),
    });
    return created.id;
  };

  /** Raise, and place, an order for one item. */
  const placeOrder = async (
    supplierId: string,
    f: InventoryFixture,
    quantity: number,
    unitCostCents: number
  ) => {
    const created = await createPurchaseOrder(ctx(), {
      supplierId,
      warehouseId: f.warehouseId,
      lines: [{ variantId: f.variantId, quantity, unitCostCents }],
    });
    await submitPurchaseOrder(ctx(), created.id, {});
    return created.id;
  };

  const orderRow = (id: string) =>
    withTenant(ctx(), (tx) => tx.purchaseOrder.findUnique({ where: { id } }));

  const levelOf = (f: InventoryFixture) =>
    withTenant(ctx(), (tx) =>
      tx.inventoryLevel.findUnique({
        where: { variantId_warehouseId: { variantId: f.variantId, warehouseId: f.warehouseId } },
      })
    );

  /** Move an order's `ordered_at` (and the matching receipt) into the past, so a
   *  lead time and a lateness can be measured at all. */
  const backdateOrder = (purchaseOrderId: string, daysAgo: number) =>
    withTenant(
      ctx(),
      (tx) => tx.$executeRaw`
        UPDATE inventory_purchase_orders
           SET ordered_at = now() - make_interval(days => ${daysAgo}::int),
               expected_arrival_at = now() - make_interval(days => ${daysAgo - 3}::int)
         WHERE id = ${purchaseOrderId}::uuid
      `
    );

  const backdateReceipt = (purchaseOrderId: string, daysAgo: number) =>
    withTenant(
      ctx(),
      (tx) => tx.$executeRaw`
        UPDATE inventory_goods_receipts
           SET received_at = now() - make_interval(days => ${daysAgo}::int)
         WHERE purchase_order_id = ${purchaseOrderId}::uuid
      `
    );

  /* ── 1 + 2. The scorecard ───────────────────────────────────────────────── */

  describe('supplier scorecard', () => {
    let unmeasurable: string;
    let bad: string;
    let badOrder: string;
    let f: InventoryFixture;

    beforeAll(async () => {
      f = await createInventoryFixture(tenantId);

      // Nothing has ever been ordered from this one.
      unmeasurable = await supplier();

      // Promised 5 days, took 10; ordered 100, delivered 90; agreed 500, billed
      // 550; two of the ninety arrived broken.
      bad = await supplier(5);
      badOrder = await placeOrder(bad, f, 100, 500);
      await backdateOrder(badOrder, 20);

      const line = await withTenant(ctx(), (tx) =>
        tx.purchaseOrderLine.findFirstOrThrow({ where: { purchaseOrderId: badOrder } })
      );
      await createGoodsReceipt(ctx(), {
        purchaseOrderId: badOrder,
        lines: [
          {
            purchaseOrderLineId: line.id,
            quantity: 88,
            quantityDamaged: 2,
            unitCostCents: 550,
          },
        ],
      });
      await backdateReceipt(badOrder, 10);

      // Close the order so its lines count toward the fill rate — an open line
      // is in transit, not short.
      await withTenant(
        ctx(),
        (tx) => tx.$executeRaw`
          UPDATE inventory_purchase_orders SET status = 'closed'
           WHERE id = ${badOrder}::uuid
        `
      );

      await recomputeLeadTimes(ctx());
      await recomputeSupplierScorecards(ctx());
    });

    it('scores NULL, not zero, for a supplier nobody could measure', async () => {
      const card = await getSupplierScorecard(ctx(), unmeasurable);
      expect(card).not.toBeNull();
      // The row exists — they are on the list — but nothing about them is known,
      // and a zero here would read as "they are terrible".
      expect(card?.score).toBeNull();
      expect(card?.grade).toBeNull();
      expect(card?.scoredComponents).toBe(0);
      expect(card?.onTimeRate).toBeNull();
      expect(card?.fillRate).toBeNull();
      expect(card?.priceVariancePct).toBeNull();
      expect(card?.damageRate).toBeNull();
    });

    it('measures late, short, dear and damaged against a supplier who was all four', async () => {
      const card = await getSupplierScorecard(ctx(), bad);
      expect(card).not.toBeNull();

      // Due at order + 3 days (the expected arrival the fixture set), arrived on
      // day 10 of 20 — so seven days late, and none of one delivery on time.
      expect(card?.onTimeRate).toBe(0);
      expect(card?.onTimeSample).toBe(1);
      expect(card?.lateDeliveries).toBe(1);
      expect(Number(card?.avgDaysLate)).toBeGreaterThan(0);

      // 88 good units credited against 100 ordered: the one line is short.
      expect(card?.fillRate).toBe(0);
      expect(card?.shortLines).toBe(1);
      expect(card?.fillRateSample).toBe(1);

      // Billed 550 against an agreed 500 — 10% over.
      expect(Number(card?.priceVariancePct)).toBeCloseTo(10, 1);

      // Two of the ninety that turned up were broken.
      expect(card?.damagedUnits).toBe(2);
      expect(Number(card?.damageRate)).toBeCloseTo(2 / 90, 3);

      // Four measurable components, and a grade that reflects them.
      expect(card?.scoredComponents).toBe(4);
      expect(card?.score).not.toBeNull();
      expect(card?.grade).toBe('D');
    });

    it('copies the lead-time measurement rather than taking its own', async () => {
      const card = await getSupplierScorecard(ctx(), bad);
      // Ordered 20 days ago, received 10 days ago → 10 days, against a promise
      // of 5. If this ever disagrees with the lead-times table, one of them is
      // measuring something the other is not.
      expect(Number(card?.leadTimeMeanDays)).toBeCloseTo(10, 0);
      expect(card?.leadTimePromisedDays).toBe(5);
      expect(Number(card?.leadTimeVarianceDays)).toBeCloseTo(5, 0);
      expect(card?.leadTimeSample).toBe(1);
    });
  });

  /* ── 3. Quantity price breaks ───────────────────────────────────────────── */

  describe('quantity price breaks', () => {
    it('applies the largest break the order quantity clears, through the PO path', async () => {
      const f = await createInventoryFixture(tenantId);
      const supplierId = await supplier();
      const link = await upsertSupplierVariant(ctx(), supplierId, {
        variantId: f.variantId,
        unitCostCents: 410,
      });
      await setPriceBreaks(ctx(), link.id, {
        breaks: [
          { minQuantity: 10, unitCostCents: 390 },
          { minQuantity: 50, unitCostCents: 360 },
        ],
      });

      // Below the first rung: the base price.
      const small = await createPurchaseOrder(ctx(), {
        supplierId,
        warehouseId: f.warehouseId,
        lines: [{ variantId: f.variantId, quantity: 4 }],
      });
      expect(small.lines[0]?.unitCostCents).toBe(410);

      // Past the second: the second rung, not the first and not the cheapest in
      // the ladder for its own sake.
      const big = await createPurchaseOrder(ctx(), {
        supplierId,
        warehouseId: f.warehouseId,
        lines: [{ variantId: f.variantId, quantity: 60 }],
      });
      expect(big.lines[0]?.unitCostCents).toBe(360);

      // A price the buyer TYPED is a negotiated one and always wins.
      const typed = await createPurchaseOrder(ctx(), {
        supplierId,
        warehouseId: f.warehouseId,
        lines: [{ variantId: f.variantId, quantity: 60, unitCostCents: 375 }],
      });
      expect(typed.lines[0]?.unitCostCents).toBe(375);
    });

    it('replaces the whole ladder rather than patching it', async () => {
      const f = await createInventoryFixture(tenantId);
      const supplierId = await supplier();
      const link = await upsertSupplierVariant(ctx(), supplierId, {
        variantId: f.variantId,
        unitCostCents: 100,
      });
      await setPriceBreaks(ctx(), link.id, {
        breaks: [
          { minQuantity: 10, unitCostCents: 90 },
          { minQuantity: 20, unitCostCents: 80 },
        ],
      });
      await setPriceBreaks(ctx(), link.id, { breaks: [{ minQuantity: 10, unitCostCents: 95 }] });

      const ladder = await getPriceLadder(ctx(), link.id);
      // Two rungs in, one rung out: a stale rung left behind would price an
      // order at last year's terms and nobody would notice.
      expect(ladder.breaks).toHaveLength(1);
      expect(ladder.breaks[0]?.unitCostCents).toBe(95);
    });
  });

  /* ── 4 + 5. Spending limits ─────────────────────────────────────────────── */

  describe('purchase-order approval', () => {
    let f: InventoryFixture;
    let supplierId: string;
    let rule: { id: string };

    beforeAll(async () => {
      f = await createInventoryFixture(tenantId);
      supplierId = await supplier();
      rule = await createPoApprovalRule(ctx(), {
        name: 'Over $100',
        minAmountCents: 10_000,
      });
    });

    // A spending limit is TENANT-WIDE, so leaving it in force would silently
    // hold every order the rest of this file places. Switching it off is also
    // the honest way to do it — deleting the rule would erase the trail of the
    // orders it held, which is the thing the SetNull foreign key protects.
    afterAll(async () => {
      await updatePoApprovalRule(ctx(), rule.id, { isActive: false });
    });

    it('holds an order over the limit, and orders nothing', async () => {
      const created = await createPurchaseOrder(ctx(), {
        supplierId,
        warehouseId: f.warehouseId,
        lines: [{ variantId: f.variantId, quantity: 100, unitCostCents: 500 }],
      });
      const submitted = await submitPurchaseOrder(ctx(), created.id, {});

      expect(submitted.status).toBe('pending_approval');
      // NOT stamped as ordered. An `orderedAt` written here would make an
      // unapproved order look placed to every report that reads it.
      expect(submitted.orderedAt).toBeNull();

      const queue = await listPoApprovals(ctx(), { status: 'pending' });
      expect(queue.items.some((row) => row.purchaseOrderId === created.id)).toBe(true);
      expect(queue.items.find((row) => row.purchaseOrderId === created.id)?.amountCents).toBe(
        50_000
      );
    });

    it('refuses a delivery against a held order', async () => {
      const created = await createPurchaseOrder(ctx(), {
        supplierId,
        warehouseId: f.warehouseId,
        lines: [{ variantId: f.variantId, quantity: 100, unitCostCents: 500 }],
      });
      await submitPurchaseOrder(ctx(), created.id, {});
      const line = await withTenant(ctx(), (tx) =>
        tx.purchaseOrderLine.findFirstOrThrow({ where: { purchaseOrderId: created.id } })
      );

      await expect(
        createGoodsReceipt(ctx(), {
          purchaseOrderId: created.id,
          lines: [{ purchaseOrderLineId: line.id, quantity: 10 }],
        })
      ).rejects.toThrow(/pending_approval/);
    });

    it('places the order only when somebody approves it', async () => {
      const created = await createPurchaseOrder(ctx(), {
        supplierId,
        warehouseId: f.warehouseId,
        lines: [{ variantId: f.variantId, quantity: 100, unitCostCents: 500 }],
      });
      await submitPurchaseOrder(ctx(), created.id, {});

      const queue = await listPoApprovals(ctx(), { purchaseOrderId: created.id });
      const approvalId = queue.items[0]?.id ?? '';
      const approved = await decidePoApproval(ctx(), approvalId, { decision: 'approved' });

      expect(approved.status).toBe('submitted');
      expect(approved.orderedAt).not.toBeNull();
    });

    it('sends a rejected order back to draft with the refusal on the trail', async () => {
      const created = await createPurchaseOrder(ctx(), {
        supplierId,
        warehouseId: f.warehouseId,
        lines: [{ variantId: f.variantId, quantity: 100, unitCostCents: 500 }],
      });
      await submitPurchaseOrder(ctx(), created.id, {});
      const queue = await listPoApprovals(ctx(), { purchaseOrderId: created.id });
      const approvalId = queue.items[0]?.id ?? '';

      const rejected = await decidePoApproval(ctx(), approvalId, {
        decision: 'rejected',
        note: 'Split it across two months.',
      });
      // Draft, not cancelled — a rejection is "change this and ask again", and
      // cancelling would make the buyer retype the whole order.
      expect(rejected.status).toBe('draft');

      const trail = await listPoApprovals(ctx(), {
        purchaseOrderId: created.id,
        status: 'rejected',
      });
      expect(trail.items[0]?.note).toBe('Split it across two months.');
      expect(trail.items[0]?.decidedAt).not.toBeNull();
    });

    it('creates a limit that covers every supplier and location', async () => {
      // The form's DEFAULT state: "Any supplier · Any location", which a form
      // sends as null rather than as a missing key. The create schema refused
      // null while the patch accepted it, so this exact payload saved when
      // editing a limit and 400'd when making one. Zero limits existed on the
      // whole platform as a result, and therefore zero orders had ever been
      // held for sign-off.
      const everywhere = await createPoApprovalRule(ctx(), {
        name: 'Anything at all',
        minAmountCents: 500_00,
        supplierId: null,
        warehouseId: null,
        requiredApproverUserId: null,
        requiredRole: null,
      });
      expect(everywhere.supplierId).toBeNull();
      expect(everywhere.warehouseId).toBeNull();
      await updatePoApprovalRule(ctx(), everywhere.id, { isActive: false });
    });

    it('refuses a signature from below the role the limit names', async () => {
      const owned = await createPoApprovalRule(ctx(), {
        name: 'The owner signs this',
        minAmountCents: 10_000,
        requiredRole: 'owner',
        sortOrder: -10,
      });
      try {
        const created = await createPurchaseOrder(ctx(), {
          supplierId,
          warehouseId: f.warehouseId,
          lines: [{ variantId: f.variantId, quantity: 100, unitCostCents: 500 }],
        });
        await submitPurchaseOrder(ctx(), created.id, {});
        const queue = await listPoApprovals(ctx(), { purchaseOrderId: created.id });
        const approvalId = queue.items[0]?.id ?? '';
        // The rule is what narrows the endpoint, which admits any editor. Left
        // unchecked, the person who raised the order signed their own off under
        // a rule that said the owner.
        expect(queue.items[0]?.requiredRole).toBe('owner');
        await expect(
          decidePoApproval(ctx(), approvalId, { decision: 'approved' }, 'editor')
        ).rejects.toThrow(/signed off by the owner/);

        const still = await listPoApprovals(ctx(), { purchaseOrderId: created.id });
        expect(still.items[0]?.status).toBe('pending');

        const signed = await decidePoApproval(ctx(), approvalId, { decision: 'approved' }, 'owner');
        expect(signed.status).toBe('submitted');
      } finally {
        await updatePoApprovalRule(ctx(), owned.id, { isActive: false });
      }
    });

    it('returns the WHOLE trail for one order, refusals included', async () => {
      // The buyer's own pane reads this. Asking for one order used to default to
      // pending, so a buyer whose order had been sent back got an empty list
      // and a screen that said nothing had happened.
      const created = await createPurchaseOrder(ctx(), {
        supplierId,
        warehouseId: f.warehouseId,
        lines: [{ variantId: f.variantId, quantity: 100, unitCostCents: 500 }],
      });
      await submitPurchaseOrder(ctx(), created.id, {});
      const first = await listPoApprovals(ctx(), { purchaseOrderId: created.id });
      await decidePoApproval(
        ctx(),
        first.items[0]?.id ?? '',
        { decision: 'rejected', note: 'Get a second quote.' },
        'owner'
      );
      await submitPurchaseOrder(ctx(), created.id, {});

      const trail = await listPoApprovals(ctx(), { purchaseOrderId: created.id });
      expect(trail.items).toHaveLength(2);
      // Oldest first, so the story reads in order.
      expect(trail.items[0]?.status).toBe('rejected');
      expect(trail.items[0]?.note).toBe('Get a second quote.');
      expect(trail.items[1]?.status).toBe('pending');
    });

    it('refuses to decide the same request twice', async () => {
      const created = await createPurchaseOrder(ctx(), {
        supplierId,
        warehouseId: f.warehouseId,
        lines: [{ variantId: f.variantId, quantity: 100, unitCostCents: 500 }],
      });
      await submitPurchaseOrder(ctx(), created.id, {});
      const queue = await listPoApprovals(ctx(), { purchaseOrderId: created.id });
      const approvalId = queue.items[0]?.id ?? '';
      await decidePoApproval(ctx(), approvalId, { decision: 'approved' });

      await expect(
        decidePoApproval(ctx(), approvalId, { decision: 'rejected', note: 'changed my mind' })
      ).rejects.toThrow(/already/);
    });

    it('cancels the pending request when the order itself is cancelled', async () => {
      const created = await createPurchaseOrder(ctx(), {
        supplierId,
        warehouseId: f.warehouseId,
        lines: [{ variantId: f.variantId, quantity: 100, unitCostCents: 500 }],
      });
      await submitPurchaseOrder(ctx(), created.id, {});
      await cancelPurchaseOrder(ctx(), created.id);

      const stillPending = await listPoApprovals(ctx(), {
        purchaseOrderId: created.id,
        status: 'pending',
      });
      // A dead entry in an approval queue is how a queue stops being worked.
      expect(stillPending.items).toHaveLength(0);
    });
  });

  /* ── 6. Late orders ─────────────────────────────────────────────────────── */

  describe('late purchase orders', () => {
    it('flags an overdue order once, and rescheduling re-arms it', async () => {
      const f = await createInventoryFixture(tenantId);
      const supplierId = await supplier(5);
      const orderId = await placeOrder(supplierId, f, 10, 100);
      await backdateOrder(orderId, 30);

      const first = await sweepLatePurchaseOrders(ctx());
      expect(first.newlyFlagged).toBeGreaterThanOrEqual(1);
      expect((await orderRow(orderId))?.lateAlertedAt).not.toBeNull();

      // Second night: still overdue, still on the list, but NOT re-announced.
      // A nightly re-fire for six weeks is how an alert gets muted.
      const second = await sweepLatePurchaseOrders(ctx());
      const stillListed = await listLatePurchaseOrders(ctx());
      expect(stillListed.items.some((row) => row.purchaseOrderId === orderId)).toBe(true);
      expect(second.newlyFlagged).toBe(0);

      // A new promised date is a new promise, so a broken one is heard again.
      await reschedulePurchaseOrderArrival(ctx(), orderId, {
        expectedArrivalAt: new Date(Date.now() - 86_400_000).toISOString(),
      });
      expect((await orderRow(orderId))?.lateAlertedAt).toBeNull();
      const third = await sweepLatePurchaseOrders(ctx());
      expect(third.newlyFlagged).toBeGreaterThanOrEqual(1);
    });

    it('counts an order with no due date as undated rather than as on time', async () => {
      const f = await createInventoryFixture(tenantId);
      // No stated lead time and no expected arrival: nothing to be late for.
      const supplierId = await supplier();
      const created = await createPurchaseOrder(ctx(), {
        supplierId,
        warehouseId: f.warehouseId,
        lines: [{ variantId: f.variantId, quantity: 5, unitCostCents: 100 }],
      });
      await submitPurchaseOrder(ctx(), created.id, {});

      const report = await listLatePurchaseOrders(ctx());
      expect(report.items.some((row) => row.purchaseOrderId === created.id)).toBe(false);
      expect(report.undated).toBeGreaterThanOrEqual(1);
    });
  });

  /* ── 7. Advance ship notices ────────────────────────────────────────────── */

  describe('advance ship notices', () => {
    it('moves no stock, and reports no discrepancy until something arrives', async () => {
      const f = await createInventoryFixture(tenantId);
      const supplierId = await supplier();
      const orderId = await placeOrder(supplierId, f, 20, 250);
      const line = await withTenant(ctx(), (tx) =>
        tx.purchaseOrderLine.findFirstOrThrow({ where: { purchaseOrderId: orderId } })
      );

      const before = await levelOf(f);
      const asn = await createAdvanceShipNotice(ctx(), {
        purchaseOrderId: orderId,
        carrier: 'Palletways',
        lines: [{ purchaseOrderLineId: line.id, quantityShipped: 20 }],
      });
      const after = await levelOf(f);

      // A supplier's word is not a delivery.
      expect(after?.onHand ?? 0).toBe(before?.onHand ?? 0);
      // NOT `false`. Nobody has opened the pallet, so "it matched" would be a
      // claim about an unopened box.
      expect(asn.hasDiscrepancy).toBeNull();
      expect(asn.lines[0]?.discrepancyUnits).toBeNull();

      // Pre-fill hands the receiver the supplier's claim, unclamped.
      const prefill = await prefillFromAdvanceShipNotice(ctx(), asn.id);
      expect(prefill.lines[0]?.quantity).toBe(20);
      expect(prefill.lines[0]?.exceedsOutstanding).toBe(false);
    });

    it('reports the gap once the delivery is booked against it', async () => {
      const f = await createInventoryFixture(tenantId);
      const supplierId = await supplier();
      const orderId = await placeOrder(supplierId, f, 20, 250);
      const line = await withTenant(ctx(), (tx) =>
        tx.purchaseOrderLine.findFirstOrThrow({ where: { purchaseOrderId: orderId } })
      );
      const asn = await createAdvanceShipNotice(ctx(), {
        purchaseOrderId: orderId,
        lines: [{ purchaseOrderLineId: line.id, quantityShipped: 20 }],
      });

      // Sixteen turned up against twenty claimed.
      await createGoodsReceipt(ctx(), {
        purchaseOrderId: orderId,
        advanceShipNoticeId: asn.id,
        lines: [{ purchaseOrderLineId: line.id, quantity: 16 }],
      });

      const settled = await getAdvanceShipNotice(ctx(), asn.id);
      expect(settled.status).toBe('received');
      expect(settled.hasDiscrepancy).toBe(true);
      expect(settled.lines[0]?.discrepancyUnits).toBe(-4);
    });

    it('judges each notice against its OWN delivery, not the line’s running total', async () => {
      // The case the test above cannot see. With ONE delivery per order, the
      // line's lifetime total and what arrived on that delivery are the same
      // number, so comparing the notice with either gives the same answer and a
      // green test. Take two deliveries — the ordinary shape for a supplier who
      // sends dispatch notes at all — and they part company: the second notice
      // was judged against everything that had ever arrived and read "4 more
      // than the notice", warning about paying twice, over a delivery that
      // matched to the unit.
      const f = await createInventoryFixture(tenantId);
      const supplierId = await supplier();
      const orderId = await placeOrder(supplierId, f, 6, 1800);
      const line = await withTenant(ctx(), (tx) =>
        tx.purchaseOrderLine.findFirstOrThrow({ where: { purchaseOrderId: orderId } })
      );

      // Four of six, exactly as the first note said.
      const first = await createAdvanceShipNotice(ctx(), {
        purchaseOrderId: orderId,
        lines: [{ purchaseOrderLineId: line.id, quantityShipped: 4 }],
      });
      await createGoodsReceipt(ctx(), {
        purchaseOrderId: orderId,
        advanceShipNoticeId: first.id,
        lines: [{ purchaseOrderLineId: line.id, quantity: 4 }],
      });

      // Then the last two, also exactly as the second note said.
      const second = await createAdvanceShipNotice(ctx(), {
        purchaseOrderId: orderId,
        lines: [{ purchaseOrderLineId: line.id, quantityShipped: 2 }],
      });
      await createGoodsReceipt(ctx(), {
        purchaseOrderId: orderId,
        advanceShipNoticeId: second.id,
        lines: [{ purchaseOrderLineId: line.id, quantity: 2 }],
      });

      const settledSecond = await getAdvanceShipNotice(ctx(), second.id);
      expect(settledSecond.lines[0]?.quantityArrivedOnThisDelivery).toBe(2);
      // The line has taken in 6 over its life; that is context on the row, and
      // is NOT what the notice is measured against.
      expect(settledSecond.lines[0]?.quantityReceived).toBe(6);
      expect(settledSecond.lines[0]?.discrepancyUnits).toBe(0);
      expect(settledSecond.hasDiscrepancy).toBe(false);

      // And the first notice still reads true once a later delivery has landed.
      const settledFirst = await getAdvanceShipNotice(ctx(), first.id);
      expect(settledFirst.lines[0]?.quantityArrivedOnThisDelivery).toBe(4);
      expect(settledFirst.lines[0]?.discrepancyUnits).toBe(0);
      expect(settledFirst.hasDiscrepancy).toBe(false);
    });

    it('refuses to receive against a notice that was called off', async () => {
      const f = await createInventoryFixture(tenantId);
      const supplierId = await supplier();
      const orderId = await placeOrder(supplierId, f, 5, 100);
      const line = await withTenant(ctx(), (tx) =>
        tx.purchaseOrderLine.findFirstOrThrow({ where: { purchaseOrderId: orderId } })
      );
      const asn = await createAdvanceShipNotice(ctx(), {
        purchaseOrderId: orderId,
        lines: [{ purchaseOrderLineId: line.id, quantityShipped: 5 }],
      });
      await cancelAdvanceShipNotice(ctx(), asn.id);

      await expect(
        createGoodsReceipt(ctx(), {
          purchaseOrderId: orderId,
          advanceShipNoticeId: asn.id,
          lines: [{ purchaseOrderLineId: line.id, quantity: 5 }],
        })
        // American spelling, matching the message the service actually raises.
        // The sweep that changed "cancelled" to "canceled" in the copy left this
        // assertion behind, so the guard has been red rather than guarding.
      ).rejects.toThrow(/canceled/);
    });
  });

  /* ── 8. Returns to supplier ─────────────────────────────────────────────── */

  describe('returns to supplier', () => {
    it('moves stock on SEND, and leaves the credit null until one is recorded', async () => {
      const f = await createInventoryFixture(tenantId);
      const supplierId = await supplier();
      const orderId = await placeOrder(supplierId, f, 50, 400);
      const line = await withTenant(ctx(), (tx) =>
        tx.purchaseOrderLine.findFirstOrThrow({ where: { purchaseOrderId: orderId } })
      );
      await createGoodsReceipt(ctx(), {
        purchaseOrderId: orderId,
        lines: [{ purchaseOrderLineId: line.id, quantity: 50 }],
      });
      const onHandBefore = (await levelOf(f))?.onHand ?? 0;

      const draft = await createSupplierReturn(ctx(), {
        supplierId,
        warehouseId: f.warehouseId,
        purchaseOrderId: orderId,
        reason: 'damaged',
        lines: [{ variantId: f.variantId, quantity: 6 }],
      });

      // A draft is a list being assembled while the pallet is still here.
      expect(draft.status).toBe('draft');
      expect((await levelOf(f))?.onHand ?? 0).toBe(onHandBefore);
      // Costed from the order line — 6 × 400.
      expect(draft.creditExpectedCents).toBe(2400);
      expect(draft.creditReceivedCents).toBeNull();
      expect(draft.creditShortfallCents).toBeNull();

      const sent = await sendSupplierReturn(ctx(), draft.id);
      expect(sent.status).toBe('sent');
      expect(sent.sentAt).not.toBeNull();
      expect((await levelOf(f))?.onHand ?? 0).toBe(onHandBefore - 6);
      // Still null. "We are waiting" and "they refused" are different facts.
      expect(sent.creditReceivedCents).toBeNull();

      // A short credit is the most common way money is lost on returns, and it
      // is invisible unless the expectation was written down first.
      const credited = await recordSupplierCredit(ctx(), draft.id, {
        creditReceivedCents: 2000,
      });
      expect(credited.status).toBe('credited');
      expect(credited.creditShortfallCents).toBe(400);
    });

    it('writes a return_to_supplier movement, not a loss', async () => {
      const f = await createInventoryFixture(tenantId);
      const supplierId = await supplier();
      const orderId = await placeOrder(supplierId, f, 10, 100);
      const line = await withTenant(ctx(), (tx) =>
        tx.purchaseOrderLine.findFirstOrThrow({ where: { purchaseOrderId: orderId } })
      );
      await createGoodsReceipt(ctx(), {
        purchaseOrderId: orderId,
        lines: [{ purchaseOrderLineId: line.id, quantity: 10 }],
      });

      const ret = await createSupplierReturn(ctx(), {
        supplierId,
        warehouseId: f.warehouseId,
        reason: 'wrong_item',
        lines: [{ variantId: f.variantId, quantity: 3, unitCostCents: 100 }],
      });
      await sendSupplierReturn(ctx(), ret.id);

      const movements = await withTenant(ctx(), (tx) =>
        tx.inventoryMovement.findMany({
          where: { variantId: f.variantId, referenceType: 'SupplierReturn' },
        })
      );
      // Its own reason. Folded into `loss`, this would libel the warehouse in
      // every shrinkage report.
      expect(movements).toHaveLength(1);
      expect(movements[0]?.reason).toBe('return_to_supplier');
      expect(movements[0]?.delta).toBe(-3);
    });

    it('falls back through order line → supplier link → average cost', async () => {
      const f = await createInventoryFixture(tenantId);
      const supplierId = await supplier();
      // No order, no receipt: the only cost on record is the catalogue one the
      // fixture set. A return must still carry a credit expectation.
      const ret = await createSupplierReturn(ctx(), {
        supplierId,
        warehouseId: f.warehouseId,
        reason: 'overstock',
        lines: [{ variantId: f.variantId, quantity: 2 }],
      });
      expect(ret.creditExpectedCents).toBe(1000);
    });

    it('refuses a line it cannot cost rather than writing the money off at zero', async () => {
      const f = await createInventoryFixture(tenantId);
      const supplierId = await supplier();
      // A variant nobody has ever costed: no purchase, no supplier link, no
      // average, no catalogue cost. Recording a return worth £0 here would move
      // the stock and silently write the money off, which is the exact failure
      // this whole feature exists to stop.
      const uncosted = await withTenant(ctx(), (tx) =>
        tx.productVariant.create({
          data: {
            tenantId,
            productId: f.productId,
            sku: `UNCOSTED-${crypto.randomBytes(3).toString('hex')}`,
            priceCents: 1000,
            currency: 'USD',
          },
        })
      );

      await expect(
        createSupplierReturn(ctx(), {
          supplierId,
          warehouseId: f.warehouseId,
          reason: 'overstock',
          lines: [{ variantId: uncosted.id, quantity: 1 }],
        })
      ).rejects.toThrow(/cost/i);
    });

    it('the ever-count sees past the view the list is filtered to', async () => {
      // An empty list is two opposite facts: everything has been credited, or
      // nothing was ever sent back. The chase view said the first — "Every
      // return you have sent has been credited or written off" — over every
      // business on the platform, none of which had sent one. `total` is the
      // FILTERED count and cannot tell them apart; this is the number that can.
      // A delta, not a total: every test in this file shares one tenant, so an
      // absolute figure measures whatever ran before it.
      const before = await listSupplierReturns(ctx(), { awaitingCreditOnly: true });

      const f = await createInventoryFixture(tenantId);
      const supplierId = await supplier();
      await createSupplierReturn(ctx(), {
        supplierId,
        warehouseId: f.warehouseId,
        reason: 'quality',
        lines: [{ variantId: f.variantId, quantity: 1, unitCostCents: 500 }],
      });

      // Still a DRAFT, so the chase view is empty — and that empty list now
      // means something different from the empty one above.
      const chase = await listSupplierReturns(ctx(), { awaitingCreditOnly: true });
      expect(chase.items).toHaveLength(before.items.length);
      expect(chase.total).toBe(before.total);
      expect(chase.everCount).toBe(before.everCount + 1);
    });

    it('detail reads back what was sent', async () => {
      const f = await createInventoryFixture(tenantId);
      const supplierId = await supplier();
      const created = await createSupplierReturn(ctx(), {
        supplierId,
        warehouseId: f.warehouseId,
        reason: 'quality',
        lines: [{ variantId: f.variantId, quantity: 2, unitCostCents: 750 }],
      });
      const read = await getSupplierReturn(ctx(), created.id);
      expect(read.lines).toHaveLength(1);
      expect(read.lines[0]?.lineTotalCents).toBe(1500);
      expect(read.creditExpectedCents).toBe(1500);
    });
  });

  /* ── 9. The three-way match ─────────────────────────────────────────────── */

  describe('supplier bills and the three-way match', () => {
    const setup = async (opts: { ordered: number; received: number; cost: number }) => {
      const f = await createInventoryFixture(tenantId);
      const supplierId = await supplier();
      const orderId = await placeOrder(supplierId, f, opts.ordered, opts.cost);
      const line = await withTenant(ctx(), (tx) =>
        tx.purchaseOrderLine.findFirstOrThrow({ where: { purchaseOrderId: orderId } })
      );
      if (opts.received > 0) {
        await createGoodsReceipt(ctx(), {
          purchaseOrderId: orderId,
          lines: [{ purchaseOrderLineId: line.id, quantity: opts.received }],
        });
      }
      return { f, supplierId, orderId, lineId: line.id };
    };

    let billCounter = 0;
    const nextNumber = () => {
      billCounter += 1;
      return `INV-${billCounter}`;
    };

    it('passes a bill that agrees with what was ordered and received', async () => {
      const s = await setup({ ordered: 10, received: 10, cost: 400 });
      const bill = await createSupplierBill(ctx(), {
        supplierId: s.supplierId,
        purchaseOrderId: s.orderId,
        number: nextNumber(),
        billedAt: new Date().toISOString(),
        lines: [{ purchaseOrderLineId: s.lineId, quantity: 10, unitCostCents: 400 }],
      });

      expect(bill.match.ok).toBe(true);
      expect(bill.match.linesFlagged).toBe(0);
      expect(bill.match.totalVarianceCents).toBe(0);

      const approved = await approveSupplierBill(ctx(), bill.id);
      expect(approved.status).toBe('approved');
    });

    it('catches a bill for goods that never arrived, and BLOCKS approval', async () => {
      // Ten ordered, eight arrived, ten billed. Checking against the ORDER would
      // wave this through; the two missing units are the money.
      const s = await setup({ ordered: 10, received: 8, cost: 400 });
      const bill = await createSupplierBill(ctx(), {
        supplierId: s.supplierId,
        purchaseOrderId: s.orderId,
        number: nextNumber(),
        billedAt: new Date().toISOString(),
        lines: [{ purchaseOrderLineId: s.lineId, quantity: 10, unitCostCents: 400 }],
      });

      expect(bill.match.ok).toBe(false);
      expect(bill.lines[0]?.match.verdict).toBe('over_billed');
      expect(bill.lines[0]?.match.quantityVarianceUnits).toBe(2);
      expect(bill.match.totalVarianceCents).toBe(800);

      await expect(approveSupplierBill(ctx(), bill.id)).rejects.toThrow(/do not agree|differ/i);

      // The way past it is a written reason, recorded against a person.
      const accepted = await acceptBillVariance(ctx(), bill.id, {
        note: 'Two were damaged and are going back separately.',
      });
      expect(accepted.varianceAcceptedAt).not.toBeNull();

      const approved = await approveSupplierBill(ctx(), bill.id);
      expect(approved.status).toBe('approved');
    });

    it('catches the small price drift that repeats every month', async () => {
      const s = await setup({ ordered: 100, received: 100, cost: 400 });
      const bill = await createSupplierBill(ctx(), {
        supplierId: s.supplierId,
        purchaseOrderId: s.orderId,
        number: nextNumber(),
        billedAt: new Date().toISOString(),
        lines: [{ purchaseOrderLineId: s.lineId, quantity: 100, unitCostCents: 412 }],
      });
      expect(bill.lines[0]?.match.verdict).toBe('price_higher');
      expect(bill.match.totalVarianceCents).toBe(1200);
    });

    it('reports NULL — not "matched" — when there is nothing to check against', async () => {
      const supplierId = await supplier();
      const bill = await createSupplierBill(ctx(), {
        supplierId,
        number: nextNumber(),
        billedAt: new Date().toISOString(),
        lines: [{ quantity: 1, unitCostCents: 4500, description: 'Pallet delivery charge' }],
      });
      // A freight-only bill, tied to no order, has not PASSED the check — the
      // check never ran.
      expect(bill.match.ok).toBeNull();
      expect(bill.match.totalVarianceCents).toBeNull();

      // And it can still be approved, because there is nothing to explain.
      const approved = await approveSupplierBill(ctx(), bill.id);
      expect(approved.status).toBe('approved');
    });

    it('flags a line that was never ordered on its own terms', async () => {
      const s = await setup({ ordered: 5, received: 5, cost: 200 });
      const bill = await createSupplierBill(ctx(), {
        supplierId: s.supplierId,
        purchaseOrderId: s.orderId,
        number: nextNumber(),
        billedAt: new Date().toISOString(),
        lines: [
          { purchaseOrderLineId: s.lineId, quantity: 5, unitCostCents: 200 },
          { quantity: 2, unitCostCents: 1500, description: 'Something nobody asked for' },
        ],
      });
      expect(bill.match.unorderedLines).toBe(1);
      expect(bill.match.ok).toBe(false);
    });

    it('passes a partial invoice, and does not offer to dispute it', async () => {
      // Forty arrived, the supplier has invoiced two of them. This is the normal
      // state of an order that turns up in more than one drop, and blocking it
      // leaves only two wrong doors: sign off a variance that never happened, or
      // query a supplier who did nothing unusual (issue 510).
      const s = await setup({ ordered: 40, received: 40, cost: 1800 });
      const bill = await createSupplierBill(ctx(), {
        supplierId: s.supplierId,
        purchaseOrderId: s.orderId,
        number: nextNumber(),
        billedAt: new Date().toISOString(),
        lines: [{ purchaseOrderLineId: s.lineId, quantity: 2, unitCostCents: 1800 }],
      });

      expect(bill.lines[0]?.match.verdict).toBe('under_billed');
      expect(bill.match.ok).toBe(true);
      expect(bill.match.linesFlagged).toBe(0);
      // Nothing wrongly charged, so nothing at stake...
      expect(bill.match.totalVarianceCents).toBe(0);
      // ...but the 38 metres still to be invoiced are worth saying out loud.
      expect(bill.match.uninvoicedCents).toBe(38 * 1800);

      // And it pays, with no override and nobody's name against it.
      const approved = await approveSupplierBill(ctx(), bill.id);
      expect(approved.status).toBe('approved');
      expect(approved.varianceAcceptedAt).toBeNull();
    });

    it('catches the same delivery invoiced twice', async () => {
      // Neither invoice on its own exceeds what arrived, so nothing but the
      // OTHER invoice can tell the second one apart from the first. Before this
      // counted them, a supplier could invoice one drop twice and both bills
      // matched perfectly (issue 510).
      const s = await setup({ ordered: 40, received: 40, cost: 1800 });
      const first = await createSupplierBill(ctx(), {
        supplierId: s.supplierId,
        purchaseOrderId: s.orderId,
        number: nextNumber(),
        billedAt: new Date().toISOString(),
        lines: [{ purchaseOrderLineId: s.lineId, quantity: 38, unitCostCents: 1800 }],
      });
      expect(first.lines[0]?.match.verdict).toBe('under_billed');
      expect(first.lines[0]?.alreadyBilledQuantity).toBe(0);

      const duplicate = await createSupplierBill(ctx(), {
        supplierId: s.supplierId,
        purchaseOrderId: s.orderId,
        number: nextNumber(),
        billedAt: new Date().toISOString(),
        lines: [{ purchaseOrderLineId: s.lineId, quantity: 38, unitCostCents: 1800 }],
      });
      expect(duplicate.lines[0]?.alreadyBilledQuantity).toBe(38);
      expect(duplicate.lines[0]?.match.verdict).toBe('over_billed');
      expect(duplicate.lines[0]?.match.quantityVarianceUnits).toBe(36);
      expect(duplicate.match.ok).toBe(false);
      await expect(approveSupplierBill(ctx(), duplicate.id)).rejects.toThrow(
        /do not agree|differ/i
      );
    });

    it('stops a queried invoice from counting against the correct one', async () => {
      // The duplicate above gets queried, which is the right thing to do with
      // it. A bill nobody is going to pay must not consume any of what the other
      // invoices may legitimately charge for - otherwise disputing the duplicate
      // makes the CORRECT invoice read as over-billed (issue 511).
      const s = await setup({ ordered: 40, received: 40, cost: 1800 });
      const good = await createSupplierBill(ctx(), {
        supplierId: s.supplierId,
        purchaseOrderId: s.orderId,
        number: nextNumber(),
        billedAt: new Date().toISOString(),
        lines: [{ purchaseOrderLineId: s.lineId, quantity: 2, unitCostCents: 1800 }],
      });
      const duplicate = await createSupplierBill(ctx(), {
        supplierId: s.supplierId,
        purchaseOrderId: s.orderId,
        number: nextNumber(),
        billedAt: new Date().toISOString(),
        lines: [{ purchaseOrderLineId: s.lineId, quantity: 38, unitCostCents: 1800 }],
      });
      const third = await createSupplierBill(ctx(), {
        supplierId: s.supplierId,
        purchaseOrderId: s.orderId,
        number: nextNumber(),
        billedAt: new Date().toISOString(),
        lines: [{ purchaseOrderLineId: s.lineId, quantity: 38, unitCostCents: 1800 }],
      });
      // With 2 + 38 + 38 = 78 on the paper against 40 that arrived, the correct
      // first invoice reads as over-billed.
      expect((await getSupplierBill(ctx(), good.id)).lines[0]?.match.verdict).toBe('over_billed');

      await disputeSupplierBill(ctx(), third.id, 'Same 38 as the one before it.');

      const settled = await getSupplierBill(ctx(), good.id);
      expect(settled.lines[0]?.alreadyBilledQuantity).toBe(38);
      expect(settled.lines[0]?.match.verdict).toBe('matched');
      expect(settled.match.ok).toBe(true);
      void duplicate;
    });

    it('will not accept a difference on an invoice that is out with the supplier', async () => {
      // It would write over the query's reason, stamp the variance accepted, and
      // leave the status on `disputed` - after which approve and pay both refuse
      // and the bill is stranded with no record of why (issue 511).
      const s = await setup({ ordered: 10, received: 8, cost: 400 });
      const bill = await createSupplierBill(ctx(), {
        supplierId: s.supplierId,
        purchaseOrderId: s.orderId,
        number: nextNumber(),
        billedAt: new Date().toISOString(),
        lines: [{ purchaseOrderLineId: s.lineId, quantity: 10, unitCostCents: 400 }],
      });
      const queried = await disputeSupplierBill(ctx(), bill.id, 'Two never arrived.');
      expect(queried.status).toBe('disputed');
      expect(queried.notes).toBe('Two never arrived.');

      await expect(acceptBillVariance(ctx(), bill.id, { note: 'Fine, pay it.' })).rejects.toThrow(
        /out with the supplier/i
      );
      // The reason it was queried is untouched.
      expect((await getSupplierBill(ctx(), bill.id)).notes).toBe('Two never arrived.');
    });

    it('lets a query be settled, and the bill carry on', async () => {
      // `disputed` used to be a one-way door: approve refuses on it, pay refuses
      // on it, and the only other transition in the service is `cancelled`. So
      // the ordinary ending of a query had nowhere to go (issue 511).
      const s = await setup({ ordered: 10, received: 8, cost: 400 });
      const bill = await createSupplierBill(ctx(), {
        supplierId: s.supplierId,
        purchaseOrderId: s.orderId,
        number: nextNumber(),
        billedAt: new Date().toISOString(),
        lines: [{ purchaseOrderLineId: s.lineId, quantity: 10, unitCostCents: 400 }],
      });
      await disputeSupplierBill(ctx(), bill.id, 'Two never arrived.');
      await expect(approveSupplierBill(ctx(), bill.id)).rejects.toThrow();

      const settled = await settleBillQuery(ctx(), bill.id);
      expect(settled.status).toBe('draft');
      // Settling is not accepting: the difference still has to be explained.
      await expect(approveSupplierBill(ctx(), bill.id)).rejects.toThrow(/do not agree|differ/i);

      await acceptBillVariance(ctx(), bill.id, { note: 'They credited the two.' });
      expect((await approveSupplierBill(ctx(), bill.id)).status).toBe('approved');
    });

    it('refuses to settle a query on an invoice that is not out with anybody', async () => {
      const s = await setup({ ordered: 1, received: 1, cost: 100 });
      const bill = await createSupplierBill(ctx(), {
        supplierId: s.supplierId,
        purchaseOrderId: s.orderId,
        number: nextNumber(),
        billedAt: new Date().toISOString(),
        lines: [{ purchaseOrderLineId: s.lineId, quantity: 1, unitCostCents: 100 }],
      });
      await expect(settleBillQuery(ctx(), bill.id)).rejects.toThrow(/not out with the supplier/i);
    });

    it('refuses the same invoice number from one supplier twice', async () => {
      const s = await setup({ ordered: 1, received: 1, cost: 100 });
      const number = nextNumber();
      await createSupplierBill(ctx(), {
        supplierId: s.supplierId,
        purchaseOrderId: s.orderId,
        number,
        billedAt: new Date().toISOString(),
        lines: [{ purchaseOrderLineId: s.lineId, quantity: 1, unitCostCents: 100 }],
      });
      await expect(
        createSupplierBill(ctx(), {
          supplierId: s.supplierId,
          number,
          billedAt: new Date().toISOString(),
          lines: [{ quantity: 1, unitCostCents: 100 }],
        })
      ).rejects.toThrow(/already been entered/i);
    });

    it('reads a bill back with its match intact', async () => {
      const s = await setup({ ordered: 4, received: 4, cost: 300 });
      const created = await createSupplierBill(ctx(), {
        supplierId: s.supplierId,
        purchaseOrderId: s.orderId,
        number: nextNumber(),
        billedAt: new Date().toISOString(),
        lines: [{ purchaseOrderLineId: s.lineId, quantity: 4, unitCostCents: 300 }],
      });
      const read = await getSupplierBill(ctx(), created.id);
      expect(read.match.ok).toBe(true);
      expect(read.totalCents).toBe(1200);
    });
  });
});
