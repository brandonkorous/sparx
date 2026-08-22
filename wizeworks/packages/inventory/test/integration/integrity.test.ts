// DB-backed coverage for inventory integrity (docs/146 Phase 1).
//
// The whole feature is a claim about a real database, so almost none of it can
// be proven with a fake. This suite pins the four things that only Postgres can
// answer:
//
//   1. Reconciliation finds a level whose recorded on-hand no longer matches
//      Σ(movements) — and, just as importantly, reports CLEAN when it does.
//   2. A blocked reserve records its incident even though the transaction that
//      discovered it is rolled back. This is the one that would silently not
//      work: the incident is written on a separate connection precisely because
//      the caller's transaction is about to abort.
//   3. The channel-buffer precedence survives its two partial unique indexes —
//      a plain unique on nullable columns would accept duplicate channel
//      defaults, which is the row that most needs to be unique.
//   4. The freshness sweep flips a source stale, is idempotent inside the same
//      breach, and clears on recovery.
//
// Requires `pnpm db:up`; skipped in CI (no DB) per vitest.config.ts.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { withTenant } from '@wizeworks/db';

import { setChannelBuffer, resolveChannelBuffer } from '../../src/services/channel-buffers.js';
import { listSourceFreshness, sweepSourceFreshness } from '../../src/services/freshness.js';
import {
  listOversellIncidents,
  oversellSummary,
  runReconciliation,
  listReconciliationDrifts,
} from '../../src/services/integrity.js';
import { applyMovement } from '../../src/services/ledger.js';
import { reserve } from '../../src/services/reservations.js';
import { shrinkageReport } from '../../src/services/shrinkage.js';
import {
  createInventoryFixture,
  createTestTenant,
  dropTestTenant,
  type InventoryFixture,
} from '../helpers.js';

const HOUR = 60 * 60 * 1000;

describe('inventory integrity — DB-backed', () => {
  let tenantId: string;
  const ctx = () => ({ tenantId });

  beforeAll(async () => {
    tenantId = (await createTestTenant()).tenantId;
  });
  afterAll(async () => {
    await dropTestTenant(tenantId);
  });

  /* ── 1. Reconciliation ─────────────────────────────────────────────────── */

  describe('reconciliation', () => {
    it('reports clean when every level reconciles', async () => {
      const f = await createInventoryFixture(tenantId);
      await withTenant(ctx(), (tx) =>
        applyMovement(tx, {
          tenantId,
          variantId: f.variantId,
          warehouseId: f.warehouseId,
          delta: 40,
          reason: 'receive',
          actorType: 'system',
          unitCostCents: 250,
        })
      );

      const run = await runReconciliation(ctx(), { scope: 'variant', variantId: f.variantId });
      expect(run.status).toBe('ok');
      expect(run.levelsChecked).toBeGreaterThan(0);
      expect(run.driftCount).toBe(0);
      // A clean run is a positive result, not an absence — the surface says so
      // out loud, so the numbers behind that claim have to be right.
      expect(run.driftUnits).toBe(0);
      expect(run.driftValueCents).toBe(0);
    });

    it('finds a level whose on-hand no longer matches its ledger', async () => {
      const f = await createInventoryFixture(tenantId);
      await withTenant(ctx(), (tx) =>
        applyMovement(tx, {
          tenantId,
          variantId: f.variantId,
          warehouseId: f.warehouseId,
          delta: 10,
          reason: 'receive',
          actorType: 'system',
          unitCostCents: 300,
        })
      );

      // Corrupt the level BEHIND the ledger's back — the only way to simulate
      // the class of bug this whole feature exists to catch. Nothing in the
      // application can do this, which is exactly why nobody would notice it.
      await withTenant(
        ctx(),
        (tx) =>
          tx.$executeRaw`
          UPDATE inventory_levels SET on_hand = 17
           WHERE variant_id = ${f.variantId}::uuid AND warehouse_id = ${f.warehouseId}::uuid
        `
      );

      const run = await runReconciliation(ctx(), { scope: 'variant', variantId: f.variantId });
      expect(run.status).toBe('drift');
      expect(run.driftCount).toBe(1);
      expect(run.driftUnits).toBe(7);
      // Valued at the level's cost basis (300¢ from the costed receipt).
      expect(run.driftValueCents).toBe(7 * 300);

      const { items } = await listReconciliationDrifts(ctx(), { variantId: f.variantId });
      expect(items).toHaveLength(1);
      expect(items[0]).toMatchObject({ recordedOnHand: 17, derivedOnHand: 10, delta: 7 });

      // NOT auto-corrected. The stored number is left exactly as found — a fix
      // that overwrote it would destroy the evidence, and if the ledger were the
      // damaged side it would spread the damage.
      const after = await withTenant(ctx(), (tx) =>
        tx.inventoryLevel.findFirst({
          where: { variantId: f.variantId, warehouseId: f.warehouseId },
          select: { onHand: true },
        })
      );
      expect(after?.onHand).toBe(17);
    });

    it('closes a drift once the level reconciles again', async () => {
      const f = await createInventoryFixture(tenantId);
      await withTenant(ctx(), (tx) =>
        applyMovement(tx, {
          tenantId,
          variantId: f.variantId,
          warehouseId: f.warehouseId,
          delta: 5,
          reason: 'receive',
          actorType: 'system',
        })
      );
      await withTenant(
        ctx(),
        (tx) =>
          tx.$executeRaw`
          UPDATE inventory_levels SET on_hand = 9
           WHERE variant_id = ${f.variantId}::uuid AND warehouse_id = ${f.warehouseId}::uuid
        `
      );
      await runReconciliation(ctx(), { scope: 'variant', variantId: f.variantId });
      expect(
        (await listReconciliationDrifts(ctx(), { variantId: f.variantId })).items
      ).toHaveLength(1);

      // Put it back the way the ledger says. A second pass must CLOSE the open
      // drift — an alarm list that only ever grows is one nobody reads.
      await withTenant(
        ctx(),
        (tx) =>
          tx.$executeRaw`
          UPDATE inventory_levels SET on_hand = 5
           WHERE variant_id = ${f.variantId}::uuid AND warehouse_id = ${f.warehouseId}::uuid
        `
      );
      await runReconciliation(ctx(), { scope: 'variant', variantId: f.variantId });

      const open = await listReconciliationDrifts(ctx(), { variantId: f.variantId });
      expect(open.items).toHaveLength(0);
      const all = await listReconciliationDrifts(ctx(), {
        variantId: f.variantId,
        includeResolved: true,
      });
      expect(all.items).toHaveLength(1);
      expect(all.items[0]?.resolvedAt).not.toBeNull();
    });
  });

  /* ── 2. Oversell incidents ─────────────────────────────────────────────── */

  describe('oversell incidents', () => {
    /** A variant that refuses to sell past zero. */
    async function denyFixture(): Promise<InventoryFixture> {
      const f = await createInventoryFixture(tenantId);
      await withTenant(ctx(), (tx) =>
        tx.productVariant.update({
          where: { id: f.variantId },
          data: { inventoryPolicy: 'deny' },
        })
      );
      return f;
    }

    it('records a BLOCKED incident even though the reserve transaction rolls back', async () => {
      const f = await denyFixture();
      await withTenant(ctx(), (tx) =>
        applyMovement(tx, {
          tenantId,
          variantId: f.variantId,
          warehouseId: f.warehouseId,
          delta: 2,
          reason: 'receive',
          actorType: 'system',
        })
      );

      await expect(
        reserve(ctx(), {
          variantId: f.variantId,
          warehouseId: f.warehouseId,
          quantity: 5,
          holderType: 'cart',
          holderId: crypto.randomUUID(),
        })
      ).rejects.toMatchObject({ code: 'OUT_OF_STOCK' });

      // THE point of the detached write. An in-transaction insert would have
      // been rolled back with the throw, and the refused sale — the incident an
      // operator most wants to see — would leave no trace at all.
      const { items } = await listOversellIncidents(ctx(), { variantId: f.variantId });
      expect(items).toHaveLength(1);
      expect(items[0]).toMatchObject({
        kind: 'blocked',
        requestedQuantity: 5,
        availableQuantity: 2,
        shortfall: 3,
        policy: 'deny',
        channel: 'storefront',
      });
      // The snapshot is what we BELIEVED at the moment, not a live re-read.
      expect(items[0]?.onHandAtDecision).toBe(2);
    });

    it('records an ALLOWED incident when a keep-selling variant is over-promised', async () => {
      const f = await createInventoryFixture(tenantId);
      await withTenant(ctx(), (tx) =>
        tx.productVariant.update({
          where: { id: f.variantId },
          data: { inventoryPolicy: 'continue' },
        })
      );

      // COUNT IT FIRST. The fixture creates a variant and a warehouse and no
      // inventory_level, and this test used to lean on `reserveOnTx` inventing a
      // 0/0 row on the way past — which is precisely the behaviour that made
      // every product a business typed in read "Sold out" on its own shop
      // (issue #037), and is gone. A variant nobody has counted is untracked,
      // so there is no quantity to over-promise and no incident to record.
      //
      // Over-promising is a real thing that happens to a real, counted stock
      // level, so the test now does that: three on hand, seven asked for, four
      // short — the same shortfall it always asserted.
      await withTenant(ctx(), (tx) =>
        applyMovement(tx, {
          tenantId,
          variantId: f.variantId,
          warehouseId: f.warehouseId,
          delta: 3,
          reason: 'receive',
          actorType: 'system',
        })
      );

      const result = await reserve(ctx(), {
        variantId: f.variantId,
        warehouseId: f.warehouseId,
        quantity: 7,
        holderType: 'order',
        holderId: crypto.randomUUID(),
      });
      // Non-null asserted, not `!`: this variant HAS been counted now, so a null
      // would mean the never-counted branch fired when it should not.
      expect(result).not.toBeNull();
      expect(result?.reservationId).toBeTruthy();

      const { items } = await listOversellIncidents(ctx(), { variantId: f.variantId });
      expect(items).toHaveLength(1);
      expect(items[0]).toMatchObject({ kind: 'allowed', shortfall: 4, policy: 'continue' });
    });

    it('records NEGATIVE_ON_HAND when a committed sale drives stock below zero', async () => {
      const f = await createInventoryFixture(tenantId);
      await withTenant(ctx(), (tx) =>
        applyMovement(tx, {
          tenantId,
          variantId: f.variantId,
          warehouseId: f.warehouseId,
          delta: -3,
          reason: 'sale',
          actorType: 'system',
          allowNegative: true,
        })
      );

      const { items } = await listOversellIncidents(ctx(), {
        variantId: f.variantId,
        kind: 'negative_on_hand',
      });
      expect(items).toHaveLength(1);
      expect(items[0]?.onHandAtDecision).toBe(0);
    });

    it('summarises the three kinds apart, because they need different reactions', async () => {
      const summary = await oversellSummary(ctx(), { windowDays: 1 });
      expect(summary.blocked).toBeGreaterThanOrEqual(1);
      expect(summary.allowed).toBeGreaterThanOrEqual(1);
      expect(summary.negativeOnHand).toBeGreaterThanOrEqual(1);
      expect(summary.variantsAffected).toBeGreaterThanOrEqual(3);
      expect(summary.topVariants.length).toBeGreaterThan(0);
    });
  });

  /* ── 3. Channel buffers ────────────────────────────────────────────────── */

  describe('channel buffers', () => {
    it('resolves override → channel default → level cushion, against real rows', async () => {
      const f = await createInventoryFixture(tenantId);
      await withTenant(
        ctx(),
        (tx) =>
          tx.$executeRaw`
          INSERT INTO inventory_levels (tenant_id, variant_id, warehouse_id, on_hand, allocated, safety_buffer, as_of, updated_at)
          VALUES (${tenantId}::uuid, ${f.variantId}::uuid, ${f.warehouseId}::uuid, 50, 0, 6, now(), now())
          ON CONFLICT (variant_id, warehouse_id) DO UPDATE SET safety_buffer = 6
        `
      );

      // Nothing declared → the level's own cushion.
      await expect(
        resolveChannelBuffer(ctx(), {
          variantId: f.variantId,
          warehouseId: f.warehouseId,
          channel: 'amazon',
        })
      ).resolves.toMatchObject({ buffer: 6, source: 'level' });

      await setChannelBuffer(ctx(), { channel: 'amazon', buffer: 3 });
      await expect(
        resolveChannelBuffer(ctx(), {
          variantId: f.variantId,
          warehouseId: f.warehouseId,
          channel: 'amazon',
        })
      ).resolves.toMatchObject({ buffer: 3, source: 'channel_default' });

      await setChannelBuffer(ctx(), {
        channel: 'amazon',
        variantId: f.variantId,
        warehouseId: f.warehouseId,
        buffer: 11,
      });
      await expect(
        resolveChannelBuffer(ctx(), {
          variantId: f.variantId,
          warehouseId: f.warehouseId,
          channel: 'amazon',
        })
      ).resolves.toMatchObject({ buffer: 11, source: 'override' });
    });

    it('keeps ONE channel default however many times it is set', async () => {
      await setChannelBuffer(ctx(), { channel: 'ebay', buffer: 2 });
      await setChannelBuffer(ctx(), { channel: 'ebay', buffer: 5 });

      // The partial unique index is what makes this true. A plain UNIQUE over
      // nullable variant/warehouse columns would have accepted both rows,
      // because Postgres treats NULLs as distinct — and the second setting would
      // have silently done nothing.
      const rows = await withTenant(ctx(), (tx) =>
        tx.inventoryChannelBuffer.findMany({ where: { tenantId, channel: 'ebay' } })
      );
      expect(rows).toHaveLength(1);
      expect(rows[0]?.buffer).toBe(5);
    });

    it('refuses a half-specified scope', async () => {
      await expect(
        setChannelBuffer(ctx(), { channel: 'etsy', variantId: crypto.randomUUID(), buffer: 1 })
      ).rejects.toThrow();
    });
  });

  /* ── 4. Freshness sweep ────────────────────────────────────────────────── */

  describe('freshness sweep', () => {
    async function makeSource(lastSyncAgoMs: number, expectedIntervalSec: number) {
      return withTenant(ctx(), (tx) =>
        tx.inventorySource.create({
          data: {
            tenantId,
            name: `Feed ${crypto.randomUUID().slice(0, 8)}`,
            type: 'csv',
            lastSyncAt: new Date(Date.now() - lastSyncAgoMs),
            expectedIntervalSec,
          },
          select: { id: true },
        })
      );
    }

    it('flags a source past its promise, and is idempotent inside the same breach', async () => {
      const source = await makeSource(6 * HOUR, 60 * 60); // 6h old, promised hourly

      const first = await sweepSourceFreshness(ctx());
      expect(first.newlyStale).toBeGreaterThanOrEqual(1);

      const rows = await listSourceFreshness(ctx(), { sourceId: source.id });
      expect(rows[0]).toMatchObject({ isStale: true });
      expect(rows[0]?.staleSince).not.toBeNull();
      expect(rows[0]?.overdueSeconds).toBeGreaterThan(0);

      // A source stale for a week should have produced ONE alarm, not one per
      // sweep — so the second pass must report no new transitions.
      const second = await sweepSourceFreshness(ctx());
      expect(second.newlyStale).toBe(0);
      expect(second.stillStale).toBeGreaterThanOrEqual(1);
    });

    it('clears the flag when the source reports again', async () => {
      const source = await makeSource(6 * HOUR, 60 * 60);
      await sweepSourceFreshness(ctx());

      await withTenant(ctx(), (tx) =>
        tx.inventorySource.update({ where: { id: source.id }, data: { lastSyncAt: new Date() } })
      );
      const recovered = await sweepSourceFreshness(ctx());
      expect(recovered.recovered).toBeGreaterThanOrEqual(1);

      const rows = await listSourceFreshness(ctx(), { sourceId: source.id });
      expect(rows[0]).toMatchObject({ isStale: false, staleSince: null });
    });

    it('leaves a source that never synced alone rather than crying wolf', async () => {
      const source = await withTenant(ctx(), (tx) =>
        tx.inventorySource.create({
          data: { tenantId, name: 'Never run', type: 'csv', expectedIntervalSec: 60 },
          select: { id: true },
        })
      );
      await sweepSourceFreshness(ctx());
      const rows = await listSourceFreshness(ctx(), { sourceId: source.id });
      // Unconfigured, not overdue. The sources list already says so plainly, and
      // a second red flag here would train people to ignore the flag.
      expect(rows[0]?.isStale).toBe(false);
    });
  });

  /* ── 5. Shrinkage ──────────────────────────────────────────────────────── */

  describe('shrinkage', () => {
    it('counts losses and damage, and reports found stock apart from lost stock', async () => {
      const f = await createInventoryFixture(tenantId);
      const move = (delta: number, reason: string, unitCostCents?: number) =>
        withTenant(ctx(), (tx) =>
          applyMovement(tx, {
            tenantId,
            variantId: f.variantId,
            warehouseId: f.warehouseId,
            delta,
            reason,
            actorType: 'system',
            ...(unitCostCents === undefined ? {} : { unitCostCents }),
          })
        );

      await move(100, 'receive', 400);
      await move(-6, 'loss');
      await move(-4, 'damage');
      await move(-2, 'recount');
      await move(3, 'recount'); // found — must NOT net off the losses
      await move(-20, 'sale'); // must not count as shrinkage at all

      const report = await shrinkageReport(ctx(), {});
      expect(report.totalUnits).toBe(12); // 6 + 4 + 2, sale excluded
      expect(report.totalValueCents).toBe(12 * 400);
      expect(report.recountGainUnits).toBe(3);
      expect(report.byReason.map((r) => r.reason).sort()).toEqual(['damage', 'loss', 'recount']);
      // A business that finds as much as it loses has a counting problem rather
      // than a theft problem, and netting the two would say it has neither.
      expect(report.totalUnits).not.toBe(9);
    });
  });
});
