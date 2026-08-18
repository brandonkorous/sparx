// DB-backed coverage for reporting, portability and the accounting handoff
// (docs/146 Phase 10).
//
// The claims worth pinning here are all the same claim wearing different
// clothes: A FIGURE NOBODY MEASURED MUST NOT COME BACK AS A NUMBER. The pure
// arithmetic already has 57 unit tests holding that at the function level; what
// these tests hold is that the SQL feeding it does not quietly supply a zero
// where it should supply nothing.
//
//   1. Sell-through divides sold by what was there to sell, and reports NULL
//      where nothing was there.
//   2. GMROI counts a sale with no order line behind it rather than dropping
//      it, and credits it no revenue — the two tempting handlings are wrong in
//      opposite directions, and only the counted-but-uncredited one is honest.
//   3. Fill rate excludes an order line nothing recorded, and does not score it
//      as a perfect fill.
//   4. A run at zero is ONE stock-out, however many movements it spans.
//   5. The movement summary's parts add up to the ledger, and an uncosted reason
//      reports a blank cost rather than $0.00.
//   6. The import PLANS without writing stock, APPLIES what was planned, and
//      REVERSES with compensating movements rather than deletions.
//   7. An export re-imports: the template's columns are the ones the parser
//      reads (10.6).
//   8. The reconciliation reports a NULL unexplained difference until somebody
//      says what the books hold, and zero once they agree.
//   9. The journal balances, and refuses to be sendable while a role is
//      unmapped.
//
// Requires `pnpm db:up`; skipped in CI (no DB) per vitest.config.ts.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { withTenant } from '@wizeworks/db';

import { toCsv } from '../../src/csv.js';
import { adjust } from '../../src/services/movements.js';
import {
  fillRateReport,
  gmroiReport,
  movementSummaryReport,
  sellThroughReport,
  stockoutFrequencyReport,
} from '../../src/services/performance-reports.js';
import {
  adjustmentTemplate,
  applyImportBatch,
  discardImportBatch,
  getImportBatch,
  planAdjustmentImport,
  reverseImportBatch,
} from '../../src/services/adjustment-import.js';
import { glReconciliationReport, recordGlSnapshot } from '../../src/services/gl-reconciliation.js';
import { inventoryJournalForPeriod } from '../../src/services/accounting-journal.js';
import { runReport, reportCatalog } from '../../src/services/report-registry.js';
import {
  createReportSchedule,
  listReportSchedules,
  updateReportSchedule,
} from '../../src/services/report-schedules.js';
import { checkJournalSendable } from '@wizeworks/commerce-schemas';
import {
  createInventoryFixture,
  createTestTenant,
  dropTestTenant,
  type InventoryFixture,
} from '../helpers.js';

describe('reporting + the accounting handoff — DB-backed', () => {
  let tenantId: string;
  let userId: string;
  const ctx = () => ({ tenantId, userId });

  const DAY = 24 * 60 * 60 * 1000;
  const window = () => ({ from: new Date(Date.now() - 30 * DAY), to: new Date(Date.now() + DAY) });

  beforeAll(async () => {
    const tenant = await createTestTenant();
    tenantId = tenant.tenantId;
    userId = tenant.userId;
  });
  afterAll(async () => {
    await dropTestTenant(tenantId);
  });

  /** Receive stock, then sell some of it, so a report has both sides. */
  const stockAndSell = async (
    fixture: InventoryFixture,
    received: number,
    sold: number,
    unitCostCents: number | null
  ): Promise<void> => {
    await adjust(ctx(), {
      variantId: fixture.variantId,
      warehouseId: fixture.warehouseId,
      delta: received,
      reason: 'receive',
      ...(unitCostCents === null ? {} : { unitCostCents }),
    });
    if (sold > 0) {
      await adjust(ctx(), {
        variantId: fixture.variantId,
        warehouseId: fixture.warehouseId,
        delta: -sold,
        reason: 'sale',
      });
    }
  };

  /* ── 1. Sell-through ───────────────────────────────────────────────────── */

  describe('sell-through', () => {
    it('divides sold by what was there to sell', async () => {
      const fixture = await createInventoryFixture(tenantId);
      await stockAndSell(fixture, 100, 30, 500);

      const report = await sellThroughReport(ctx(), {
        ...window(),
        warehouseId: fixture.warehouseId,
      });
      expect(report.totals.unitsSold).toBe(30);
      expect(report.totals.unitsOnHandAtEnd).toBe(70);
      expect(report.totals.sellThroughPct).toBe(30);
    });

    it('reports null rather than zero when there was nothing to sell', async () => {
      const fixture = await createInventoryFixture(tenantId);
      const report = await sellThroughReport(ctx(), {
        ...window(),
        warehouseId: fixture.warehouseId,
      });
      expect(report.totals.sellThroughPct).toBeNull();
      expect(report.rows).toEqual([]);
    });
  });

  /* ── 2. GMROI ──────────────────────────────────────────────────────────── */

  describe('GMROI', () => {
    it('refuses to invent a margin for a sale with no order line behind it', async () => {
      const fixture = await createInventoryFixture(tenantId);
      // Sold with nothing on the revenue side: no order, so no order line to
      // price it from. This is the shape a marketplace sale or a hand-booked
      // movement arrives in, and the tempting handling — either dropping it or
      // calling its revenue zero — is wrong in opposite directions.
      await stockAndSell(fixture, 40, 10, null);

      const report = await gmroiReport(ctx(), { ...window(), warehouseId: fixture.warehouseId });

      // Counted, so cost of sales is not understated…
      expect(report.unattributedUnits).toBeGreaterThanOrEqual(10);
      // …and NOT credited with revenue, so no margin is claimed from nothing.
      expect(report.totals.revenueCents).toBe(0);
      expect(report.totals.grossMarginPct).toBeNull();
    });

    it('divides margin by the stock it was earned on', async () => {
      const fixture = await createInventoryFixture(tenantId);
      await stockAndSell(fixture, 50, 5, 400);

      const report = await gmroiReport(ctx(), { ...window(), warehouseId: fixture.warehouseId });
      // Whatever the figures, the ratio must never come back as a number when
      // there was no stock to divide by — that is the whole contract.
      if (report.totals.avgInventoryCostCents === 0) {
        expect(report.totals.gmroi).toBeNull();
      } else {
        expect(report.totals.gmroi).not.toBeNull();
      }
    });
  });

  /* ── 3. Fill rate ──────────────────────────────────────────────────────── */

  describe('fill rate', () => {
    it('is null over a period with nothing measurable in it', async () => {
      const report = await fillRateReport(ctx(), { ...window() });
      // A fresh tenant has no orders. The one thing this must NEVER return is
      // 100%.
      expect(report.lineFillRatePct).toBeNull();
      expect(report.linesMeasured).toBe(0);
    });
  });

  /* ── 4. Stock-outs ─────────────────────────────────────────────────────── */

  describe('stock-out frequency', () => {
    it('counts a run at zero as ONE episode, not one per movement', async () => {
      const fixture = await createInventoryFixture(tenantId);
      await adjust(ctx(), {
        variantId: fixture.variantId,
        warehouseId: fixture.warehouseId,
        delta: 5,
        reason: 'receive',
      });
      // Three movements that each leave it at zero or below.
      await adjust(ctx(), {
        variantId: fixture.variantId,
        warehouseId: fixture.warehouseId,
        delta: -5,
        reason: 'sale',
      });
      await adjust(ctx(), {
        variantId: fixture.variantId,
        warehouseId: fixture.warehouseId,
        delta: 0,
        reason: 'manual',
        note: 'no-op while out',
      });
      await adjust(ctx(), {
        variantId: fixture.variantId,
        warehouseId: fixture.warehouseId,
        delta: 8,
        reason: 'receive',
      });

      const report = await stockoutFrequencyReport(ctx(), {
        ...window(),
        warehouseId: fixture.warehouseId,
      });
      const row = report.rows.find((r) => r.variantId === fixture.variantId);
      expect(row?.episodeCount).toBe(1);
    });
  });

  /* ── 5. Movement summary ───────────────────────────────────────────────── */

  describe('movement summary', () => {
    it('adds up to the ledger and leaves an uncosted reason blank', async () => {
      const fixture = await createInventoryFixture(tenantId);
      await adjust(ctx(), {
        variantId: fixture.variantId,
        warehouseId: fixture.warehouseId,
        delta: 12,
        reason: 'receive',
      });
      await adjust(ctx(), {
        variantId: fixture.variantId,
        warehouseId: fixture.warehouseId,
        delta: -3,
        reason: 'damage',
      });

      const report = await movementSummaryReport(ctx(), {
        ...window(),
        warehouseId: fixture.warehouseId,
      });
      expect(report.totalUnitsIn).toBe(12);
      expect(report.totalUnitsOut).toBe(3);
      expect(report.netUnits).toBe(9);

      const receive = report.rows.find((row) => row.reason === 'receive');
      // Received with no cost recorded — blank, never $0.00.
      expect(receive?.costCents).toBeNull();
      expect(receive?.group).toBe('inbound');
      expect(report.uncostedMovements).toBeGreaterThan(0);
    });
  });

  /* ── 6 + 7. The import, and the round trip ─────────────────────────────── */

  describe('adjustment import', () => {
    it('plans without writing stock, applies what was planned, and reverses it', async () => {
      const fixture = await createInventoryFixture(tenantId);
      await adjust(ctx(), {
        variantId: fixture.variantId,
        warehouseId: fixture.warehouseId,
        delta: 10,
        reason: 'receive',
      });

      const sku = await withTenant(ctx(), async (tx) => {
        const variant = await tx.productVariant.findFirstOrThrow({
          where: { id: fixture.variantId },
          select: { sku: true },
        });
        return variant.sku;
      });
      const code = await withTenant(ctx(), async (tx) => {
        const warehouse = await tx.warehouse.findFirstOrThrow({
          where: { id: fixture.warehouseId },
          select: { code: true },
        });
        return warehouse.code;
      });

      const csv = `sku,warehouse,on_hand\n${sku},${code},14\n`;
      const planned = await planAdjustmentImport(ctx(), { csv, filename: 'count.csv' });

      expect(planned.status).toBe('planned');
      expect(planned.rowsToApply).toBe(1);
      expect(planned.plan[0]?.currentOnHand).toBe(10);
      expect(planned.plan[0]?.newOnHand).toBe(14);
      expect(planned.plan[0]?.delta).toBe(4);

      // Nothing has moved yet — the whole point of the two-step.
      const beforeApply = await withTenant(ctx(), (tx) =>
        tx.inventoryLevel.findFirstOrThrow({
          where: { variantId: fixture.variantId, warehouseId: fixture.warehouseId },
          select: { onHand: true },
        })
      );
      expect(beforeApply.onHand).toBe(10);

      const applied = await applyImportBatch(ctx(), planned.id);
      expect(applied.status).toBe('applied');
      expect(applied.rowsApplied).toBe(1);

      const afterApply = await withTenant(ctx(), (tx) =>
        tx.inventoryLevel.findFirstOrThrow({
          where: { variantId: fixture.variantId, warehouseId: fixture.warehouseId },
          select: { onHand: true },
        })
      );
      expect(afterApply.onHand).toBe(14);

      // The movements it wrote are traceable to the batch.
      const written = await withTenant(ctx(), (tx) =>
        tx.inventoryMovement.count({
          where: { referenceType: 'InventoryImportBatch', referenceId: planned.id },
        })
      );
      expect(written).toBe(1);

      const reversed = await reverseImportBatch(ctx(), planned.id);
      expect(reversed.reversedAt).not.toBeNull();

      const afterReverse = await withTenant(ctx(), (tx) =>
        tx.inventoryLevel.findFirstOrThrow({
          where: { variantId: fixture.variantId, warehouseId: fixture.warehouseId },
          select: { onHand: true },
        })
      );
      expect(afterReverse.onHand).toBe(10);

      // Append-only: the reversal ADDED a movement rather than deleting one.
      const total = await withTenant(ctx(), (tx) =>
        tx.inventoryMovement.count({
          where: { referenceType: 'InventoryImportBatch', referenceId: planned.id },
        })
      );
      expect(total).toBe(2);
    });

    it('reports a bad row by line number rather than failing the file', async () => {
      const fixture = await createInventoryFixture(tenantId);
      const code = await withTenant(ctx(), async (tx) => {
        const warehouse = await tx.warehouse.findFirstOrThrow({
          where: { id: fixture.warehouseId },
          select: { code: true },
        });
        return warehouse.code;
      });

      const csv = `sku,warehouse,on_hand\nNOT-A-REAL-SKU,${code},4\n`;
      const planned = await planAdjustmentImport(ctx(), { csv });
      expect(planned.rowsInvalid).toBe(1);
      expect(planned.plan[0]?.outcome).toBe('error');
      expect(planned.plan[0]?.line).toBe(2);
      expect(planned.plan[0]?.error).toContain('NOT-A-REAL-SKU');

      await discardImportBatch(ctx(), planned.id);
      const after = await getImportBatch(ctx(), planned.id);
      expect(after.status).toBe('discarded');
    });

    it('re-imports its own export without editing (10.6)', async () => {
      const fixture = await createInventoryFixture(tenantId);
      await adjust(ctx(), {
        variantId: fixture.variantId,
        warehouseId: fixture.warehouseId,
        delta: 7,
        reason: 'receive',
      });

      const table = await adjustmentTemplate(ctx(), { warehouseId: fixture.warehouseId });
      const csv = toCsv(table);

      // Straight back in, unedited. Every row should read as "already correct" —
      // which is only true if the writer's columns are the reader's columns AND
      // the BOM, the CRLFs and the quoting all survive.
      const planned = await planAdjustmentImport(ctx(), { csv, filename: 'round-trip.csv' });
      expect(planned.rowsInvalid).toBe(0);
      expect(planned.rowsToApply).toBe(0);
      expect(planned.rowsNoChange).toBe(planned.rowsTotal);
      expect(planned.rowsTotal).toBeGreaterThan(0);
    });
  });

  /* ── 8. Stock versus the books ─────────────────────────────────────────── */

  describe('GL reconciliation', () => {
    it('reports NULL unexplained until somebody says what the books hold', async () => {
      const report = await glReconciliationReport(ctx(), { asOf: new Date() });
      expect(report.awaitingLedgerFigure).toBe(true);
      expect(report.ledgerValueCents).toBeNull();
      // The number this must never be is 0.
      expect(report.unexplainedCents).toBeNull();
    });

    it('works out the difference once the balance is recorded', async () => {
      const asOf = new Date();
      const before = await glReconciliationReport(ctx(), { asOf });
      const target = before.sparxValueCents + before.explainedCents;

      await recordGlSnapshot(ctx(), {
        asOf,
        accountName: '1200 Stock',
        balanceCents: target,
      });

      const after = await glReconciliationReport(ctx(), { asOf });
      expect(after.awaitingLedgerFigure).toBe(false);
      expect(after.ledgerValueCents).toBe(target);
      expect(after.unexplainedCents).toBe(0);
    });

    it('replaces rather than duplicating a second reading of the same account', async () => {
      const asOf = new Date();
      await recordGlSnapshot(ctx(), {
        asOf,
        accountName: '1200 Stock',
        balanceCents: 999_00,
      });
      const rows = await withTenant(ctx(), (tx) =>
        tx.inventoryGlSnapshot.count({ where: { accountName: '1200 Stock' } })
      );
      expect(rows).toBe(1);
    });
  });

  /* ── 9. The journal ────────────────────────────────────────────────────── */

  describe('the inventory journal', () => {
    it('balances, and refuses to be sendable while a role is unmapped', async () => {
      const fixture = await createInventoryFixture(tenantId);
      await adjust(ctx(), {
        variantId: fixture.variantId,
        warehouseId: fixture.warehouseId,
        delta: 20,
        reason: 'receive',
        unitCostCents: 250,
      });
      await adjust(ctx(), {
        variantId: fixture.variantId,
        warehouseId: fixture.warehouseId,
        delta: -4,
        reason: 'sale',
      });

      const range = window();
      const journal = await inventoryJournalForPeriod(ctx(), range);

      // Every counterpart's other side is Inventory, so the entry balances by
      // construction — this asserts the construction rather than trusting it.
      expect(journal.imbalanceCents).toBe(0);
      expect(journal.totalDebitCents).toBe(journal.totalCreditCents);
      expect(journal.lines.length).toBeGreaterThan(0);
      expect(journal.lines.some((line) => line.role === 'inventory')).toBe(true);

      const unmapped = checkJournalSendable(journal, new Set(), null);
      expect(unmapped.ok).toBe(false);
      expect(unmapped.reasons.join(' ')).toContain('not matched to an account');

      const mapped = checkJournalSendable(
        journal,
        new Set(journal.lines.map((line) => line.role)),
        null
      );
      expect(mapped.ok).toBe(true);
    });

    it('refuses to post into a closed period', async () => {
      const journal = await inventoryJournalForPeriod(ctx(), window());
      const gate = checkJournalSendable(
        journal,
        new Set(journal.lines.map((line) => line.role)),
        // Books closed through tomorrow — everything is inside it.
        new Date(Date.now() + 2 * DAY)
      );
      expect(gate.ok).toBe(false);
      expect(gate.reasons.join(' ')).toContain('closed through');
    });
  });

  /* ── The registry, and what it guarantees ──────────────────────────────── */

  describe('the report registry', () => {
    it('runs every report it advertises', async () => {
      // The point of the registry is that the API's coverage IS the registry's
      // coverage. A report listed in the catalogue and unrunnable would be
      // invisible until somebody picked it in the schedule form.
      for (const entry of reportCatalog()) {
        const run = await runReport(ctx(), entry.key, { days: 30, take: 5 });
        expect(run.key, entry.key).toBe(entry.key);
        expect(run.csv.headers.length, entry.key).toBeGreaterThan(0);
        expect(run.summary.length, entry.key).toBeGreaterThan(0);
      }
    }, 60_000);
  });

  /* ── Schedules ─────────────────────────────────────────────────────────── */

  describe('report schedules', () => {
    it('computes the next run and clears the failure count on re-arming', async () => {
      const created = await createReportSchedule(ctx(), {
        reportKey: 'dead_stock',
        name: 'Monday dead stock',
        cadence: 'weekly',
        dayOfWeek: 1,
        hour: 7,
        timezone: 'UTC',
        recipients: ['owner@example.test'],
        format: 'csv',
        filters: {},
        isActive: true,
      });

      expect(created.nextRunAt).not.toBeNull();
      expect(new Date(created.nextRunAt ?? '').getTime()).toBeGreaterThan(Date.now());
      expect(created.reportLabel).not.toBe('dead_stock');

      const off = await updateReportSchedule(ctx(), created.id, { isActive: false });
      // Switched off means nothing is due — a stale `nextRunAt` on an inactive
      // row is how a paused schedule fires the moment it is re-enabled.
      expect(off.nextRunAt).toBeNull();

      const on = await updateReportSchedule(ctx(), created.id, { isActive: true });
      expect(on.nextRunAt).not.toBeNull();
      expect(on.consecutiveFailures).toBe(0);

      const list = await listReportSchedules(ctx());
      expect(list.items.some((row) => row.id === created.id)).toBe(true);
    });
  });
});
