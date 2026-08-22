// DB-backed coverage for bins (docs/146 Phase 2).
//
// The whole layer is a claim about three invariants holding against a real
// database, so almost none of it can be proven with a fake:
//
//   1. Bins are OPT-IN. With them off, nothing changes at all — no bin rows, no
//      behaviour difference. This is the test that keeps the feature from making
//      the product worse for the tenants who will never want it.
//   2. Turning them on seats existing stock, so `Σ(bins) == level` holds from the
//      first instant rather than from the first put-away.
//   3. Every movement keeps all three invariants in step: the warehouse ledger,
//      the bin ledger, and the sum between them.
//
// Plus the two refusals that protect the data: a shelf cannot go negative, and a
// shelf holding stock cannot be archived.
//
// Requires `pnpm db:up`; skipped in CI (no DB) per vitest.config.ts.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { withTenant } from '@wizeworks/db';

import {
  archiveBin,
  binContents,
  binsForVariant,
  createBin,
  enableBinsForWarehouse,
  moveBetweenBins,
  setVariantHomeBin,
  suggestPutAway,
} from '../../src/services/bins.js';
import { runReconciliation, listReconciliationDrifts } from '../../src/services/integrity.js';
import { applyMovement } from '../../src/services/ledger.js';
import {
  createInventoryFixture,
  createTestTenant,
  dropTestTenant,
  type InventoryFixture,
} from '../helpers.js';

describe('inventory bins — DB-backed', () => {
  let tenantId: string;
  const ctx = () => ({ tenantId });

  beforeAll(async () => {
    tenantId = (await createTestTenant()).tenantId;
  });
  afterAll(async () => {
    await dropTestTenant(tenantId);
  });

  /** Σ of every shelf holding this variant at this location. */
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

  async function levelOnHand(f: InventoryFixture): Promise<number> {
    const level = await withTenant(ctx(), (tx) =>
      tx.inventoryLevel.findFirst({
        where: { variantId: f.variantId, warehouseId: f.warehouseId },
        select: { onHand: true },
      })
    );
    return level?.onHand ?? 0;
  }

  const receive = (f: InventoryFixture, delta: number, binId?: string) =>
    withTenant(ctx(), (tx) =>
      applyMovement(tx, {
        tenantId,
        variantId: f.variantId,
        warehouseId: f.warehouseId,
        delta,
        reason: delta > 0 ? 'receive' : 'sale',
        actorType: 'system',
        ...(binId ? { binId } : {}),
      })
    );

  /* ── 1. Opt-in ─────────────────────────────────────────────────────────── */

  it('writes NO bin rows at all while bins are off', async () => {
    const f = await createInventoryFixture(tenantId);
    await receive(f, 25);

    expect(await levelOnHand(f)).toBe(25);
    // Not "sums to the same" — literally nothing. A location that never opted in
    // must not accumulate a shadow structure it never asked for.
    const binRows = await withTenant(ctx(), (tx) =>
      tx.inventoryBinLevel.count({ where: { warehouseId: f.warehouseId } })
    );
    expect(binRows).toBe(0);
  });

  /* ── 2. Turning them on ────────────────────────────────────────────────── */

  it('provisions the system shelves and seats existing stock in DEFAULT', async () => {
    const f = await createInventoryFixture(tenantId);
    await receive(f, 40);

    const result = await enableBinsForWarehouse(ctx(), f.warehouseId);
    // DEFAULT, QUARANTINE, DAMAGED and — since docs/146 Phase 9.7 — REPAIR.
    expect(result.binsCreated).toBe(4);
    expect(result.levelsSeated).toBeGreaterThanOrEqual(1);

    // The invariant holds from the first instant, not from the first put-away —
    // a tenant who flipped the switch and saw empty shelves beside a location
    // total of forty would rightly conclude the feature was broken.
    expect(await binSum(f)).toBe(40);
    expect(await levelOnHand(f)).toBe(40);

    const bins = await withTenant(ctx(), (tx) =>
      tx.inventoryBin.findMany({
        where: { warehouseId: f.warehouseId },
        select: { code: true, isSellable: true, isDefault: true },
        orderBy: { code: 'asc' },
      })
    );
    expect(bins.map((b) => b.code)).toEqual(['DAMAGED', 'DEFAULT', 'QUARANTINE', 'REPAIR']);
    // The three holding shelves must not be sellable. If they were, quarantining
    // something would do nothing at all — and since docs/146 Phase 9.7 that is
    // load-bearing rather than decorative: `unsellable_on_hand` is summed from
    // exactly these, and it is what a returns disposition relies on.
    expect(bins.find((b) => b.code === 'QUARANTINE')?.isSellable).toBe(false);
    expect(bins.find((b) => b.code === 'DAMAGED')?.isSellable).toBe(false);
    expect(bins.find((b) => b.code === 'REPAIR')?.isSellable).toBe(false);
    expect(bins.filter((b) => b.isDefault)).toHaveLength(1);
  });

  it('is idempotent — enabling twice provisions nothing new and re-seats nothing', async () => {
    const f = await createInventoryFixture(tenantId);
    await receive(f, 10);
    await enableBinsForWarehouse(ctx(), f.warehouseId);
    const second = await enableBinsForWarehouse(ctx(), f.warehouseId);

    expect(second.binsCreated).toBe(0);
    expect(second.levelsSeated).toBe(0);
    expect(await binSum(f)).toBe(10);
  });

  /* ── 3. The invariants stay in step ────────────────────────────────────── */

  describe('with bins on', () => {
    let f: InventoryFixture;
    let pickBin: string;

    beforeAll(async () => {
      f = await createInventoryFixture(tenantId);
      await enableBinsForWarehouse(ctx(), f.warehouseId);
      const bin = await createBin(ctx(), {
        warehouseId: f.warehouseId,
        code: 'A-01',
        type: 'pick',
        pickSequence: 1,
      });
      pickBin = bin.id;
    });

    it('mirrors an inbound movement onto the named shelf', async () => {
      await receive(f, 30, pickBin);
      expect(await levelOnHand(f)).toBe(30);
      expect(await binSum(f)).toBe(30);

      const contents = await binContents(ctx(), pickBin);
      expect(contents.find((c) => c.variantId === f.variantId)?.onHand).toBe(30);
    });

    it('draws an unnamed outbound down across the shelves that hold stock', async () => {
      // A sale does not know which shelf a picker used. Refusing to record it
      // until someone says would block checkout; guessing one shelf would drive
      // it negative while others sat full.
      const second = await createBin(ctx(), {
        warehouseId: f.warehouseId,
        code: 'B-02',
        type: 'pick',
        pickSequence: 2,
      });
      await receive(f, 5, second.id);
      expect(await binSum(f)).toBe(35);

      await receive(f, -32); // no bin named
      expect(await levelOnHand(f)).toBe(3);
      expect(await binSum(f)).toBe(3);

      // Richest first: A-01 held 30 and empties, B-02 held 5 and keeps 3.
      const where = await binsForVariant(ctx(), f.variantId, { warehouseId: f.warehouseId });
      expect(where.find((b) => b.binCode === 'B-02')?.onHand).toBe(3);
      expect(where.find((b) => b.binCode === 'A-01')).toBeUndefined(); // empty, so not listed
    });

    it('reconciles clean across all three invariants', async () => {
      const run = await runReconciliation(ctx(), { scope: 'variant', variantId: f.variantId });
      expect(run.status).toBe('ok');
      expect(run.driftCount).toBe(0);
    });

    it('reports a drift when the shelves stop summing to the location', async () => {
      // Corrupt a shelf behind the ledger's back — the bin-sum cross-check is the
      // only thing that can catch this, because the LOCATION still reconciles
      // perfectly against its own history.
      await withTenant(
        ctx(),
        (tx) =>
          tx.$executeRaw`
          UPDATE inventory_bin_levels SET on_hand = on_hand + 9
           WHERE variant_id = ${f.variantId}::uuid AND bin_id = ${pickBin}::uuid
        `
      );

      const run = await runReconciliation(ctx(), { scope: 'variant', variantId: f.variantId });
      expect(run.status).toBe('drift');
      const { items } = await listReconciliationDrifts(ctx(), { variantId: f.variantId });
      expect(items.length).toBeGreaterThanOrEqual(1);

      // Put it back so the later tests in this block start from a clean slate.
      await withTenant(
        ctx(),
        (tx) =>
          tx.$executeRaw`
          UPDATE inventory_bin_levels SET on_hand = on_hand - 9
           WHERE variant_id = ${f.variantId}::uuid AND bin_id = ${pickBin}::uuid
        `
      );
      await runReconciliation(ctx(), { scope: 'variant', variantId: f.variantId });
    });

    /* ── Moving between shelves ──────────────────────────────────────────── */

    it('moves stock shelf-to-shelf WITHOUT changing the location total', async () => {
      const target = await createBin(ctx(), {
        warehouseId: f.warehouseId,
        code: 'C-03',
        type: 'pick',
      });
      const before = await levelOnHand(f);

      await moveBetweenBins(ctx(), {
        variantId: f.variantId,
        fromBinId: (await binsForVariant(ctx(), f.variantId))[0]?.binId ?? '',
        toBinId: target.id,
        quantity: 2,
      });

      // The honest record: nothing entered or left the building.
      expect(await levelOnHand(f)).toBe(before);
      expect(await binSum(f)).toBe(before);

      const warehouseRows = await withTenant(ctx(), (tx) =>
        tx.inventoryMovement.count({
          where: { variantId: f.variantId, reason: 'bin_move' },
        })
      );
      expect(warehouseRows).toBe(0); // no warehouse movement at all

      const binRows = await withTenant(ctx(), (tx) =>
        tx.inventoryBinMovement.count({
          where: { variantId: f.variantId, reason: 'bin_move' },
        })
      );
      expect(binRows).toBe(2); // the −N/+N pair
    });

    it('refuses to move more than the source shelf holds', async () => {
      const target = await createBin(ctx(), {
        warehouseId: f.warehouseId,
        code: 'D-04',
        type: 'pick',
      });
      const source = (await binsForVariant(ctx(), f.variantId))[0];
      await expect(
        moveBetweenBins(ctx(), {
          variantId: f.variantId,
          fromBinId: source?.binId ?? '',
          toBinId: target.id,
          quantity: (source?.onHand ?? 0) + 100,
        })
      ).rejects.toThrow();

      // Nothing half-moved — the whole transaction rolled back.
      const after = await binsForVariant(ctx(), f.variantId);
      expect(after.find((b) => b.binCode === 'D-04')).toBeUndefined();
    });

    it('refuses a move across locations, because that is a transfer', async () => {
      const elsewhere = await createInventoryFixture(tenantId);
      await enableBinsForWarehouse(ctx(), elsewhere.warehouseId);
      const farBin = await createBin(ctx(), {
        warehouseId: elsewhere.warehouseId,
        code: 'Z-99',
        type: 'pick',
      });
      const source = (await binsForVariant(ctx(), f.variantId))[0];

      await expect(
        moveBetweenBins(ctx(), {
          variantId: f.variantId,
          fromBinId: source?.binId ?? '',
          toBinId: farBin.id,
          quantity: 1,
        })
        // Silently allowing it would leave the warehouse ledger untouched while
        // the stock physically moved buildings.
      ).rejects.toThrow(/different locations/i);
    });

    /* ── Refusals that protect the data ──────────────────────────────────── */

    it('refuses to archive a shelf that still holds stock', async () => {
      const holding = (await binsForVariant(ctx(), f.variantId)).find((b) => b.onHand > 0);
      await expect(archiveBin(ctx(), holding?.binId ?? '')).rejects.toThrow(/still holds/i);
    });

    it('refuses to archive a system shelf outright', async () => {
      const defaultBin = await withTenant(ctx(), (tx) =>
        tx.inventoryBin.findFirst({
          where: { warehouseId: f.warehouseId, isDefault: true },
          select: { id: true },
        })
      );
      // Matches on what the shelf IS, not on who set it up: the message named a
      // product until the brand sweep made it brand-neutral, and this assertion
      // was left behind pinning the old wording.
      await expect(archiveBin(ctx(), defaultBin?.id ?? '')).rejects.toThrow(
        /set up for you and cannot be removed/i
      );
    });
  });

  /* ── 4. Put-away suggestions ───────────────────────────────────────────── */

  describe('put-away suggestions', () => {
    it('leads with the declared home shelf, then shelves already holding it', async () => {
      const f = await createInventoryFixture(tenantId);
      await enableBinsForWarehouse(ctx(), f.warehouseId);
      const home = await createBin(ctx(), {
        warehouseId: f.warehouseId,
        code: 'H-01',
        type: 'pick',
      });
      const other = await createBin(ctx(), {
        warehouseId: f.warehouseId,
        code: 'H-02',
        type: 'pick',
      });
      await receive(f, 7, other.id);
      await setVariantHomeBin(ctx(), f.variantId, home.id);

      const suggestions = await suggestPutAway(ctx(), {
        variantId: f.variantId,
        warehouseId: f.warehouseId,
      });
      expect(suggestions[0]).toMatchObject({ binId: home.id, reason: 'home_shelf' });
      expect(suggestions.map((s) => s.binId)).toContain(other.id);
      // Every suggestion carries a reason in words — advice a person can
      // disagree with, not an instruction they follow or override blindly.
      for (const s of suggestions) expect(s.explanation.length).toBeGreaterThan(0);
    });

    it('ignores a home shelf that has been turned into a quarantine shelf', async () => {
      const f = await createInventoryFixture(tenantId);
      await enableBinsForWarehouse(ctx(), f.warehouseId);
      const home = await createBin(ctx(), {
        warehouseId: f.warehouseId,
        code: 'Q-01',
        type: 'quarantine',
      });
      await setVariantHomeBin(ctx(), f.variantId, home.id);

      // Availability reads the LOCATION total, so stock seated on a not-for-sale
      // shelf would go on being sold while a picker sent to fetch it finds a box
      // marked "on hold".
      const suggestions = await suggestPutAway(ctx(), {
        variantId: f.variantId,
        warehouseId: f.warehouseId,
      });
      expect(suggestions.find((s) => s.reason === 'home_shelf')).toBeUndefined();
    });

    it('always returns somewhere, so a put-away screen is never a dead end', async () => {
      const f = await createInventoryFixture(tenantId);
      await enableBinsForWarehouse(ctx(), f.warehouseId);
      const suggestions = await suggestPutAway(ctx(), {
        variantId: f.variantId,
        warehouseId: f.warehouseId,
      });
      expect(suggestions.length).toBeGreaterThan(0);
      // Stock recorded imprecisely is worth far more than stock not recorded.
      expect(suggestions[suggestions.length - 1]?.reason).toBe('default');
    });
  });
});
