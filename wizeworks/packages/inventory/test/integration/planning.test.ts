// DB-backed coverage for planning intelligence (docs/146 Phase 7).
//
// The claims worth pinning, because each one is a buying decision that goes
// wrong quietly if it breaks:
//
//   1. Demand is measured from the ledger over REAL days, including the days
//      nothing sold — a line that sold everything in one afternoon must not read
//      as perfectly steady, because that is what decides how much cushion it
//      gets.
//   2. `assembly_out` counts as demand. A manufacturer with no commerce module
//      has no `sale` movements at all, and forecasting zero for every part they
//      consume would make the whole phase useless to them.
//   3. Lead time is measured from the order being SENT to the first receipt
//      against it, and the promise is kept alongside so the gap is a stored fact.
//   4. The reorder point is written to `dynamic_reorder_point` and the level's
//      own `reorder_point` is LEFT ALONE. This is the consent rule, and it is the
//      single most important assertion in the file.
//   5. Adopting the computed point is a separate, explicit act — and it moves the
//      operative trigger.
//   6. ABC ranks by value across the whole tenant and an override sticks through
//      a re-rank, with the measured class still recorded beside it.
//   7. A cycle-count schedule generates a real count, will not stack a second one
//      on top of an unfinished first, and moves its own next date forward.
//   8. The explanation names every input with an honest confidence, and the
//      verdict is the WEAKEST input rather than an average.
//
// Requires `pnpm db:up`; skipped in CI (no DB) per vitest.config.ts.

import crypto from 'node:crypto';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { withTenant } from '@wizeworks/db';

import { applyMovement } from '../../src/services/ledger.js';
import { createSupplier } from '../../src/services/suppliers.js';
import { upsertSupplierVariant } from '../../src/services/supplier-variants.js';
import { createPurchaseOrder } from '../../src/services/purchase-orders.js';
import { submitPurchaseOrder } from '../../src/services/purchase-order-lifecycle.js';
import { createGoodsReceipt } from '../../src/services/goods-receipts.js';
import { recomputeDemandVelocity, getDemandVelocity } from '../../src/services/demand.js';
import { listLeadTimes, recomputeLeadTimes } from '../../src/services/lead-times.js';
import {
  listClassifications,
  recomputeClassifications,
  setClassificationOverride,
} from '../../src/services/classification.js';
import {
  applyComputedReorderPoint,
  getReorderPlan,
  recomputeReorderPoints,
  setReorderPlanningPolicy,
} from '../../src/services/reorder-planning.js';
import {
  createCountSchedule,
  generateDueCounts,
  getCountSchedule,
} from '../../src/services/count-schedules.js';
import { planningProvenance } from '../../src/services/planning-provenance.js';
import { stockoutRiskReport, slowMoverReport } from '../../src/services/planning-reports.js';
import { updatePlanningPolicy } from '../../src/services/planning-policy.js';
import { setReorderPolicy } from '../../src/services/levels.js';
import {
  createInventoryFixture,
  createTestTenant,
  dropTestTenant,
  type InventoryFixture,
} from '../helpers.js';

const DAY_MS = 86_400_000;

describe('planning intelligence — DB-backed', () => {
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

  /** Put stock in, at a cost, without going through purchasing. */
  const receive = (f: InventoryFixture, delta: number, unitCostCents = 500) =>
    withTenant(ctx(), (tx) =>
      applyMovement(tx, {
        tenantId,
        variantId: f.variantId,
        warehouseId: f.warehouseId,
        delta,
        reason: 'receive',
        unitCostCents,
        actorType: 'user',
        actorId: userId,
      })
    );

  /**
   * Write a demand movement DATED in the past.
   *
   * `applyMovement` stamps `created_at` itself, so the row is written and then
   * back-dated in the same transaction. Every window in this phase is measured
   * against that column, and a test that could only ever write "now" could not
   * distinguish a 7-day rate from a 90-day one at all.
   */
  const sellAt = async (
    f: InventoryFixture,
    units: number,
    daysAgo: number,
    reason: 'sale' | 'assembly_out' = 'sale'
  ) => {
    const movement = await withTenant(ctx(), (tx) =>
      applyMovement(tx, {
        tenantId,
        variantId: f.variantId,
        warehouseId: f.warehouseId,
        delta: -units,
        reason,
        allowNegative: true,
        actorType: 'user',
        actorId: userId,
      })
    );
    await withTenant(
      ctx(),
      (tx) =>
        tx.$executeRaw`
        UPDATE inventory_movements
           SET created_at = now() - make_interval(days => ${daysAgo}::int)
         WHERE id = ${movement.movementId}::uuid
      `
    );
  };

  /* ── 1 + 2. Demand measurement ──────────────────────────────────────────── */

  describe('demand velocity', () => {
    let steady: InventoryFixture;
    let spiky: InventoryFixture;

    beforeAll(async () => {
      steady = await createInventoryFixture(tenantId);
      spiky = await createInventoryFixture(tenantId);
      await receive(steady, 500);
      await receive(spiky, 500);

      // Steady: two a day for 60 days. Spiky: the same 120 units, all on one day.
      for (let day = 1; day <= 60; day++) await sellAt(steady, 2, day);
      await sellAt(spiky, 120, 30);

      // Backdate the very first movement so both have real history, otherwise
      // the 90-day window is capped at "since it existed" and the rates differ
      // for a reason that has nothing to do with the shape of the demand.
      await withTenant(
        ctx(),
        (tx) =>
          tx.$executeRaw`
          UPDATE inventory_movements
             SET created_at = now() - interval '120 days'
           WHERE tenant_id = ${tenantId}::uuid AND reason = 'receive'
             AND variant_id IN (${steady.variantId}::uuid, ${spiky.variantId}::uuid)
        `
      );
      await recomputeDemandVelocity(ctx());
    });

    it('measures the same 90-day total for both — the average cannot tell them apart', async () => {
      const s = await getDemandVelocity(ctx(), {
        variantId: steady.variantId,
        warehouseId: steady.warehouseId,
      });
      const p = await getDemandVelocity(ctx(), {
        variantId: spiky.variantId,
        warehouseId: spiky.warehouseId,
      });
      expect(s?.units90).toBe(120);
      expect(p?.units90).toBe(120);
      expect(s?.perDay90).toBeCloseTo(p?.perDay90 ?? 0, 4);
    });

    it('but reads the spiky one as far more erratic, which is what decides the cushion', async () => {
      const s = await getDemandVelocity(ctx(), {
        variantId: steady.variantId,
        warehouseId: steady.warehouseId,
      });
      const p = await getDemandVelocity(ctx(), {
        variantId: spiky.variantId,
        warehouseId: spiky.warehouseId,
      });
      expect(s?.daysWithDemand).toBe(60);
      expect(p?.daysWithDemand).toBe(1);
      expect(p?.demandStdDev ?? 0).toBeGreaterThan((s?.demandStdDev ?? 0) * 5);
      expect(s?.demandCv).not.toBeNull();
      expect(p?.demandCv ?? 0).toBeGreaterThan(s?.demandCv ?? 0);
    });

    it('has no seasonality index without a year of history — never a defaulted 1.0', async () => {
      const s = await getDemandVelocity(ctx(), {
        variantId: steady.variantId,
        warehouseId: steady.warehouseId,
      });
      expect(s?.seasonalityIndex).toBeNull();
    });

    it('counts a component consumed by a build as demand', async () => {
      // A manufacturer with no commerce module has no `sale` rows at all, so
      // restricting demand to sales would forecast zero for every part they use.
      const component = await createInventoryFixture(tenantId);
      await receive(component, 300);
      for (let day = 1; day <= 30; day++) await sellAt(component, 3, day, 'assembly_out');
      await recomputeDemandVelocity(ctx());

      const v = await getDemandVelocity(ctx(), {
        variantId: component.variantId,
        warehouseId: component.warehouseId,
      });
      // 30 selling days, but the trailing 30-day window is days 0–29 and the
      // oldest sale is 30 days back — so 29 of them land inside it. The 90-day
      // total is the one that sees all thirty.
      expect(v?.units30).toBe(87);
      expect(v?.units90).toBe(90);
      expect(v?.forecastPerDay ?? 0).toBeGreaterThan(0);
    });

    it('does not count a transfer out as demand — the stock is still ours', async () => {
      const moved = await createInventoryFixture(tenantId);
      await receive(moved, 100);
      const movement = await withTenant(ctx(), (tx) =>
        applyMovement(tx, {
          tenantId,
          variantId: moved.variantId,
          warehouseId: moved.warehouseId,
          delta: -40,
          reason: 'transfer_out',
          actorType: 'user',
          actorId: userId,
        })
      );
      expect(movement.movementId).toBeTruthy();
      await recomputeDemandVelocity(ctx());

      const v = await getDemandVelocity(ctx(), {
        variantId: moved.variantId,
        warehouseId: moved.warehouseId,
      });
      expect(v?.units90).toBe(0);
      expect(v?.forecastBasis).toBe('none');
    });
  });

  /* ── 3. Measured lead time ──────────────────────────────────────────────── */

  describe('lead time', () => {
    let part: InventoryFixture;
    let supplierId: string;

    beforeAll(async () => {
      part = await createInventoryFixture(tenantId);
      const supplier = await createSupplier(ctx(), {
        name: 'Slow But Sure Ltd',
        code: `SUP-${crypto.randomBytes(3).toString('hex')}`,
        // What they SAY. Every reorder point built on this inherits its optimism.
        leadTimeDays: 5,
      });
      supplierId = supplier.id;
      await upsertSupplierVariant(ctx(), supplierId, {
        variantId: part.variantId,
        unitCostCents: 400,
        isPreferred: true,
      });

      // Three orders, each received later than promised.
      for (const actualDays of [11, 13, 12]) {
        const po = await createPurchaseOrder(ctx(), {
          supplierId,
          warehouseId: part.warehouseId,
          currency: 'USD',
          lines: [{ variantId: part.variantId, quantity: 20 }],
        });
        await submitPurchaseOrder(ctx(), po.id, {});
        const detail = await withTenant(ctx(), (tx) =>
          tx.purchaseOrder.findUniqueOrThrow({
            where: { id: po.id },
            include: { lines: true },
          })
        );
        // Back-date the send so the gap to "received now" is the figure we want.
        await withTenant(
          ctx(),
          (tx) =>
            tx.$executeRaw`
            UPDATE inventory_purchase_orders
               SET ordered_at = now() - make_interval(days => ${actualDays}::int)
             WHERE id = ${po.id}::uuid
          `
        );
        await createGoodsReceipt(ctx(), {
          purchaseOrderId: po.id,
          lines: (detail.lines ?? []).map((l) => ({
            purchaseOrderLineId: l.id,
            quantity: 20,
          })),
        });
      }

      await recomputeLeadTimes(ctx());
    });

    it('measures what actually happened, not what the supplier promised', async () => {
      const { items } = await listLeadTimes(ctx(), { supplierId });
      const overall = items.find((i) => i.variantId === null);
      expect(overall).toBeDefined();
      expect(overall?.sampleCount).toBe(3);
      expect(overall?.meanDays).toBeCloseTo(12, 0);
      // The promise is kept alongside so the gap is a stored fact, not something
      // a report recomputes against a figure that may since have been edited.
      expect(overall?.promisedDays).toBe(5);
      expect(overall?.varianceDays ?? 0).toBeGreaterThan(6);
      expect(overall?.onTimeRate).toBe(0);
      expect(overall?.isReliable).toBe(true);
    });

    it('reports the spread, which is what a supplier being erratic costs you', async () => {
      const { items } = await listLeadTimes(ctx(), { supplierId });
      const overall = items.find((i) => i.variantId === null);
      expect(overall?.stdDevDays ?? 0).toBeGreaterThan(0);
      expect(overall?.minDays).toBeLessThanOrEqual(overall?.maxDays ?? 0);
    });

    it('measures the supplier for THIS item as well as overall', async () => {
      const { items } = await listLeadTimes(ctx(), { supplierId, includeVariants: true });
      expect(items.some((i) => i.variantId === part.variantId)).toBe(true);
    });
  });

  /* ── 4 + 5. The consent rule ────────────────────────────────────────────── */

  describe('reorder points', () => {
    let part: InventoryFixture;

    beforeAll(async () => {
      part = await createInventoryFixture(tenantId);
      await receive(part, 400);
      for (let day = 1; day <= 60; day++) await sellAt(part, 4, day);
      // A number a human typed, and deliberately a low one — the whole point of
      // the next two tests is that the measured figure disagrees with it and the
      // system leaves it alone anyway.
      await setReorderPolicy(ctx(), {
        variantId: part.variantId,
        warehouseId: part.warehouseId,
        reorderPoint: 20,
        reorderQuantity: 100,
        leadTimeDays: 10,
      });
      await recomputeDemandVelocity(ctx());
      await recomputeReorderPoints(ctx());
    });

    it('works out a point from demand and lead time', async () => {
      const plan = await getReorderPlan(ctx(), {
        variantId: part.variantId,
        warehouseId: part.warehouseId,
      });
      const velocity = await getDemandVelocity(ctx(), {
        variantId: part.variantId,
        warehouseId: part.warehouseId,
      });

      // The claim is the FORMULA, checked against the rate that was actually
      // measured — not against the 4/day the fixture wrote, because the trailing
      // 30-day window contains 29 selling days and the measured rate is
      // legitimately a shade under 4. Asserting the fixture's intent rather than
      // the measurement would be testing arithmetic nobody performs.
      const expected =
        Math.ceil((velocity?.forecastPerDay ?? 0) * 10) + (plan?.safetyStockUnits ?? 0);
      expect(plan?.computedReorderPoint).toBeGreaterThanOrEqual(expected - 1);
      expect(plan?.computedReorderPoint).toBeLessThanOrEqual(expected + 1);
      expect(plan?.computedReorderPoint ?? 0).toBeGreaterThan(30);
      expect(plan?.leadTimeDaysUsed).toBe(10);
      expect(plan?.leadTimeSource).toBe('level');
      expect(plan?.effectiveServiceLevel).toBe('p95');
    });

    it('needs no cushion for perfectly steady demand and a fixed lead time', async () => {
      // Four a day, every day, from a supplier whose time is a stated constant:
      // there is nothing to absorb, so the cushion is zero. If this ever starts
      // returning a positive number, something is inventing variance.
      const plan = await getReorderPlan(ctx(), {
        variantId: part.variantId,
        warehouseId: part.warehouseId,
      });
      expect(plan?.safetyStockUnits).toBe(0);
      expect(plan?.leadTimeStdDevUsed).toBe(0);
    });

    it('LEAVES the human number alone — this is the whole consent rule', async () => {
      const level = await levelOf(part.variantId, part.warehouseId);
      // Untouched at what the person typed, with the maths sitting BESIDE it.
      expect(level?.reorderPoint).toBe(20);
      expect(level?.dynamicReorderPoint ?? 0).toBeGreaterThan(20);

      const plan = await getReorderPlan(ctx(), {
        variantId: part.variantId,
        warehouseId: part.warehouseId,
      });
      expect(plan?.isAutoManaged).toBe(false);
      expect(plan?.currentReorderPoint).toBe(20);
      expect(plan?.differsFromCurrent).toBe(true);
    });

    it('adopting is a separate, explicit act — and it moves the real trigger', async () => {
      const before = await getReorderPlan(ctx(), {
        variantId: part.variantId,
        warehouseId: part.warehouseId,
      });
      await applyComputedReorderPoint(ctx(), {
        variantId: part.variantId,
        warehouseId: part.warehouseId,
      });
      const level = await levelOf(part.variantId, part.warehouseId);
      expect(level?.reorderPoint).toBe(before?.computedReorderPoint);
    });

    it('a level with NO point set is still not auto-managed unless the tenant asked', async () => {
      const fresh = await createInventoryFixture(tenantId);
      await receive(fresh, 100);
      for (let day = 1; day <= 30; day++) await sellAt(fresh, 1, day);
      await recomputeDemandVelocity(ctx());
      await recomputeReorderPoints(ctx());

      const level = await levelOf(fresh.variantId, fresh.warehouseId);
      // The suggestion is there; the trigger is still empty, because nobody has
      // said an automatic number is welcome.
      expect(level?.dynamicReorderPoint ?? 0).toBeGreaterThan(0);
      expect(level?.reorderPoint).toBeNull();
    });

    it('honours the tenant opting in — but only for levels with nothing to overwrite', async () => {
      const optedIn = await createInventoryFixture(tenantId);
      await receive(optedIn, 100);
      for (let day = 1; day <= 30; day++) await sellAt(optedIn, 1, day);
      await updatePlanningPolicy(ctx(), { autoApplyReorderPoints: true });
      await recomputeDemandVelocity(ctx());
      await recomputeReorderPoints(ctx());

      const level = await levelOf(optedIn.variantId, optedIn.warehouseId);
      expect(level?.reorderPoint).not.toBeNull();
      expect(level?.reorderPoint).toBe(level?.dynamicReorderPoint);

      // And the hand-typed one from earlier is STILL not managed, because that
      // decision was made once at row creation and is not re-litigated nightly.
      const managed = await getReorderPlan(ctx(), {
        variantId: part.variantId,
        warehouseId: part.warehouseId,
      });
      expect(managed?.isAutoManaged).toBe(false);

      await updatePlanningPolicy(ctx(), { autoApplyReorderPoints: false });
    });

    // The defect this three-state rule exists for, found by turning the switch on
    // in the browser and watching nothing happen. The first sweep runs while the
    // switch is OFF and creates a policy row for every level it plans; when that
    // row stamped `false`, the "decided once, never re-litigated" rule read it
    // forever and the switch became a permanent no-op on anything already swept.
    it('opting in LATER still adopts a level the sweep already saw', async () => {
      const late = await createInventoryFixture(tenantId);
      await receive(late, 100);
      for (let day = 1; day <= 30; day++) await sellAt(late, 1, day);

      // Swept first, with the switch off — this is what used to poison the row.
      await recomputeDemandVelocity(ctx());
      await recomputeReorderPoints(ctx());
      expect((await levelOf(late.variantId, late.warehouseId))?.reorderPoint).toBeNull();

      await updatePlanningPolicy(ctx(), { autoApplyReorderPoints: true });
      await recomputeReorderPoints(ctx());

      const adopted = await levelOf(late.variantId, late.warehouseId);
      expect(adopted?.reorderPoint).not.toBeNull();
      expect(adopted?.reorderPoint).toBe(adopted?.dynamicReorderPoint);

      // And it STAYS adopted across the next run. Without recording that the
      // sweep adopted it, the level now has a point, so the naive "only levels
      // with no point" test would release it again immediately.
      await recomputeReorderPoints(ctx());
      const still = await getReorderPlan(ctx(), {
        variantId: late.variantId,
        warehouseId: late.warehouseId,
      });
      expect(still?.isAutoManaged).toBe(true);
      expect(still?.autoManagedDecidedBy).toBe('sweep');

      // Switching off releases what the SWEEP adopted — nobody chose these.
      await updatePlanningPolicy(ctx(), { autoApplyReorderPoints: false });
      await recomputeReorderPoints(ctx());
      const released = await getReorderPlan(ctx(), {
        variantId: late.variantId,
        warehouseId: late.warehouseId,
      });
      expect(released?.isAutoManaged).toBe(false);
    });

    // Browser-found: three of the four levels the switch adopted on the dev
    // tenant had never moved at all, and each was handed a reorder point of 0.
    // Zero is not "we worked out you need none" here — it is "we have never seen
    // this item" wearing the costume of an answer, and it makes the level look
    // configured so nobody revisits it.
    it('will not adopt a level it has never seen move', async () => {
      const untouched = await createInventoryFixture(tenantId);
      await receive(untouched, 40); // stock exists; nothing has ever gone out

      await updatePlanningPolicy(ctx(), { autoApplyReorderPoints: true });
      await recomputeDemandVelocity(ctx());
      await recomputeReorderPoints(ctx());

      const level = await levelOf(untouched.variantId, untouched.warehouseId);
      expect(level?.reorderPoint).toBeNull();

      const plan = await getReorderPlan(ctx(), {
        variantId: untouched.variantId,
        warehouseId: untouched.warehouseId,
      });
      expect(plan?.isAutoManaged).toBe(false);
      expect(plan?.autoManagedDecidedBy).toBeNull();

      // It becomes eligible the first sweep after it starts moving.
      for (let day = 1; day <= 20; day++) await sellAt(untouched, 1, day);
      await recomputeDemandVelocity(ctx());
      await recomputeReorderPoints(ctx());
      expect(
        (await levelOf(untouched.variantId, untouched.warehouseId))?.reorderPoint
      ).not.toBeNull();

      await updatePlanningPolicy(ctx(), { autoApplyReorderPoints: false });
    });

    it("a person's answer outranks the tenant switch, in both directions", async () => {
      const chosen = await createInventoryFixture(tenantId);
      await receive(chosen, 100);
      for (let day = 1; day <= 30; day++) await sellAt(chosen, 1, day);
      await recomputeDemandVelocity(ctx());

      // Someone says NO to this level specifically.
      await setReorderPlanningPolicy(ctx(), {
        variantId: chosen.variantId,
        warehouseId: chosen.warehouseId,
        isAutoManaged: false,
      });

      // The tenant switch goes on. It must not overrule them.
      await updatePlanningPolicy(ctx(), { autoApplyReorderPoints: true });
      await recomputeReorderPoints(ctx());

      const plan = await getReorderPlan(ctx(), {
        variantId: chosen.variantId,
        warehouseId: chosen.warehouseId,
      });
      expect(plan?.isAutoManaged).toBe(false);
      expect(plan?.autoManagedDecidedBy).toBe('person');
      expect((await levelOf(chosen.variantId, chosen.warehouseId))?.reorderPoint).toBeNull();

      await updatePlanningPolicy(ctx(), { autoApplyReorderPoints: false });
    });
  });

  /* ── 6. Classification ──────────────────────────────────────────────────── */

  describe('ABC / XYZ', () => {
    let expensive: InventoryFixture;

    beforeAll(async () => {
      expensive = await createInventoryFixture(tenantId);
      await receive(expensive, 200, 90_000);
      for (let day = 1; day <= 40; day++) await sellAt(expensive, 3, day);
      await recomputeDemandVelocity(ctx());
      await recomputeClassifications(ctx());
    });

    it('ranks by the money, so a few expensive units outrank many cheap ones', async () => {
      const { items } = await listClassifications(ctx(), { take: 250 });
      const row = items.find((i) => i.variantId === expensive.variantId);
      expect(row?.abcClass).toBe('A');
      expect(row?.annualUsageValueCents ?? 0).toBeGreaterThan(0);
      // The two figures that make the cut explainable rather than magic.
      expect(row?.valueSharePct ?? 0).toBeGreaterThan(0);
      expect(row?.cumulativeSharePct ?? 0).toBeGreaterThan(0);
      expect(row?.advice).toMatch(/count it|counting/i);
    });

    it('an override wins, sticks through a re-rank, and keeps the measurement beside it', async () => {
      const cheap = await createInventoryFixture(tenantId);
      await receive(cheap, 50, 12);
      await recomputeClassifications(ctx());

      await setClassificationOverride(ctx(), {
        variantId: cheap.variantId,
        warehouseId: cheap.warehouseId,
        abcClass: 'A',
        reason: 'Stops the line if we run out',
      });
      // The nightly pass runs again over the whole catalogue.
      await recomputeClassifications(ctx());

      const { items } = await listClassifications(ctx(), { take: 250, overriddenOnly: true });
      const row = items.find((i) => i.variantId === cheap.variantId);
      expect(row?.abcClass).toBe('A');
      expect(row?.abcOverride).toBe('A');
      // The measurement is not erased — the screen can say "measured C, you set A".
      expect(row?.measuredAbcClass).toBe('C');
      expect(row?.overrideReason).toBe('Stops the line if we run out');

      // And the level's fast-read column carries the EFFECTIVE class, so a count
      // schedule for A-class stock picks this item up.
      const level = await levelOf(cheap.variantId, cheap.warehouseId);
      expect(level?.abcClass).toBe('A');
    });
  });

  /* ── 7. Cycle-count schedules ───────────────────────────────────────────── */

  describe('count schedules', () => {
    it('generates a real count, then refuses to stack a second on an unfinished one', async () => {
      const f = await createInventoryFixture(tenantId);
      await receive(f, 75);

      const schedule = await createCountSchedule(ctx(), {
        warehouseId: f.warehouseId,
        name: 'Everything, monthly',
        cadence: 'monthly',
        maxItemsPerRun: 10,
        isBlind: true,
      });
      expect(schedule.intervalDays).toBe(30);

      const first = await generateDueCounts(ctx(), { scheduleId: schedule.id, force: true });
      expect(first.countsCreated).toBe(1);
      const created = first.counts[0];
      expect(created?.lineCount ?? 0).toBeGreaterThan(0);

      const count = await withTenant(ctx(), (tx) =>
        tx.inventoryCount.findUniqueOrThrow({ where: { id: created?.countId ?? '' } })
      );
      expect(count.type).toBe('cycle');
      expect(count.isBlind).toBe(true);
      expect(count.scheduleId).toBe(schedule.id);

      // The next date moved forward, and the schedule now knows its count.
      const after = await getCountSchedule(ctx(), schedule.id);
      expect(new Date(after.nextRunAt).getTime()).toBeGreaterThan(Date.now());
      expect(after.lastCountId).toBe(created?.countId);
      expect(after.lastCountOpen).toBe(true);

      // A second run while the first is open is refused — two open counts over
      // the same shelves means two sets of expected quantities for one lot of
      // stock, and posting the second silently undoes the first.
      const second = await generateDueCounts(ctx(), { scheduleId: schedule.id, force: true });
      expect(second.countsCreated).toBe(0);
      expect(second.skippedOpen).toBe(1);
    });

    it('a paused schedule resumes on a sane date rather than firing every count it missed', async () => {
      const f = await createInventoryFixture(tenantId);
      await receive(f, 10);
      const schedule = await createCountSchedule(ctx(), {
        warehouseId: f.warehouseId,
        name: 'Weekly, long overdue',
        cadence: 'weekly',
        maxItemsPerRun: 5,
        // Six weeks in the past.
        startAt: new Date(Date.now() - 42 * DAY_MS),
      });

      const run = await generateDueCounts(ctx(), { scheduleId: schedule.id });
      expect(run.countsCreated).toBe(1);

      const after = await getCountSchedule(ctx(), schedule.id);
      // Exactly one count, and the next date is in the FUTURE — not six overdue
      // ones and a date still in the past.
      expect(new Date(after.nextRunAt).getTime()).toBeGreaterThan(Date.now());
    });
  });

  /* ── 8. The explanation ─────────────────────────────────────────────────── */

  describe('why this number', () => {
    it('names every input, and the verdict is the WEAKEST one', async () => {
      const orphan = await createInventoryFixture(tenantId);
      await receive(orphan, 60);
      for (let day = 1; day <= 45; day++) await sellAt(orphan, 2, day);
      await recomputeDemandVelocity(ctx());
      await recomputeReorderPoints(ctx());

      const explained = await planningProvenance(ctx(), {
        variantId: orphan.variantId,
        warehouseId: orphan.warehouseId,
      });

      const keys = explained.inputs.map((i) => i.key);
      expect(keys).toContain('demand');
      expect(keys).toContain('lead_time');
      expect(keys).toContain('service_level');

      // No supplier is linked, so the lead time is a platform assumption — and
      // an assumed input must drag the whole verdict down rather than being
      // averaged away against a well-measured demand figure.
      const leadTime = explained.inputs.find((i) => i.key === 'lead_time');
      expect(leadTime?.confidence).toBe('assumed');
      expect(explained.confidence).not.toBe('measured');
      expect(explained.improve.join(' ')).toMatch(/supplier/i);

      // The formulas carry this item's own numbers, so the arithmetic is
      // checkable on paper rather than asserted.
      expect(explained.workings.reorderPoint).toContain('cushion');
      expect(explained.workings.safetyStock).toContain('√');
    });
  });

  /* ── The money reads ────────────────────────────────────────────────────── */

  describe('risk and slow movers', () => {
    it('prices what running out would cost, and stock on order closes the gap', async () => {
      const fast = await createInventoryFixture(tenantId);
      // Receive twice what the sales below consume, so there is stock LEFT to
      // have cover over. A fixture that sells everything it received has zero
      // available and no deadline, which tests nothing.
      await receive(fast, 600);
      for (let day = 1; day <= 60; day++) await sellAt(fast, 5, day);
      await recomputeDemandVelocity(ctx());
      await recomputeReorderPoints(ctx());

      const report = await stockoutRiskReport(ctx(), { atRiskOnly: false, take: 500 });
      const row = report.rows.find((r) => r.variantId === fast.variantId);
      expect(row).toBeDefined();
      expect(row?.velocityPerDay ?? 0).toBeGreaterThan(0);
      expect(row?.daysOfCover ?? 0).toBeGreaterThan(0);
      // The sentence is the row's most useful line, and it always exists.
      expect(row?.reasoning.length ?? 0).toBeGreaterThan(20);
    });

    it('calls stock that has never sold dead, and says what to do about it', async () => {
      const dead = await createInventoryFixture(tenantId);
      await receive(dead, 40, 2_500);
      await recomputeDemandVelocity(ctx());

      const report = await slowMoverReport(ctx(), { take: 500 });
      const row = report.rows.find((r) => r.variantId === dead.variantId);
      expect(row?.kind).toBe('dead');
      // ALL of it is excess — the question is disposal, not ordering less.
      expect(row?.excessUnits).toBe(40);
      expect(row?.excessValueCents).toBe(40 * 2_500);
      expect(row?.annualHoldingCostCents ?? 0).toBeGreaterThan(0);
      expect(row?.suggestedAction).toMatch(/discount|write it off|return/i);
    });
  });
});
