// DB-backed coverage for units of measure and assembly (docs/146 Phase 6).
//
// The claims worth pinning, because each one is a stock number that goes wrong
// quietly if it breaks:
//
//   1. A pack unit converts at the EDGE and the ledger stores singles. Order 4
//      cases and on-hand moves by 48, not 4 — and the unit and factor are
//      snapshot so changing the factor later cannot rewrite the order.
//   2. A count entered in cartons reconciles against the same scale it is
//      compared with. A blind 12× error here is the most expensive bug in the
//      phase and the hardest to spot afterwards.
//   3. Completing a build moves BOTH ways in one transaction: components off,
//      finished goods on, and the finished cost is the sum of what actually left
//      the shelf plus labour — not a price-list estimate.
//   4. Releasing HOLDS rather than consuming, so `available` drops and `onHand`
//      does not, and cancelling gives it all back.
//   5. A disassembly is the same event reversed, and the value that went in
//      comes back out to the penny.
//   6. Buildable quantity is measured against what is FREE, and names the
//      component that runs out first.
//
// Requires `pnpm db:up`; skipped in CI (no DB) per vitest.config.ts.

import crypto from 'node:crypto';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { withTenant } from '@wizeworks/db';

import { InventoryConflictError, InventoryValidationError } from '../../src/errors.js';
import { applyMovement } from '../../src/services/ledger.js';
import { createSupplier } from '../../src/services/suppliers.js';
import { createPurchaseOrder, getPurchaseOrder } from '../../src/services/purchase-orders.js';
import { submitPurchaseOrder } from '../../src/services/purchase-order-lifecycle.js';
import { createGoodsReceipt } from '../../src/services/goods-receipts.js';
import {
  createInventoryCount,
  addCountLine,
  enterCounts,
} from '../../src/services/inventory-counts.js';
import {
  submitInventoryCount,
  postInventoryCount,
} from '../../src/services/inventory-count-lifecycle.js';
import {
  createUnitOfMeasure,
  listUnitsOfMeasure,
  setVariantUoms,
} from '../../src/services/units-of-measure.js';
import { buildableQuantity, createBom, setBomStatus } from '../../src/services/boms.js';
import {
  cancelAssemblyOrder,
  completeAssemblyOrder,
  createAssemblyOrder,
  releaseAssemblyOrder,
} from '../../src/services/assembly-orders.js';
import {
  createInventoryFixture,
  createTestTenant,
  dropTestTenant,
  type InventoryFixture,
} from '../helpers.js';

describe('units of measure and assembly — DB-backed', () => {
  let tenantId: string;
  const userId = crypto.randomUUID();
  const ctx = () => ({ tenantId, userId });

  beforeAll(async () => {
    tenantId = (await createTestTenant()).tenantId;
  });
  afterAll(async () => {
    await dropTestTenant(tenantId);
  });

  /* ── Fixtures ───────────────────────────────────────────────────────────── */

  const levelOf = (variantId: string, warehouseId: string) =>
    withTenant(ctx(), (tx) =>
      tx.inventoryLevel.findUnique({ where: { variantId_warehouseId: { variantId, warehouseId } } })
    );

  const stock = (f: InventoryFixture, delta: number, unitCostCents?: number) =>
    withTenant(ctx(), (tx) =>
      applyMovement(tx, {
        tenantId,
        variantId: f.variantId,
        warehouseId: f.warehouseId,
        delta,
        reason: 'receive',
        actorType: 'system',
        ...(unitCostCents !== undefined ? { unitCostCents } : {}),
      })
    );

  /** Put a variant into an EXISTING warehouse, so a recipe's components and its
   *  output are all in one location — which is what an assembly needs. */
  async function variantIn(
    warehouseId: string,
    opts: { costCents?: number; onHand?: number } = {}
  ): Promise<{ variantId: string; sku: string; warehouseId: string }> {
    const created = await withTenant(ctx(), async (tx) => {
      const product = await tx.product.create({
        data: {
          tenantId,
          title: `Part ${crypto.randomBytes(3).toString('hex')}`,
          handle: `part-${crypto.randomBytes(4).toString('hex')}`,
          status: 'active',
        },
        select: { id: true },
      });
      const variant = await tx.productVariant.create({
        data: {
          tenantId,
          productId: product.id,
          sku: `PART-${crypto.randomBytes(3).toString('hex')}`.toUpperCase(),
          priceCents: 1000,
          costCents: opts.costCents ?? 100,
          currency: 'USD',
          isDefault: true,
        },
        select: { id: true, sku: true },
      });
      return variant;
    });
    if (opts.onHand && opts.onHand > 0) {
      await withTenant(ctx(), (tx) =>
        applyMovement(tx, {
          tenantId,
          variantId: created.id,
          warehouseId,
          delta: opts.onHand!,
          reason: 'receive',
          unitCostCents: opts.costCents ?? 100,
          actorType: 'system',
        })
      );
    }
    return { variantId: created.id, sku: created.sku, warehouseId };
  }

  /** A unit, and what it means for one item. */
  async function caseOf(variantId: string, unitsPerUom: number, code = 'CS'): Promise<string> {
    const units = await listUnitsOfMeasure(ctx());
    const existing = units.find((u) => u.code === code);
    const unit =
      existing ??
      (await createUnitOfMeasure(ctx(), { code, name: code.toLowerCase(), dimension: 'count' }));
    await setVariantUoms(ctx(), {
      variantId,
      conversions: [{ uomId: unit.id, unitsPerUom, isPurchaseDefault: true }],
    });
    return unit.id;
  }

  /* ── 1. A pack converts at the edge; the ledger stores singles ──────────── */

  it('orders in cases and receives in cases, while the ledger only ever moves singles', async () => {
    const f = await createInventoryFixture(tenantId);
    await caseOf(f.variantId, 12);

    const supplier = await createSupplier(ctx(), {
      name: 'Case Supplier',
      code: `SUP${crypto.randomBytes(2).toString('hex')}`.toUpperCase().slice(0, 15),
    });
    // Four cases at £48 a case.
    const po = await createPurchaseOrder(ctx(), {
      supplierId: supplier.id,
      warehouseId: f.warehouseId,
      lines: [{ variantId: f.variantId, quantity: 4, unitCostCents: 4800, uomCode: 'CS' }],
    });

    const stored = await getPurchaseOrder(ctx(), po.id);
    // Stored in SINGLES — every existing sum, receipt and report keeps working
    // on one unit and needs to know nothing about cases.
    expect(stored.lines[0]!.quantityOrdered).toBe(48);
    expect(stored.lines[0]!.unitCostCents).toBe(400);
    // And the line still says how it was bought, so the printed order reads "4 cases".
    expect(stored.lines[0]!.uomCode).toBe('CS');
    expect(stored.lines[0]!.unitsPerUom).toBe(12);

    const submitted = await submitPurchaseOrder(ctx(), po.id, {});
    // The receiver counts THREE cartons and does not say "CS" — the delivery
    // inherits the order's unit, because a case order arrives in cases.
    const receipt = await createGoodsReceipt(ctx(), {
      purchaseOrderId: po.id,
      lines: [{ purchaseOrderLineId: submitted.lines[0]!.id, quantity: 3 }],
    });
    expect(receipt.lines[0]!.quantityReceived).toBe(36);
    expect(receipt.lines[0]!.uomCode).toBe('CS');
    expect((await levelOf(f.variantId, f.warehouseId))?.onHand).toBe(36);

    // Changing what a case means afterwards must NOT rewrite the order.
    await caseOf(f.variantId, 24);
    const reread = await getPurchaseOrder(ctx(), po.id);
    expect(reread.lines[0]!.unitsPerUom).toBe(12);
    expect(reread.lines[0]!.quantityOrdered).toBe(48);
  });

  it('refuses a unit the item has no conversion for, rather than guessing', async () => {
    const f = await createInventoryFixture(tenantId);
    const supplier = await createSupplier(ctx(), {
      name: 'No Case Supplier',
      code: `NC${crypto.randomBytes(2).toString('hex')}`.toUpperCase().slice(0, 15),
    });
    // Defaulting an unknown code to 1 would book "4 pallets" as four units and
    // be discovered at a stock take. It throws instead, naming the item.
    await expect(
      createPurchaseOrder(ctx(), {
        supplierId: supplier.id,
        warehouseId: f.warehouseId,
        lines: [{ variantId: f.variantId, quantity: 4, uomCode: 'PAL' }],
      })
    ).rejects.toBeInstanceOf(InventoryValidationError);
  });

  /* ── 2. A count in cartons reconciles on the right scale ────────────────── */

  it('counts in cartons and posts a correction in singles', async () => {
    const f = await createInventoryFixture(tenantId);
    await caseOf(f.variantId, 12);
    await stock(f, 36, 100);

    const count = await createInventoryCount(ctx(), {
      type: 'cycle',
      warehouseId: f.warehouseId,
    });
    await addCountLine(ctx(), count.id, { variantId: f.variantId, uomCode: 'CS' });
    const withLine = await withTenant(ctx(), (tx) =>
      tx.inventoryCountLine.findFirstOrThrow({ where: { countId: count.id } })
    );
    // Expected stays in singles — it is what the ledger holds.
    expect(withLine.expectedQuantity).toBe(36);
    expect(withLine.unitsPerUom).toBe(12);

    // The counter sees two full cartons and types 2.
    await enterCounts(ctx(), count.id, {
      entries: [{ lineId: withLine.id, countedQuantity: 2 }],
    });
    const counted = await withTenant(ctx(), (tx) =>
      tx.inventoryCountLine.findFirstOrThrow({ where: { id: withLine.id } })
    );
    // 24, not 2. Comparing 2 against an expected 36 would report a 34-unit loss
    // that never happened — the most expensive bug this phase could have.
    expect(counted.countedQuantity).toBe(24);

    await submitInventoryCount(ctx(), count.id);
    await postInventoryCount(ctx(), count.id);
    expect((await levelOf(f.variantId, f.warehouseId))?.onHand).toBe(24);
  });

  /* ── 3. Building moves both ways, and the cost is real ──────────────────── */

  it('consumes components, produces finished goods, and costs the output from what actually left', async () => {
    const base = await createInventoryFixture(tenantId);
    // A panel at £10 and four hinges at £2.50 → £20 of parts, plus £5 of time.
    const panel = await variantIn(base.warehouseId, { costCents: 1000, onHand: 20 });
    const hinge = await variantIn(base.warehouseId, { costCents: 250, onHand: 100 });
    const cabinet = await variantIn(base.warehouseId, { costCents: 0 });

    const bom = await createBom(ctx(), {
      outputVariantId: cabinet.variantId,
      name: 'Cabinet',
      outputQuantity: 1,
      laborCostCents: 500,
      components: [
        { variantId: panel.variantId, quantityPer: 1 },
        { variantId: hinge.variantId, quantityPer: 4 },
      ],
    });
    await setBomStatus(ctx(), bom.id, { status: 'active' });

    const run = await createAssemblyOrder(ctx(), {
      bomId: bom.id,
      warehouseId: base.warehouseId,
      quantity: 2,
    });
    expect(run.number).toMatch(/^ASM-\d{6}$/);
    // Nothing has moved on paper.
    expect((await levelOf(panel.variantId, base.warehouseId))?.onHand).toBe(20);

    const done = await completeAssemblyOrder(ctx(), run.id, {});

    // Components off the shelf…
    expect((await levelOf(panel.variantId, base.warehouseId))?.onHand).toBe(18);
    expect((await levelOf(hinge.variantId, base.warehouseId))?.onHand).toBe(92);
    // …and the finished thing on it, in the same transaction.
    expect((await levelOf(cabinet.variantId, base.warehouseId))?.onHand).toBe(2);

    // 2 panels (£20) + 8 hinges (£20) + £5 labour = £45 over 2 → £22.50 each.
    // Straight from the movements' own cost, not a price list.
    expect(done.totalCostCents).toBe(4500);
    expect(done.outputUnitCostCents).toBe(2250);
    expect((await levelOf(cabinet.variantId, base.warehouseId))?.avgCostCents).toBe(2250);

    // The movements are ordinary ledger rows with a reason anyone can read.
    const moves = await withTenant(ctx(), (tx) =>
      tx.inventoryMovement.findMany({
        where: { referenceType: 'AssemblyOrder', referenceId: run.id },
        orderBy: { createdAt: 'asc' },
      })
    );
    expect(moves.filter((m) => m.reason === 'assembly_out')).toHaveLength(2);
    expect(moves.filter((m) => m.reason === 'assembly_in')).toHaveLength(1);
  });

  it('completes for what actually came out, and scales the parts with it', async () => {
    const base = await createInventoryFixture(tenantId);
    const board = await variantIn(base.warehouseId, { costCents: 100, onHand: 100 });
    const shelf = await variantIn(base.warehouseId, { costCents: 0 });

    const bom = await createBom(ctx(), {
      outputVariantId: shelf.variantId,
      name: 'Shelf',
      outputQuantity: 1,
      components: [{ variantId: board.variantId, quantityPer: 2 }],
    });
    await setBomStatus(ctx(), bom.id, { status: 'active' });
    const run = await createAssemblyOrder(ctx(), {
      bomId: bom.id,
      warehouseId: base.warehouseId,
      quantity: 10,
    });

    // Ten planned, eight actually came out.
    const done = await completeAssemblyOrder(ctx(), run.id, { quantity: 8 });
    expect(done.quantityCompleted).toBe(8);
    expect((await levelOf(shelf.variantId, base.warehouseId))?.onHand).toBe(8);
    // 16 boards, not 20 — the parts scale with what was made.
    expect((await levelOf(board.variantId, base.warehouseId))?.onHand).toBe(84);

    // And a run cannot quietly grow past what was planned, because nobody
    // scheduled the parts for it.
    const second = await createAssemblyOrder(ctx(), {
      bomId: bom.id,
      warehouseId: base.warehouseId,
      quantity: 2,
    });
    await expect(completeAssemblyOrder(ctx(), second.id, { quantity: 5 })).rejects.toBeInstanceOf(
      InventoryValidationError
    );
  });

  /* ── 4. Releasing holds; cancelling gives it back ───────────────────────── */

  it('holds the components on release without moving them, and releases them on cancel', async () => {
    const base = await createInventoryFixture(tenantId);
    const bolt = await variantIn(base.warehouseId, { costCents: 50, onHand: 30 });
    const frame = await variantIn(base.warehouseId, { costCents: 0 });

    const bom = await createBom(ctx(), {
      outputVariantId: frame.variantId,
      name: 'Frame',
      components: [{ variantId: bolt.variantId, quantityPer: 6 }],
    });
    await setBomStatus(ctx(), bom.id, { status: 'active' });
    const run = await createAssemblyOrder(ctx(), {
      bomId: bom.id,
      warehouseId: base.warehouseId,
      quantity: 3,
    });

    await releaseAssemblyOrder(ctx(), run.id);
    const held = await levelOf(bolt.variantId, base.warehouseId);
    // Nothing has physically moved…
    expect(held?.onHand).toBe(30);
    // …but 18 are spoken for, so nobody can sell them out from under the build.
    expect(held?.allocated).toBe(18);

    await cancelAssemblyOrder(ctx(), run.id, { reason: 'Customer changed their mind' });
    const freed = await levelOf(bolt.variantId, base.warehouseId);
    expect(freed?.onHand).toBe(30);
    expect(freed?.allocated).toBe(0);
    // And nothing was consumed, so there is nothing to put back.
    const moves = await withTenant(ctx(), (tx) =>
      tx.inventoryMovement.count({ where: { referenceType: 'AssemblyOrder', referenceId: run.id } })
    );
    expect(moves).toBe(0);
  });

  it('refuses to commit to a run the shelf cannot cover, and says by how much', async () => {
    const base = await createInventoryFixture(tenantId);
    const rivet = await variantIn(base.warehouseId, { costCents: 10, onHand: 5 });
    const bracket = await variantIn(base.warehouseId, { costCents: 0 });

    const bom = await createBom(ctx(), {
      outputVariantId: bracket.variantId,
      name: 'Bracket',
      components: [{ variantId: rivet.variantId, quantityPer: 4 }],
    });
    await setBomStatus(ctx(), bom.id, { status: 'active' });
    const run = await createAssemblyOrder(ctx(), {
      bomId: bom.id,
      warehouseId: base.warehouseId,
      quantity: 3,
    });

    await expect(releaseAssemblyOrder(ctx(), run.id)).rejects.toBeInstanceOf(
      InventoryConflictError
    );
    // The refusal must leave nothing half-held.
    expect((await levelOf(rivet.variantId, base.warehouseId))?.allocated).toBe(0);
  });

  /* ── 5. Taking something apart ──────────────────────────────────────────── */

  it('reverses the arrows on a disassembly and gives the value back to the components', async () => {
    const base = await createInventoryFixture(tenantId);
    const top = await variantIn(base.warehouseId, { costCents: 800, onHand: 10 });
    const leg = await variantIn(base.warehouseId, { costCents: 200, onHand: 40 });
    const table = await variantIn(base.warehouseId, { costCents: 0 });

    const bom = await createBom(ctx(), {
      outputVariantId: table.variantId,
      name: 'Table',
      components: [
        { variantId: top.variantId, quantityPer: 1 },
        { variantId: leg.variantId, quantityPer: 4 },
      ],
    });
    await setBomStatus(ctx(), bom.id, { status: 'active' });

    // Make two, then take one back apart.
    const build = await createAssemblyOrder(ctx(), {
      bomId: bom.id,
      warehouseId: base.warehouseId,
      quantity: 2,
    });
    const built = await completeAssemblyOrder(ctx(), build.id, {});
    const unitCost = built.outputUnitCostCents ?? 0;
    expect(unitCost).toBe(1600); // £8 top + 4 × £2 legs

    const teardown = await createAssemblyOrder(ctx(), {
      kind: 'disassemble',
      bomId: bom.id,
      warehouseId: base.warehouseId,
      quantity: 1,
    });
    const undone = await completeAssemblyOrder(ctx(), teardown.id, {});

    // The finished unit is gone and its parts are back. Building two took 2 tops
    // and 8 legs off; taking one apart puts 1 and 4 back — so the shelf reads
    // 9 and 36, not the 10 and 40 it started with. Half the stock is still a
    // table, which is exactly what a partial teardown means.
    expect((await levelOf(table.variantId, base.warehouseId))?.onHand).toBe(1);
    expect((await levelOf(top.variantId, base.warehouseId))?.onHand).toBe(9);
    expect((await levelOf(leg.variantId, base.warehouseId))?.onHand).toBe(36);

    // The value that went in comes back out to the penny, split by what each
    // part is worth — a table is mostly top and barely leg.
    expect(undone.totalCostCents).toBe(unitCost);
    const recovered = undone.lines.reduce((s, l) => s + Math.abs(l.costConsumedCents), 0);
    expect(recovered).toBe(unitCost);
  });

  /* ── 6. Buildable quantity ──────────────────────────────────────────────── */

  it('says how many can be made and names what runs out first', async () => {
    const base = await createInventoryFixture(tenantId);
    const panel = await variantIn(base.warehouseId, { costCents: 500, onHand: 40 });
    const hinge = await variantIn(base.warehouseId, { costCents: 100, onHand: 56 });
    const screw = await variantIn(base.warehouseId, { costCents: 5, onHand: 900 });
    const door = await variantIn(base.warehouseId, { costCents: 0 });

    const bom = await createBom(ctx(), {
      outputVariantId: door.variantId,
      name: 'Door',
      components: [
        { variantId: panel.variantId, quantityPer: 1 },
        { variantId: hinge.variantId, quantityPer: 4 },
        { variantId: screw.variantId, quantityPer: 8 },
      ],
    });
    await setBomStatus(ctx(), bom.id, { status: 'active' });

    const before = await buildableQuantity(ctx(), {
      bomId: bom.id,
      warehouseId: base.warehouseId,
    });
    expect(before.quantity).toBe(14);
    // The half that turns a number into a purchase order.
    expect(before.limitingVariantId).toBe(hinge.variantId);
    expect(before.components.find((c) => c.isLimiting)?.variantSku).toBe(hinge.sku);

    // Measured against what is FREE, not raw on-hand: committing to a run takes
    // hinges out of circulation and the figure drops accordingly.
    const run = await createAssemblyOrder(ctx(), {
      bomId: bom.id,
      warehouseId: base.warehouseId,
      quantity: 4,
    });
    await releaseAssemblyOrder(ctx(), run.id);
    const after = await buildableQuantity(ctx(), {
      bomId: bom.id,
      warehouseId: base.warehouseId,
    });
    expect(after.quantity).toBe(10);
  });

  it('refuses a recipe that lists what it makes as one of its own ingredients', async () => {
    const base = await createInventoryFixture(tenantId);
    const thing = await variantIn(base.warehouseId, { costCents: 100 });
    // Caught at authoring, not at completion — by completion it would already
    // have written movements consuming the thing it was making.
    await expect(
      createBom(ctx(), {
        outputVariantId: thing.variantId,
        name: 'Impossible',
        components: [{ variantId: thing.variantId, quantityPer: 1 }],
      })
    ).rejects.toBeInstanceOf(InventoryValidationError);
  });

  it('keeps one live recipe per item, standing the previous one down', async () => {
    const base = await createInventoryFixture(tenantId);
    const part = await variantIn(base.warehouseId, { costCents: 100, onHand: 10 });
    const output = await variantIn(base.warehouseId, { costCents: 0 });

    const first = await createBom(ctx(), {
      outputVariantId: output.variantId,
      name: 'Mark I',
      components: [{ variantId: part.variantId, quantityPer: 1 }],
    });
    await setBomStatus(ctx(), first.id, { status: 'active' });

    const second = await createBom(ctx(), {
      outputVariantId: output.variantId,
      name: 'Mark II',
      components: [{ variantId: part.variantId, quantityPer: 2 }],
    });
    expect(second.version).toBe(2);
    await setBomStatus(ctx(), second.id, { status: 'active' });

    // "Which recipe do we build to" must have exactly one answer, and making
    // someone archive the old one first is a step that teaches nothing.
    const rows = await withTenant(ctx(), (tx) =>
      tx.billOfMaterials.findMany({
        where: { outputVariantId: output.variantId, status: 'active' },
      })
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]!.name).toBe('Mark II');
  });

  it('starts a tenant off with a usable set of units rather than an empty table', async () => {
    const units = await listUnitsOfMeasure(ctx());
    expect(units.length).toBeGreaterThan(0);
    expect(units.some((u) => u.code === 'EA')).toBe(true);
    // Marked as ours, so "we started you off with this" stays distinguishable
    // from "we set this up".
    expect(units.filter((u) => u.isSystem).length).toBeGreaterThan(0);
  });
});
