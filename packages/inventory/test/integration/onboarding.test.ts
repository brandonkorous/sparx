// DB-backed coverage for onboarding — beating the spreadsheet (docs/146 Phase 11).
//
// The pure arithmetic has its own unit tests; what these hold is the part that
// touches the database, where the honest behaviour is easiest to lose:
//
//   1. A setup nobody has started reports NO timing, and the wizard reads the
//      world as well as its own record.
//   2. A preview reads a file and writes nothing — no batch, no stock.
//   3. A saved mapping BEATS the guess, and a file the mapping does not fit
//      falls back to the guess rather than confidently reading the wrong column.
//   4. An import honours a hand-chosen mapping over the built-in aliases.
//   5. A row whose code matches nothing can be created or skipped, and
//      `skipped` stays distinct from "already correct".
//   6. Custom-field values are coerced, not stored as typed — and a bad value
//      is refused rather than written.
//   7. The template exports `cf_` columns that the importer reads back.
//   8. The grid computes its delta against LIVE stock, not against what the
//      browser was showing.
//   9. An opening count posts under the `opening` reason, so a business's first
//      day does not appear in the shrinkage report.
//
// Requires `pnpm db:up`; skipped in CI (no DB) per vitest.config.ts.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { withTenant } from '@sparx/db';

import { toCsv } from '../../src/csv.js';
import { adjust } from '../../src/services/movements.js';
import {
  applyImportBatch,
  planAdjustmentImport,
  resolveImportRows,
} from '../../src/services/adjustment-import.js';
import {
  createCustomField,
  getCustomFieldValues,
  setCustomFieldValues,
} from '../../src/services/custom-fields.js';
import { createImportProfile, previewImport } from '../../src/services/import-profiles.js';
import { completeSetupStep, getSetupProgress } from '../../src/services/setup-progress.js';
import { saveStockGrid, stockGrid } from '../../src/services/stock-grid.js';
import { startOpeningBalance } from '../../src/services/opening-balance.js';
import { enterCounts } from '../../src/services/inventory-counts.js';
import {
  postInventoryCount,
  submitInventoryCount,
} from '../../src/services/inventory-count-lifecycle.js';
import { movementSummaryReport } from '../../src/services/performance-reports.js';
import {
  createInventoryFixture,
  createTestTenant,
  dropTestTenant,
  type InventoryFixture,
} from '../helpers.js';

describe('onboarding — DB-backed', () => {
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

  /** The stock file a person would upload, in their own headings. */
  const fileFor = (fixture: InventoryFixture, sku: string, quantity: number): string =>
    ['Item Code,Qty On Hand,Where', `${sku},${quantity},${fixture.warehouseCode}`].join('\n');

  /* ── 1. The setup clock ───────────────────────────────────────────────── */

  describe('setup progress', () => {
    it('measures nothing before anything has happened, and never zero', async () => {
      const progress = await getSetupProgress(ctx());
      expect(progress.startedAt).toBeNull();
      expect(progress.timing.handsOnMs).toBeNull();
      expect(progress.timing.elapsedMs).toBeNull();
      expect(progress.timing.withinTarget).toBeNull();
      expect(progress.completedCount).toBe(0);
    });

    it('reads the world as well as its own record', async () => {
      await createInventoryFixture(tenantId);
      const progress = await getSetupProgress(ctx());
      expect(progress.readiness.locations).toBeGreaterThan(0);
      const locations = progress.stepViews.find((step) => step.key === 'locations');
      // Nobody ticked it, and it is nonetheless true.
      expect(locations?.completedAt).toBeNull();
      expect(locations?.satisfied).toBe(true);
      expect(locations?.discrepancy).toContain('already done this');
    });

    it('stamps a start on the first interaction and settles a skipped step', async () => {
      await completeSetupStep(ctx(), { step: 'locations', action: 'complete' });
      const after = await completeSetupStep(ctx(), { step: 'alerts', action: 'skip' });
      expect(after.startedAt).not.toBeNull();
      expect(after.completedCount).toBe(1);
      expect(after.skippedCount).toBe(1);
      expect(after.remaining).not.toContain('alerts');
    });
  });

  /* ── 2–4. Reading somebody else's spreadsheet ─────────────────────────── */

  describe('preview and mapping', () => {
    it('reads a file, guesses the columns, and writes NOTHING', async () => {
      const fixture = await createInventoryFixture(tenantId);
      const before = await withTenant(ctx(), (tx) =>
        tx.inventoryImportBatch.count({ where: { tenantId } })
      );

      const preview = await previewImport(ctx(), {
        csv: fileFor(fixture, fixture.sku, 12),
        filename: 'monthly.csv',
      });

      expect(preview.rowCount).toBe(1);
      expect(preview.mapping.ready).toBe(true);
      expect(preview.mapping.matches.find((m) => m.key === 'sku')?.header).toBe('Item Code');
      expect(preview.mapping.matches.find((m) => m.key === 'onHand')?.header).toBe('Qty On Hand');

      const after = await withTenant(ctx(), (tx) =>
        tx.inventoryImportBatch.count({ where: { tenantId } })
      );
      expect(after).toBe(before);
      const level = await withTenant(ctx(), (tx) =>
        tx.inventoryLevel.findFirst({
          where: { variantId: fixture.variantId, warehouseId: fixture.warehouseId },
        })
      );
      expect(level).toBeNull();
    });

    it('a saved mapping beats the guess', async () => {
      const fixture = await createInventoryFixture(tenantId);
      const profile = await createImportProfile(ctx(), {
        name: `Odd headings ${fixture.sku}`,
        // Deliberately perverse: the quantity lives in a column called "Notes".
        mapping: { sku: 'Item Code', onHand: 'Notes' },
      });

      const preview = await previewImport(ctx(), {
        csv: `Item Code,Notes\n${fixture.sku},9`,
        profileId: profile.id,
      });
      expect(preview.mapping.matches.find((m) => m.key === 'onHand')?.header).toBe('Notes');
      expect(preview.profile?.id).toBe(profile.id);
    });

    it('falls back to the guess when the saved heading is not in THIS file', async () => {
      const fixture = await createInventoryFixture(tenantId);
      const profile = await createImportProfile(ctx(), {
        name: `Missing column ${fixture.sku}`,
        mapping: { sku: 'Item Code', onHand: 'Column That Left' },
      });

      const preview = await previewImport(ctx(), {
        csv: `Item Code,On Hand\n${fixture.sku},4`,
        profileId: profile.id,
      });
      // The saved answer pointed at a heading that is gone. Reading a different
      // column confidently would be the failure; guessing again is right.
      expect(preview.mapping.matches.find((m) => m.key === 'onHand')?.header).toBe('On Hand');
    });

    it('an import honours the chosen mapping over the built-in aliases', async () => {
      const fixture = await createInventoryFixture(tenantId);
      const batch = await planAdjustmentImport(ctx(), {
        // "quantity" would normally be read as the count. The mapping says the
        // count is in "Counted", and the mapping wins.
        csv: `sku,quantity,Counted\n${fixture.sku},999,7`,
        warehouseId: fixture.warehouseId,
        mapping: { sku: 'sku', onHand: 'Counted' },
      });
      expect(batch.plan[0]?.newOnHand).toBe(7);
      expect(batch.plan[0]?.outcome).toBe('apply');
    });
  });

  /* ── 5. Resolving the rows that did not land ──────────────────────────── */

  describe('row resolution', () => {
    it('creates the missing item, as an unpriced draft, and applies its row', async () => {
      const fixture = await createInventoryFixture(tenantId);
      const planned = await planAdjustmentImport(ctx(), {
        csv: `sku,item,on_hand\nBRAND-NEW-1,Front brake pad,15`,
        warehouseId: fixture.warehouseId,
      });
      expect(planned.plan[0]?.outcome).toBe('error');
      expect(planned.summary.newItemCount).toBe(1);
      expect(planned.plan[0]?.name).toBe('Front brake pad');

      const resolved = await resolveImportRows(ctx(), planned.id, {
        resolutions: [
          {
            line: planned.plan[0]!.line,
            action: 'create',
            sku: 'BRAND-NEW-1',
            title: 'Front brake pad',
            unitCostCents: 250,
          },
        ],
      });
      expect(resolved.plan[0]?.outcome).toBe('apply');
      expect(resolved.plan[0]?.resolution).toBe('create');
      expect(resolved.rowsInvalid).toBe(0);

      const created = await withTenant(ctx(), (tx) =>
        tx.productVariant.findFirst({
          where: { tenantId, sku: 'BRAND-NEW-1' },
          include: { product: { select: { status: true } } },
        })
      );
      // Drafted and unpriced: a stock file says nothing about what to sell it
      // for, and a zero price on a published item is a giveaway.
      expect(created?.product.status).toBe('draft');
      expect(created?.priceCents).toBe(0);
      expect(created?.costCents).toBe(250);

      const applied = await applyImportBatch(ctx(), planned.id);
      expect(applied.rowsApplied).toBe(1);
    });

    it('keeps "left out" distinct from "already correct"', async () => {
      const fixture = await createInventoryFixture(tenantId);
      const planned = await planAdjustmentImport(ctx(), {
        csv: `sku,on_hand\nNOT-A-REAL-CODE,4`,
        warehouseId: fixture.warehouseId,
      });
      const resolved = await resolveImportRows(ctx(), planned.id, {
        resolutions: [{ line: planned.plan[0]!.line, action: 'skip' }],
      });
      expect(resolved.plan[0]?.outcome).toBe('skipped');
      expect(resolved.summary.skippedCount).toBe(1);
      expect(resolved.summary.noChangeCount).toBe(0);
      expect(resolved.rowsInvalid).toBe(0);

      const applied = await applyImportBatch(ctx(), planned.id);
      expect(applied.rowsApplied).toBe(0);
    });
  });

  /* ── 6–7. The tenant's own columns ────────────────────────────────────── */

  describe('custom fields', () => {
    it('coerces on write and refuses a value the type does not allow', async () => {
      const fixture = await createInventoryFixture(tenantId);
      await adjust(ctx(), {
        variantId: fixture.variantId,
        warehouseId: fixture.warehouseId,
        delta: 5,
        reason: 'receive',
      });

      const field = await createCustomField(ctx(), {
        entity: 'level',
        label: 'Cycle count due',
        type: 'date',
      });
      expect(field.key).toBe('cycle_count_due');

      const target = { variantId: fixture.variantId, warehouseId: fixture.warehouseId };
      const values = await setCustomFieldValues(ctx(), 'level', target, {
        cycle_count_due: '2026-09-01T14:00:00Z',
      });
      // A day, not a timezone-shifted midnight.
      expect(values.cycle_count_due).toBe('2026-09-01');

      await expect(
        setCustomFieldValues(ctx(), 'level', target, { cycle_count_due: 'sometime' })
      ).rejects.toThrow(/must be a date/i);

      const after = await getCustomFieldValues(ctx(), 'level', target);
      expect(after.values.cycle_count_due).toBe('2026-09-01');
    });

    it('exports as a cf_ column that the importer reads back', async () => {
      const fixture = await createInventoryFixture(tenantId);
      await adjust(ctx(), {
        variantId: fixture.variantId,
        warehouseId: fixture.warehouseId,
        delta: 3,
        reason: 'receive',
      });
      const field = await createCustomField(ctx(), {
        entity: 'level',
        label: `Aisle ${fixture.sku}`,
        type: 'text',
      });

      const planned = await planAdjustmentImport(ctx(), {
        csv: [
          `sku,warehouse,on_hand,cf_${field.key}`,
          `${fixture.sku},${fixture.warehouseCode},3,B-14`,
        ].join('\n'),
      });
      // The quantity is unchanged and the row still carries work to do — a file
      // that only corrects an aisle number is a real import.
      expect(planned.plan[0]?.outcome).toBe('no_change');
      expect(planned.plan[0]?.customFields).toEqual({ [field.key]: 'B-14' });

      const applied = await applyImportBatch(ctx(), planned.id);
      expect(applied.fieldsUpdated).toBe(1);

      const values = await getCustomFieldValues(ctx(), 'level', {
        variantId: fixture.variantId,
        warehouseId: fixture.warehouseId,
      });
      expect(values.values[field.key]).toBe('B-14');
    });
  });

  /* ── 8. The grid ──────────────────────────────────────────────────────── */

  describe('stock grid', () => {
    it('computes the delta against LIVE stock, not against what was on screen', async () => {
      const fixture = await createInventoryFixture(tenantId);
      await adjust(ctx(), {
        variantId: fixture.variantId,
        warehouseId: fixture.warehouseId,
        delta: 20,
        reason: 'receive',
      });

      // What the browser is showing.
      const page = await stockGrid(ctx(), { warehouseId: fixture.warehouseId });
      const row = page.rows.find((entry) => entry.variantId === fixture.variantId);
      expect(row?.onHand).toBe(20);

      // Three sell while the grid is open.
      await adjust(ctx(), {
        variantId: fixture.variantId,
        warehouseId: fixture.warehouseId,
        delta: -3,
        reason: 'sale',
      });

      // The operator types 25, meaning "there are 25 on the shelf".
      const saved = await saveStockGrid(ctx(), {
        edits: [
          {
            variantId: fixture.variantId,
            warehouseId: fixture.warehouseId,
            onHand: 25,
            reorderPoint: 8,
          },
        ],
      });
      expect(saved.saved).toBe(1);
      expect(saved.failed).toBe(0);
      // 25 against the LIVE 17, not against the stale 20 the grid showed.
      expect(saved.results[0]?.delta).toBe(8);
      expect(saved.results[0]?.onHand).toBe(25);

      const after = await stockGrid(ctx(), { warehouseId: fixture.warehouseId });
      const updated = after.rows.find((entry) => entry.variantId === fixture.variantId);
      expect(updated?.onHand).toBe(25);
      expect(updated?.reorderPoint).toBe(8);
    });

    it('saves the rows it can and reports the ones it cannot', async () => {
      const fixture = await createInventoryFixture(tenantId);
      const result = await saveStockGrid(ctx(), {
        edits: [
          { variantId: fixture.variantId, warehouseId: fixture.warehouseId, reorderPoint: 4 },
          // A variant that does not exist — the FK refuses it.
          {
            variantId: '00000000-0000-0000-0000-000000000000',
            warehouseId: fixture.warehouseId,
            reorderPoint: 4,
          },
        ],
      });
      expect(result.saved).toBe(1);
      expect(result.failed).toBe(1);
      expect(result.results[1]?.error).not.toBeNull();
    });
  });

  /* ── 9. The opening balance ───────────────────────────────────────────── */

  describe('opening balance', () => {
    it('posts under the `opening` reason, so day one is not a day of shrinkage', async () => {
      const fixture = await createInventoryFixture(tenantId);

      const count = await startOpeningBalance(ctx(), {
        warehouseId: fixture.warehouseId,
        isBlind: true,
      });
      expect(count.type).toBe('opening');
      // Seeded from the CATALOGUE, so an item with no level yet is on the sheet.
      const line = count.lines.find((entry) => entry.variantId === fixture.variantId);
      expect(line).toBeDefined();
      // Withheld, because the count is blind — the whole point of an opening
      // count is that the number comes off the shelf rather than off the screen.
      expect(line?.expectedQuantity).toBeNull();

      await enterCounts(ctx(), count.id, {
        entries: count.lines.map((entry) => ({
          lineId: entry.id,
          countedQuantity: entry.variantId === fixture.variantId ? 42 : 0,
        })),
      });
      await submitInventoryCount(ctx(), count.id);
      const posted = await postInventoryCount(ctx(), count.id);
      expect(posted.status).toBe('posted');

      const movements = await withTenant(ctx(), (tx) =>
        tx.inventoryMovement.findMany({
          where: { variantId: fixture.variantId, warehouseId: fixture.warehouseId },
          select: { reason: true, delta: true },
        })
      );
      expect(movements).toHaveLength(1);
      expect(movements[0]?.reason).toBe('opening');
      expect(movements[0]?.delta).toBe(42);

      // And it groups as stock arriving, not as a correction.
      const summary = await movementSummaryReport(ctx(), {
        warehouseId: fixture.warehouseId,
        from: new Date(Date.now() - 24 * 60 * 60 * 1000),
        to: new Date(Date.now() + 24 * 60 * 60 * 1000),
      });
      const opening = summary.rows.find((entry) => entry.reason === 'opening');
      expect(opening?.group).toBe('inbound');
    });

    it('refuses a second opening count while one is open', async () => {
      const fixture = await createInventoryFixture(tenantId);
      await startOpeningBalance(ctx(), { warehouseId: fixture.warehouseId });
      await expect(
        startOpeningBalance(ctx(), { warehouseId: fixture.warehouseId })
      ).rejects.toThrow(/already open/i);
    });
  });

  /* ── The template round-trip, with a custom column ────────────────────── */

  it('the exported grid is a CSV the importer can read', async () => {
    const fixture = await createInventoryFixture(tenantId);
    await adjust(ctx(), {
      variantId: fixture.variantId,
      warehouseId: fixture.warehouseId,
      delta: 11,
      reason: 'receive',
    });
    const { stockGridCsv } = await import('../../src/services/stock-grid.js');
    const table = await stockGridCsv(ctx(), { warehouseId: fixture.warehouseId });
    const text = toCsv(table);

    const planned = await planAdjustmentImport(ctx(), { csv: text });
    // Every row round-trips as "already correct" — which is the whole claim of
    // 10.6, still holding with the grid's own columns on the file.
    expect(planned.rowsInvalid).toBe(0);
    expect(planned.rowsToApply).toBe(0);
    expect(planned.rowsTotal).toBeGreaterThan(0);
  });
});
