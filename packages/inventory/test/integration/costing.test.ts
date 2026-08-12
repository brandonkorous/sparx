// DB-backed coverage for true cost (docs/146 Phase 5).
//
// Nearly every claim this phase makes is a claim about arithmetic across three
// ledgers, so nearly none of it can be proven with a fake. The tests pin the
// decisions that would be expensive to get wrong and easy to break later:
//
//   1. Freight reaches the cost basis. A delivery with a shipping bill raises
//      the moving average and the cost layer by the SHARE that landed on each
//      line — which is the entire point of the phase.
//   2. An allocation adds up. Largest-remainder rounding means the per-line
//      amounts sum to the charge exactly; a penny lost per line is how a
//      landed-cost report stops being reconcilable.
//   3. A sale stamps what the goods cost. `cost_consumed_cents` is written when
//      the stock leaves, so last quarter's margin does not move when tomorrow's
//      delivery changes the average.
//   4. FIFO consumes oldest first, and a cancelled order gives the units BACK to
//      the layers it took them from rather than re-costing them at today's
//      average — the regression that would silently reorder every layer behind it.
//   5. A charge arriving late revalues what is still on the shelf and NOTHING
//      that has already sold.
//   6. Valuation as of a past date is the ledgers walked back, not a snapshot.
//
// Plus the refusals and the honesty: units the layers cannot cover are reported
// rather than valued at zero, and re-running an allocation is idempotent.
//
// Requires `pnpm db:up`; skipped in CI (no DB) per vitest.config.ts.

import crypto from 'node:crypto';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { withTenant } from '@sparx/db';

import { applyMovement } from '../../src/services/ledger.js';
import { commitSaleOnTx, reverseOrderSale } from '../../src/services/sell-path.js';
import { createSupplier } from '../../src/services/suppliers.js';
import { createPurchaseOrder } from '../../src/services/purchase-orders.js';
import { submitPurchaseOrder } from '../../src/services/purchase-order-lifecycle.js';
import { createGoodsReceipt, getGoodsReceipt } from '../../src/services/goods-receipts.js';
import {
  allocateCharge,
  createGoodsReceiptCharge,
  createPurchaseOrderCharge,
  deleteGoodsReceiptCharge,
  getLandedCostBreakdown,
} from '../../src/services/landed-cost.js';
import { updateCostingPolicy } from '../../src/services/costing-policy.js';
import { listOpenLayers } from '../../src/services/cost-layers.js';
import {
  cogsReport,
  priceVarianceReport,
  valuationAsOf,
  variantCostLayers,
} from '../../src/services/cost-reports.js';
import {
  createInventoryFixture,
  createTestTenant,
  dropTestTenant,
  type InventoryFixture,
} from '../helpers.js';

describe('true cost — DB-backed', () => {
  let tenantId: string;
  let customerId: string;
  const userId = crypto.randomUUID();
  const ctx = () => ({ tenantId, userId });

  beforeAll(async () => {
    tenantId = (await createTestTenant()).tenantId;
    customerId = await withTenant({ tenantId }, async (tx) => {
      const customer = await tx.customer.create({
        data: {
          tenantId,
          firstName: 'Ines',
          lastName: 'Marchetti',
          email: `cost-${crypto.randomBytes(4).toString('hex')}@example.test`,
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

  const levelOf = (f: InventoryFixture) =>
    withTenant(ctx(), (tx) =>
      tx.inventoryLevel.findUnique({
        where: { variantId_warehouseId: { variantId: f.variantId, warehouseId: f.warehouseId } },
      })
    );

  /** A submitted order for one variant, ready to receive against. */
  async function submittedOrder(
    f: InventoryFixture,
    lines: { variantId: string; quantity: number; unitCostCents: number }[]
  ): Promise<{ poId: string; lineIds: string[] }> {
    const supplier = await createSupplier(ctx(), {
      name: `Supplier ${crypto.randomBytes(2).toString('hex')}`,
      code: `SUP-${crypto.randomBytes(2).toString('hex')}`.toUpperCase().slice(0, 15),
    });
    const po = await createPurchaseOrder(ctx(), {
      supplierId: supplier.id,
      warehouseId: f.warehouseId,
      lines,
    });
    const submitted = await submitPurchaseOrder(ctx(), po.id, {});
    return { poId: po.id, lineIds: submitted.lines.map((l) => l.id) };
  }

  /** A placed order whose stock has actually been committed — the only way the
   *  sale path stamps a cost, and therefore the only honest way to test it. */
  async function sell(f: InventoryFixture, quantity: number): Promise<string> {
    return withTenant(ctx(), async (tx) => {
      const order = await tx.order.create({
        data: {
          tenantId,
          customerId,
          orderNumber: `SO-${crypto.randomBytes(4).toString('hex')}`,
          status: 'placed',
          currency: 'USD',
          placedAt: new Date(),
        },
        select: { id: true },
      });
      const item = await tx.orderItem.create({
        data: {
          tenantId,
          orderId: order.id,
          variantId: f.variantId,
          sku: 'TEST-PART',
          name: 'Test Part',
          quantity,
          unitPrice: 10,
          lineTotal: 10 * quantity,
        },
        select: { id: true },
      });
      await commitSaleOnTx(tx, ctx(), {
        orderId: order.id,
        lines: [{ variantId: f.variantId, quantity, reservationId: null, lineKey: item.id }],
      });
      return order.id;
    });
  }

  const saleMovements = (f: InventoryFixture) =>
    withTenant(ctx(), (tx) =>
      tx.inventoryMovement.findMany({
        where: { variantId: f.variantId, reason: 'sale' },
        orderBy: { createdAt: 'asc' },
      })
    );

  /* ── 1. Freight reaches the cost basis ──────────────────────────────────── */

  it('lands shipping into the unit cost, the moving average and the cost layer', async () => {
    const f = await createInventoryFixture(tenantId);
    const { poId, lineIds } = await submittedOrder(f, [
      { variantId: f.variantId, quantity: 100, unitCostCents: 400 },
    ]);

    // £400 of goods, £62 of shipping → £4.62 a unit, not £4.00.
    const receipt = await createGoodsReceipt(ctx(), {
      purchaseOrderId: poId,
      lines: [{ purchaseOrderLineId: lineIds[0]!, quantity: 100 }],
      charges: [{ kind: 'freight', amountCents: 6200 }],
    });

    expect(receipt.chargeTotalCents).toBe(6200);
    expect(receipt.goodsValueCents).toBe(40_000);
    expect(receipt.landedTotalCents).toBe(46_200);
    expect(receipt.lines[0]!.landedUnitCostCents).toBe(462);
    expect(receipt.lines[0]!.allocatedChargeCents).toBe(6200);
    // The invoice price is still recorded — the freight is on top of it, not
    // instead of it.
    expect(receipt.lines[0]!.unitCostCents).toBe(400);

    // The average is the LANDED cost. This is the number every margin figure on
    // the platform reads, and before this phase it would have said 400.
    expect((await levelOf(f))?.avgCostCents).toBe(462);

    const layers = await withTenant(ctx(), (tx) =>
      listOpenLayers(tx, { tenantId, variantId: f.variantId })
    );
    expect(layers).toHaveLength(1);
    expect(layers[0]!.unitCostCents).toBe(462);
    expect(layers[0]!.goodsUnitCostCents).toBe(400);
    expect(layers[0]!.quantityRemaining).toBe(100);
  });

  /* ── 2. An allocation adds up ───────────────────────────────────────────── */

  it('splits a charge across lines so the parts sum to the whole, every basis', () => {
    const lines = [
      { id: 'a', quantity: 3, goodsValueCents: 1000, weightGrams: 300 },
      { id: 'b', quantity: 1, goodsValueCents: 1, weightGrams: 5000 },
      { id: 'c', quantity: 7, goodsValueCents: 333, weightGrams: 0 },
    ];
    // 101 pence over three lines is the case naive rounding gets wrong in both
    // directions — it cannot divide evenly by value, quantity OR weight.
    for (const basis of ['value', 'quantity', 'weight'] as const) {
      const result = allocateCharge(
        {
          id: 'x',
          kind: 'freight',
          amountCents: 101,
          basis,
          origin: 'delivery',
          description: null,
        },
        lines
      );
      const total = Object.values(result.perLine).reduce((s, n) => s + n, 0);
      expect(total).toBe(101);
    }

    // Weight with nothing weighed falls back to units rather than allocating
    // nothing — and SAYS it fell back.
    const unweighed = [
      { id: 'a', quantity: 2, goodsValueCents: 500, weightGrams: 0 },
      { id: 'b', quantity: 2, goodsValueCents: 500, weightGrams: 0 },
    ];
    const fallback = allocateCharge(
      {
        id: 'x',
        kind: 'freight',
        amountCents: 100,
        basis: 'weight',
        origin: 'delivery',
        description: null,
      },
      unweighed
    );
    expect(fallback.basisFellBack).toBe(true);
    expect(fallback.perLine.a).toBe(50);
    expect(fallback.perLine.b).toBe(50);
  });

  it('spreads a charge by value across several lines on one delivery', async () => {
    const cheap = await createInventoryFixture(tenantId);
    const dear = await createInventoryFixture(tenantId);
    const { poId, lineIds } = await submittedOrder(cheap, [
      { variantId: cheap.variantId, quantity: 10, unitCostCents: 100 },
      { variantId: dear.variantId, quantity: 10, unitCostCents: 900 },
    ]);

    // £1,000 of goods split 10/90 by value → £10 of duty splits £1/£9.
    const receipt = await createGoodsReceipt(ctx(), {
      purchaseOrderId: poId,
      lines: [
        { purchaseOrderLineId: lineIds[0]!, quantity: 10 },
        { purchaseOrderLineId: lineIds[1]!, quantity: 10 },
      ],
      charges: [{ kind: 'duty', amountCents: 1000, allocationBasis: 'value' }],
    });

    const byVariant = new Map(receipt.lines.map((l) => [l.variantId, l]));
    expect(byVariant.get(cheap.variantId)!.allocatedChargeCents).toBe(100);
    expect(byVariant.get(dear.variantId)!.allocatedChargeCents).toBe(900);
    expect(byVariant.get(cheap.variantId)!.landedUnitCostCents).toBe(110);
    expect(byVariant.get(dear.variantId)!.landedUnitCostCents).toBe(990);
  });

  /* ── 3. A sale stamps what the goods cost ───────────────────────────────── */

  it('stamps the cost of goods on the sale movement', async () => {
    const f = await createInventoryFixture(tenantId);
    const { poId, lineIds } = await submittedOrder(f, [
      { variantId: f.variantId, quantity: 50, unitCostCents: 200 },
    ]);
    await createGoodsReceipt(ctx(), {
      purchaseOrderId: poId,
      lines: [{ purchaseOrderLineId: lineIds[0]!, quantity: 50 }],
      charges: [{ kind: 'freight', amountCents: 500 }],
    });
    // 50 @ 200 + 500 freight → 210 a unit.
    await sell(f, 4);

    const [sale] = await saleMovements(f);
    expect(sale?.costConsumedCents).toBe(840);

    // And it is a SUM, not a re-derivation. Another delivery at a different
    // price must not change what that sale cost.
    const second = await submittedOrder(f, [
      { variantId: f.variantId, quantity: 50, unitCostCents: 900 },
    ]);
    await createGoodsReceipt(ctx(), {
      purchaseOrderId: second.poId,
      lines: [{ purchaseOrderLineId: second.lineIds[0]!, quantity: 50 }],
    });
    const [saleAgain] = await saleMovements(f);
    expect(saleAgain?.costConsumedCents).toBe(840);
  });

  /* ── 4. FIFO, and giving units back on a cancellation ───────────────────── */

  it('consumes the oldest layer first under FIFO and costs the sale from it', async () => {
    await updateCostingPolicy(ctx(), { method: 'fifo' });
    const f = await createInventoryFixture(tenantId);

    const first = await submittedOrder(f, [
      { variantId: f.variantId, quantity: 10, unitCostCents: 300 },
    ]);
    await createGoodsReceipt(ctx(), {
      purchaseOrderId: first.poId,
      lines: [{ purchaseOrderLineId: first.lineIds[0]!, quantity: 10 }],
      receivedAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
    });
    const second = await submittedOrder(f, [
      { variantId: f.variantId, quantity: 10, unitCostCents: 900 },
    ]);
    await createGoodsReceipt(ctx(), {
      purchaseOrderId: second.poId,
      lines: [{ purchaseOrderLineId: second.lineIds[0]!, quantity: 10 }],
    });

    // 12 units: all 10 of the cheap batch, then 2 of the dear one.
    const orderId = await sell(f, 12);
    const [sale] = await saleMovements(f);
    expect(sale?.costConsumedCents).toBe(10 * 300 + 2 * 900);

    const after = await variantCostLayers(ctx(), { variantId: f.variantId });
    expect(after.units).toBe(8);
    expect(after.valueCents).toBe(8 * 900);

    // Cancelling puts the units back on the layers they came off — NOT on a new
    // layer at today's average, which would re-cost them and reorder FIFO for
    // everything behind them.
    await reverseOrderSale(ctx(), { orderId });
    const restored = await variantCostLayers(ctx(), { variantId: f.variantId });
    expect(restored.units).toBe(20);
    expect(restored.valueCents).toBe(10 * 300 + 10 * 900);

    // And the reversal CREDITS the cost of goods rather than charging it, so
    // summing the column over a period nets a cancelled order to nothing.
    const cancel = await withTenant(ctx(), (tx) =>
      tx.inventoryMovement.findFirst({
        where: { variantId: f.variantId, reason: 'cancel' },
      })
    );
    expect(cancel?.costConsumedCents).toBe(-(10 * 300 + 2 * 900));

    await updateCostingPolicy(ctx(), { method: 'moving_average' });
  });

  /* ── 5. A late charge revalues only what is still here ──────────────────── */

  it('revalues stock still on hand when a shipping bill arrives late, and leaves sold units alone', async () => {
    const f = await createInventoryFixture(tenantId);
    const { poId, lineIds } = await submittedOrder(f, [
      { variantId: f.variantId, quantity: 100, unitCostCents: 500 },
    ]);
    const receipt = await createGoodsReceipt(ctx(), {
      purchaseOrderId: poId,
      lines: [{ purchaseOrderLineId: lineIds[0]!, quantity: 100 }],
    });
    expect((await levelOf(f))?.avgCostCents).toBe(500);

    // Sell 20 at £5.00 before the freight invoice turns up.
    await sell(f, 20);
    const [saleBefore] = await saleMovements(f);
    expect(saleBefore?.costConsumedCents).toBe(20 * 500);

    // The forwarder bills £100 a fortnight later: £1 a unit across all 100.
    await createGoodsReceiptCharge(ctx(), {
      goodsReceiptId: receipt.id,
      kind: 'freight',
      amountCents: 10_000,
    });

    const reread = await getGoodsReceipt(ctx(), receipt.id);
    expect(reread.lines[0]!.landedUnitCostCents).toBe(600);

    // 80 units still here, each worth £1 more → the average moves by exactly
    // the value change spread over what is on hand.
    const level = await levelOf(f);
    expect(level?.onHand).toBe(80);
    expect(level?.avgCostCents).toBe(600);

    const layers = await variantCostLayers(ctx(), { variantId: f.variantId });
    expect(layers.units).toBe(80);
    expect(layers.valueCents).toBe(80 * 600);

    // What already went out keeps the cost it went out at. Restating shipped
    // cost of goods is what an accountant means by "the books moved".
    const [saleAfter] = await saleMovements(f);
    expect(saleAfter?.costConsumedCents).toBe(20 * 500);
  });

  it('reverses cleanly when a charge is removed, and re-running the allocation is idempotent', async () => {
    const f = await createInventoryFixture(tenantId);
    const { poId, lineIds } = await submittedOrder(f, [
      { variantId: f.variantId, quantity: 10, unitCostCents: 1000 },
    ]);
    const receipt = await createGoodsReceipt(ctx(), {
      purchaseOrderId: poId,
      lines: [{ purchaseOrderLineId: lineIds[0]!, quantity: 10 }],
    });

    const charge = await createGoodsReceiptCharge(ctx(), {
      goodsReceiptId: receipt.id,
      kind: 'handling',
      amountCents: 500,
    });
    expect((await levelOf(f))?.avgCostCents).toBe(1050);

    // A second, unrelated charge must not re-apply the first — the allocation
    // replays the whole order from a zeroed base precisely so it cannot.
    await createGoodsReceiptCharge(ctx(), {
      goodsReceiptId: receipt.id,
      kind: 'insurance',
      amountCents: 500,
    });
    expect((await levelOf(f))?.avgCostCents).toBe(1100);

    await deleteGoodsReceiptCharge(ctx(), charge.id);
    expect((await levelOf(f))?.avgCostCents).toBe(1050);
  });

  it('apportions an order-level charge across part deliveries by value, remainder and all', async () => {
    const f = await createInventoryFixture(tenantId);
    const { poId, lineIds } = await submittedOrder(f, [
      { variantId: f.variantId, quantity: 3, unitCostCents: 1000 },
    ]);
    await createPurchaseOrderCharge(ctx(), {
      purchaseOrderId: poId,
      kind: 'freight',
      amountCents: 100,
    });

    // Two units of three: a third of the order's value, so a third of the
    // freight — 33 of 100, with the odd penny still owed.
    const first = await createGoodsReceipt(ctx(), {
      purchaseOrderId: poId,
      lines: [{ purchaseOrderLineId: lineIds[0]!, quantity: 2 }],
    });
    expect(first.chargeTotalCents).toBe(67);

    // The delivery that CLOSES the order sweeps up whatever rounding left
    // behind, so the freight is fully accounted for rather than 1p short.
    const second = await createGoodsReceipt(ctx(), {
      purchaseOrderId: poId,
      lines: [{ purchaseOrderLineId: lineIds[0]!, quantity: 1 }],
    });
    expect(second.chargeTotalCents).toBe(33);

    const charges = await withTenant(ctx(), (tx) =>
      tx.purchaseOrderCharge.findMany({ where: { purchaseOrderId: poId } })
    );
    expect(charges[0]!.allocatedCents).toBe(100);
  });

  /* ── 6. Valuation as of a past date ─────────────────────────────────────── */

  it('values the ledger as it stood at a moment in the past', async () => {
    const f = await createInventoryFixture(tenantId);
    const { poId, lineIds } = await submittedOrder(f, [
      { variantId: f.variantId, quantity: 30, unitCostCents: 250 },
    ]);
    await createGoodsReceipt(ctx(), {
      purchaseOrderId: poId,
      lines: [{ purchaseOrderLineId: lineIds[0]!, quantity: 30 }],
    });

    const afterReceipt = new Date();
    await new Promise((resolve) => setTimeout(resolve, 25));
    await sell(f, 10);

    const then = await valuationAsOf(ctx(), { asOf: afterReceipt, warehouseId: f.warehouseId });
    expect(then.totalUnits).toBe(30);
    expect(then.totalValueCents).toBe(30 * 250);

    const now = await valuationAsOf(ctx(), { asOf: new Date(), warehouseId: f.warehouseId });
    expect(now.totalUnits).toBe(20);
    expect(now.totalValueCents).toBe(20 * 250);
    // Everything here was costed, so nothing is unaccounted for.
    expect(now.uncostedUnits).toBe(0);
  });

  it('reports units it cannot value rather than pricing them at nothing', async () => {
    const f = await createInventoryFixture(tenantId);
    // Stock driven negative under a continue policy — the honest case where the
    // layers cannot cover what the movement ledger says is there.
    await withTenant(ctx(), (tx) =>
      applyMovement(tx, {
        tenantId,
        variantId: f.variantId,
        warehouseId: f.warehouseId,
        delta: -5,
        reason: 'sale',
        actorType: 'system',
        allowNegative: true,
      })
    );
    await withTenant(ctx(), (tx) =>
      applyMovement(tx, {
        tenantId,
        variantId: f.variantId,
        warehouseId: f.warehouseId,
        delta: 12,
        reason: 'recount',
        actorType: 'system',
        unitCostCents: 100,
      })
    );

    const report = await valuationAsOf(ctx(), { asOf: new Date(), warehouseId: f.warehouseId });
    expect(report.totalUnits).toBe(7);
    // 12 units of layer, 5 of which were never covered by one — so the layers
    // still hold 12 and the ledger says 7. The gap is REPORTED.
    expect(report.totalUnitsCovered).toBe(12);
    expect(report.uncostedUnits).toBe(0);
    expect(report.totalValueCents).toBe(1200);
  });

  /* ── Reporting ──────────────────────────────────────────────────────────── */

  it('compares what was planned against what was actually paid, landed', async () => {
    const f = await createInventoryFixture(tenantId);
    // The fixture's variant is planned at 500 (`costCents`).
    const { poId, lineIds } = await submittedOrder(f, [
      { variantId: f.variantId, quantity: 20, unitCostCents: 500 },
    ]);
    const from = new Date(Date.now() - 60 * 60 * 1000);
    await createGoodsReceipt(ctx(), {
      purchaseOrderId: poId,
      lines: [{ purchaseOrderLineId: lineIds[0]!, quantity: 20 }],
      // The supplier held their price and moved £1 a unit of freight onto us.
      charges: [{ kind: 'freight', amountCents: 2000 }],
    });

    const report = await priceVarianceReport(ctx(), {
      from,
      to: new Date(Date.now() + 60 * 1000),
      warehouseId: f.warehouseId,
    });
    const row = report.rows.find((r) => r.variantId === f.variantId);
    expect(row).toBeDefined();
    expect(row!.standardUnitCostCents).toBe(500);
    // Landed, not invoiced — which is the whole point of the report.
    expect(row!.actualUnitCostCents).toBe(600);
    expect(row!.varianceCents).toBe(2000);
    expect(row!.variancePercent).toBe(20);
  });

  it('totals the cost of goods by why they left', async () => {
    const f = await createInventoryFixture(tenantId);
    const { poId, lineIds } = await submittedOrder(f, [
      { variantId: f.variantId, quantity: 40, unitCostCents: 250 },
    ]);
    const from = new Date(Date.now() - 60 * 60 * 1000);
    await createGoodsReceipt(ctx(), {
      purchaseOrderId: poId,
      lines: [{ purchaseOrderLineId: lineIds[0]!, quantity: 40 }],
    });
    await sell(f, 8);
    await withTenant(ctx(), (tx) =>
      applyMovement(tx, {
        tenantId,
        variantId: f.variantId,
        warehouseId: f.warehouseId,
        delta: -2,
        reason: 'damage',
        actorType: 'system',
      })
    );

    const report = await cogsReport(ctx(), {
      from,
      to: new Date(Date.now() + 60 * 1000),
      warehouseId: f.warehouseId,
    });
    expect(report.saleCostCents).toBe(8 * 250);
    // Breakage is costed at what the units cost, and kept SEPARATE from what
    // was sold — adding them together hides the second inside the first.
    expect(report.byReason.find((r) => r.reason === 'damage')?.costCents).toBe(2 * 250);
    expect(report.totalCostCents).toBe(10 * 250);
  });

  it('gives back the landed-cost breakdown a delivery can be checked against', async () => {
    const f = await createInventoryFixture(tenantId);
    const { poId, lineIds } = await submittedOrder(f, [
      { variantId: f.variantId, quantity: 5, unitCostCents: 2000 },
    ]);
    const receipt = await createGoodsReceipt(ctx(), {
      purchaseOrderId: poId,
      lines: [{ purchaseOrderLineId: lineIds[0]!, quantity: 5 }],
      charges: [
        { kind: 'freight', amountCents: 1500 },
        { kind: 'duty', amountCents: 500 },
      ],
    });

    const breakdown = await getLandedCostBreakdown(ctx(), receipt.id);
    expect(breakdown.goodsValueCents).toBe(10_000);
    expect(breakdown.chargeTotalCents).toBe(2000);
    expect(breakdown.landedTotalCents).toBe(12_000);
    expect(breakdown.charges).toHaveLength(2);
    // Each charge is named and traceable to what it did — the report is meant
    // to be checkable against an invoice, not merely correct.
    expect(breakdown.charges.map((c) => c.kind).sort()).toEqual(['duty', 'freight']);
    expect(breakdown.lines[0]!.landedUnitCostCents).toBe(2400);
  });

  it('converts a foreign-currency delivery into the currency the books are kept in', async () => {
    const f = await createInventoryFixture(tenantId);
    const { poId, lineIds } = await submittedOrder(f, [
      { variantId: f.variantId, quantity: 10, unitCostCents: 1000 },
    ]);
    const receipt = await createGoodsReceipt(ctx(), {
      purchaseOrderId: poId,
      lines: [{ purchaseOrderLineId: lineIds[0]!, quantity: 10 }],
      fxRate: '1.25',
    });

    // €10.00 a unit at 1.25 → $12.50. The invoice price stays what the supplier
    // billed; only the basis is converted.
    expect(receipt.lines[0]!.unitCostCents).toBe(1000);
    expect(receipt.lines[0]!.baseUnitCostCents).toBe(1250);
    expect(receipt.lines[0]!.landedUnitCostCents).toBe(1250);
    expect((await levelOf(f))?.avgCostCents).toBe(1250);
    expect(receipt.fxRate).toBe(1.25);
  });
});
