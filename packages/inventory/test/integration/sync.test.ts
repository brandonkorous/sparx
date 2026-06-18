// DB-backed coverage for the external-sync funnel (docs/100 P5 Tier C): `ingestFeed`
// matches feed rows to InventorySourceLinks, reconciles matches into the master
// level through a corrective `sync` movement, queues unmatched SKUs for review, and
// records a run with full bookkeeping. The sync-runs read side (health + queue) and
// the map/ignore queue actions round it out. Requires `pnpm db:up`; skipped in CI
// per vitest.config.

import crypto from 'node:crypto';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { withTenant } from '@sparx/db';

import { getLevel } from '../../src/services/levels.js';
import { ingestFeed } from '../../src/services/feed-ingest.js';
import {
  getSyncHealth,
  ignoreUnmappedSku,
  listSyncRuns,
  listUnmappedSkus,
  mapUnmappedSku,
} from '../../src/services/sync-runs.js';
import { createInventoryFixture, createTestTenant, dropTestTenant } from '../helpers.js';

describe('inventory external sync', () => {
  let tenantId: string;
  let variantId: string;
  let warehouseId: string;
  let variantSku: string;
  const ctx = (): { tenantId: string } => ({ tenantId });

  beforeAll(async () => {
    tenantId = (await createTestTenant()).tenantId;
    const fixture = await createInventoryFixture(tenantId);
    variantId = fixture.variantId;
    warehouseId = fixture.warehouseId;
    const variant = await withTenant(ctx(), (tx) =>
      tx.productVariant.findUniqueOrThrow({ where: { id: variantId }, select: { sku: true } })
    );
    variantSku = variant.sku;
  });
  afterAll(async () => {
    await dropTestTenant(tenantId);
  });

  /** A fresh CSV source. */
  async function newSource(): Promise<{ id: string; name: string }> {
    const tag = crypto.randomBytes(3).toString('hex');
    return withTenant(ctx(), (tx) =>
      tx.inventorySource.create({
        data: { tenantId, name: `Feed ${tag}`, type: 'csv', config: {} },
        select: { id: true, name: true },
      })
    );
  }

  async function link(
    sourceId: string,
    externalSku: string,
    externalLocation: string | null = null
  ): Promise<void> {
    await withTenant(ctx(), (tx) =>
      tx.inventorySourceLink.create({
        data: { tenantId, sourceId, variantId, warehouseId, externalSku, externalLocation },
      })
    );
  }

  it('matches/changes/queues rows and records the run', async () => {
    const source = await newSource();
    await link(source.id, 'EXT-A');

    const first = await ingestFeed(ctx(), {
      source,
      rows: [
        { externalSku: 'EXT-A', externalLocation: null, quantity: 10 },
        { externalSku: 'EXT-B', externalLocation: null, quantity: 5 },
        { externalSku: 'EXT-C', externalLocation: null, quantity: 3 },
      ],
      trigger: 'manual',
    });

    expect(first.rowsTotal).toBe(3);
    expect(first.rowsMatched).toBe(1);
    expect(first.rowsChanged).toBe(1);
    expect(first.rowsUnchanged).toBe(0);
    expect(first.rowsUnmatched).toBe(2);
    expect(first.rowsSkipped).toBe(0);
    expect(first.status).toBe('partial');

    const level = await getLevel(ctx(), variantId, warehouseId);
    expect(level?.onHand).toBe(10);

    const { rows: runs, total } = await listSyncRuns(ctx(), { sourceId: source.id });
    expect(total).toBe(1);
    expect(runs[0]?.rowsChanged).toBe(1);
    expect(runs[0]?.rowsUnmatched).toBe(2);

    const { rows: unmapped } = await listUnmappedSkus(ctx(), { sourceId: source.id });
    expect(unmapped.map((u) => u.externalSku).sort()).toEqual(['EXT-B', 'EXT-C']);

    // Re-running with the same on-hand is a no-op reconcile (deduped → unchanged).
    const second = await ingestFeed(ctx(), {
      source,
      rows: [{ externalSku: 'EXT-A', externalLocation: null, quantity: 10 }],
      trigger: 'scheduled',
    });
    expect(second.rowsChanged).toBe(0);
    expect(second.rowsUnchanged).toBe(1);
    expect(second.status).toBe('success');
    expect((await listSyncRuns(ctx(), { sourceId: source.id })).total).toBe(2);
    expect((await getLevel(ctx(), variantId, warehouseId))?.onHand).toBe(10);
  });

  it('bumps the queue across runs and keeps an ignored SKU suppressed', async () => {
    const source = await newSource();

    await ingestFeed(ctx(), {
      source,
      rows: [{ externalSku: 'EXT-X', externalLocation: null, quantity: 7 }],
      trigger: 'push',
    });
    let pending = await listUnmappedSkus(ctx(), { sourceId: source.id });
    expect(pending.total).toBe(1);
    expect(pending.rows[0]?.seenCount).toBe(1);
    expect(pending.rows[0]?.lastQuantity).toBe(7);
    const unmappedId = pending.rows[0]!.id;

    await ingestFeed(ctx(), {
      source,
      rows: [{ externalSku: 'EXT-X', externalLocation: null, quantity: 9 }],
      trigger: 'push',
    });
    pending = await listUnmappedSkus(ctx(), { sourceId: source.id });
    expect(pending.total).toBe(1);
    expect(pending.rows[0]?.seenCount).toBe(2);
    expect(pending.rows[0]?.lastQuantity).toBe(9);

    await ignoreUnmappedSku(ctx(), unmappedId);
    expect((await listUnmappedSkus(ctx(), { sourceId: source.id, status: 'pending' })).total).toBe(
      0
    );

    // A later run bumps the ignored row but does NOT re-surface it as pending.
    await ingestFeed(ctx(), {
      source,
      rows: [{ externalSku: 'EXT-X', externalLocation: null, quantity: 11 }],
      trigger: 'push',
    });
    expect((await listUnmappedSkus(ctx(), { sourceId: source.id, status: 'pending' })).total).toBe(
      0
    );
    const ignored = await listUnmappedSkus(ctx(), { sourceId: source.id, status: 'ignored' });
    expect(ignored.total).toBe(1);
    expect(ignored.rows[0]?.seenCount).toBe(3);
    expect(ignored.rows[0]?.lastQuantity).toBe(11);
  });

  it('suggests + maps an unmapped SKU, then the next sync matches the new link', async () => {
    const source = await newSource();

    // The external SKU equals our variant SKU → it should be suggested.
    await ingestFeed(ctx(), {
      source,
      rows: [{ externalSku: variantSku, externalLocation: null, quantity: 6 }],
      trigger: 'manual',
    });
    const pending = await listUnmappedSkus(ctx(), { sourceId: source.id });
    expect(pending.total).toBe(1);
    expect(pending.rows[0]?.suggestedVariantId).toBe(variantId);
    const unmappedId = pending.rows[0]!.id;

    const { linkId } = await mapUnmappedSku(ctx(), unmappedId, { variantId, warehouseId });
    expect(linkId).toBeTruthy();
    // Mapping clears the queue row.
    expect((await listUnmappedSkus(ctx(), { sourceId: source.id })).total).toBe(0);

    // The next sync now matches the freshly-minted link → changed, no queue row.
    await ingestFeed(ctx(), {
      source,
      rows: [{ externalSku: variantSku, externalLocation: null, quantity: 8 }],
      trigger: 'manual',
    });
    const level = await getLevel(ctx(), variantId, warehouseId);
    expect(level?.onHand).toBe(8);
    expect((await listUnmappedSkus(ctx(), { sourceId: source.id })).total).toBe(0);
    const runs = await listSyncRuns(ctx(), { sourceId: source.id });
    expect(runs.rows[0]?.rowsChanged).toBe(1);
    expect(runs.rows[0]?.rowsUnmatched).toBe(0);
  });

  it('rolls up source health', async () => {
    const source = await newSource();
    await link(source.id, 'EXT-H');

    await ingestFeed(ctx(), {
      source,
      rows: [
        { externalSku: 'EXT-H', externalLocation: null, quantity: 12 },
        { externalSku: 'EXT-MISS', externalLocation: null, quantity: 2 },
      ],
      trigger: 'manual',
    });

    const health = await getSyncHealth(ctx(), source.id);
    expect(health.status).toBe('active');
    expect(health.lastSyncAt).not.toBeNull();
    expect(health.latestRun?.rowsUnmatched).toBe(1);
    expect(health.pendingUnmappedCount).toBe(1);
    expect(health.activeLinkCount).toBe(1);
    expect(health.recentRuns.length).toBe(1);
  });
});
