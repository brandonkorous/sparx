// DB-backed coverage for the external-sync funnel + P5b conflict/guard controls.
//
// P5 Tier C: `ingestFeed` matches feed rows to InventorySourceLinks, reconciles
// matches into the master level (corrective `sync` movement), queues unmatched SKUs,
// and records a run; the read side (health + queue) + map/ignore round it out.
// P5b: one-source-per-variant, UoM conversion, stale-link tracking, and the oversell
// safety buffer (netted into availability + the reserve deny check).
//
// Each linking test uses a FRESH variant — one-source-per-variant forbids a variant
// being claimed by two sources, so a shared variant would cross-contaminate.
// Requires `pnpm db:up`; skipped in CI per vitest.config.

import crypto from 'node:crypto';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { withTenant } from '@wizeworks/db';

import { getLevel, setSafetyBuffer } from '../../src/services/levels.js';
import { adjust } from '../../src/services/movements.js';
import { reserveOnTx } from '../../src/services/reservations.js';
import { computeAvailability } from '../../src/services/availability.js';
import { ingestFeed } from '../../src/services/feed-ingest.js';
import {
  createSourceLink,
  getSyncHealth,
  ignoreUnmappedSku,
  listSyncRuns,
  listUnmappedSkus,
  mapUnmappedSku,
} from '../../src/services/sync-runs.js';
import {
  recordAgentEnrollment,
  touchAgent,
  clearAgentEnrollment,
} from '../../src/services/agent-enrollment.js';
import { InventoryConflictError, InventoryOutOfStockError } from '../../src/errors.js';
import { createInventoryFixture, createTestTenant, dropTestTenant } from '../helpers.js';

describe('inventory external sync', () => {
  let tenantId: string;
  let warehouseId: string;
  const ctx = (): { tenantId: string } => ({ tenantId });

  beforeAll(async () => {
    tenantId = (await createTestTenant()).tenantId;
    warehouseId = (await createInventoryFixture(tenantId)).warehouseId;
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

  /** A fresh product + variant (its own, so the one-source guard stays isolated). */
  async function newVariant(): Promise<{ variantId: string; sku: string }> {
    const tag = crypto.randomBytes(3).toString('hex');
    return withTenant(ctx(), async (tx) => {
      const product = await tx.product.create({
        data: { tenantId, title: `Part ${tag}`, handle: `part-${tag}`, status: 'active' },
      });
      const v = await tx.productVariant.create({
        data: {
          tenantId,
          productId: product.id,
          sku: `SKU-${tag}`,
          priceCents: 1000,
          costCents: 500,
          currency: 'USD',
          isDefault: true,
        },
      });
      return { variantId: v.id, sku: v.sku };
    });
  }

  /** Raw link create (bypasses the conflict guard — for the funnel tests). */
  async function rawLink(sourceId: string, variantId: string, externalSku: string): Promise<void> {
    await withTenant(ctx(), (tx) =>
      tx.inventorySourceLink.create({
        data: { tenantId, sourceId, variantId, warehouseId, externalSku, externalLocation: null },
      })
    );
  }

  async function linkRow(sourceId: string, externalSku: string) {
    return withTenant(ctx(), (tx) =>
      tx.inventorySourceLink.findFirst({
        where: { tenantId, sourceId, externalSku },
        select: { isStale: true, lastSeenAt: true },
      })
    );
  }

  it('matches/changes/queues rows and records the run', async () => {
    const source = await newSource();
    const v = await newVariant();
    await rawLink(source.id, v.variantId, 'EXT-A');

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

    expect((await getLevel(ctx(), v.variantId, warehouseId))?.onHand).toBe(10);

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
    expect((await getLevel(ctx(), v.variantId, warehouseId))?.onHand).toBe(10);
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
    const v = await newVariant();

    // The external SKU equals our variant SKU → it should be suggested.
    await ingestFeed(ctx(), {
      source,
      rows: [{ externalSku: v.sku, externalLocation: null, quantity: 6 }],
      trigger: 'manual',
    });
    const pending = await listUnmappedSkus(ctx(), { sourceId: source.id });
    expect(pending.total).toBe(1);
    expect(pending.rows[0]?.suggestedVariantId).toBe(v.variantId);
    const unmappedId = pending.rows[0]!.id;

    const { linkId } = await mapUnmappedSku(ctx(), unmappedId, {
      variantId: v.variantId,
      warehouseId,
    });
    expect(linkId).toBeTruthy();
    expect((await listUnmappedSkus(ctx(), { sourceId: source.id })).total).toBe(0);

    // The next sync now matches the freshly-minted link → changed, no queue row.
    await ingestFeed(ctx(), {
      source,
      rows: [{ externalSku: v.sku, externalLocation: null, quantity: 8 }],
      trigger: 'manual',
    });
    expect((await getLevel(ctx(), v.variantId, warehouseId))?.onHand).toBe(8);
    expect((await listUnmappedSkus(ctx(), { sourceId: source.id })).total).toBe(0);
    const runs = await listSyncRuns(ctx(), { sourceId: source.id });
    expect(runs.rows[0]?.rowsChanged).toBe(1);
    expect(runs.rows[0]?.rowsUnmatched).toBe(0);
  });

  it('rolls up source health', async () => {
    const source = await newSource();
    const v = await newVariant();
    await rawLink(source.id, v.variantId, 'EXT-H');

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
    expect(health.staleLinkCount).toBe(0);
    expect(health.recentRuns.length).toBe(1);
  });

  it('enforces one source per variant', async () => {
    const v = await newVariant();
    const a = await newSource();
    await createSourceLink(ctx(), a.id, {
      variantId: v.variantId,
      warehouseId,
      externalSku: 'A-1',
      externalLocation: null,
    });

    const b = await newSource();
    await expect(
      createSourceLink(ctx(), b.id, {
        variantId: v.variantId,
        warehouseId,
        externalSku: 'B-1',
        externalLocation: null,
      })
    ).rejects.toBeInstanceOf(InventoryConflictError);
  });

  it('converts the feed UoM to each via the link multiplier', async () => {
    const source = await newSource();
    const v = await newVariant();
    await createSourceLink(ctx(), source.id, {
      variantId: v.variantId,
      warehouseId,
      externalSku: 'CASE-1',
      externalLocation: null,
      externalUom: 'case',
      unitsPerExternal: 12,
    });

    // The feed reports 5 cases → 60 each on hand.
    await ingestFeed(ctx(), {
      source,
      rows: [{ externalSku: 'CASE-1', externalLocation: null, quantity: 5 }],
      trigger: 'manual',
    });
    expect((await getLevel(ctx(), v.variantId, warehouseId))?.onHand).toBe(60);
  });

  it('flags a mapped link stale when a full snapshot stops reporting it', async () => {
    const source = await newSource();
    const v = await newVariant();
    await createSourceLink(ctx(), source.id, {
      variantId: v.variantId,
      warehouseId,
      externalSku: 'ST-1',
      externalLocation: null,
    });

    // Seen in the first full snapshot → fresh, not stale.
    await ingestFeed(ctx(), {
      source,
      rows: [{ externalSku: 'ST-1', externalLocation: null, quantity: 4 }],
      trigger: 'scheduled',
      fullSnapshot: true,
    });
    expect((await linkRow(source.id, 'ST-1'))?.isStale).toBe(false);
    expect((await linkRow(source.id, 'ST-1'))?.lastSeenAt).not.toBeNull();

    // Absent from the next full snapshot → flagged stale + surfaced in health.
    await ingestFeed(ctx(), {
      source,
      rows: [{ externalSku: 'OTHER', externalLocation: null, quantity: 1 }],
      trigger: 'scheduled',
      fullSnapshot: true,
    });
    expect((await linkRow(source.id, 'ST-1'))?.isStale).toBe(true);
    expect((await getSyncHealth(ctx(), source.id)).staleLinkCount).toBe(1);

    // Reappears → un-stale'd.
    await ingestFeed(ctx(), {
      source,
      rows: [{ externalSku: 'ST-1', externalLocation: null, quantity: 4 }],
      trigger: 'scheduled',
      fullSnapshot: true,
    });
    expect((await linkRow(source.id, 'ST-1'))?.isStale).toBe(false);
    expect((await getSyncHealth(ctx(), source.id)).staleLinkCount).toBe(0);
  });

  it('drops out-of-order rows by source timestamp (last-writer ordering)', async () => {
    const source = await newSource();
    const v = await newVariant();
    await createSourceLink(ctx(), source.id, {
      variantId: v.variantId,
      warehouseId,
      externalSku: 'TS-1',
      externalLocation: null,
    });
    const at = (iso: string, quantity: number) => ({
      externalSku: 'TS-1',
      externalLocation: null,
      quantity,
      sourceSyncedAt: iso,
    });
    const onHand = async () => (await getLevel(ctx(), v.variantId, warehouseId))?.onHand;

    // Apply the newer observation (Jun 12 → 20 units).
    const r2 = await ingestFeed(ctx(), {
      source,
      rows: [at('2026-06-12T00:00:00.000Z', 20)],
      trigger: 'api',
    });
    expect(r2.rowsChanged).toBe(1);
    expect(r2.rowsStale).toBe(0);
    expect(await onHand()).toBe(20);

    // An OLDER observation (Jun 10 → 5 units) is dropped — on-hand holds at 20.
    const r1 = await ingestFeed(ctx(), {
      source,
      rows: [at('2026-06-10T00:00:00.000Z', 5)],
      trigger: 'api',
    });
    expect(r1.rowsMatched).toBe(1);
    expect(r1.rowsChanged).toBe(0);
    expect(r1.rowsStale).toBe(1);
    expect(await onHand()).toBe(20);

    // A NEWER observation (Jun 14 → 7 units) wins.
    const r3 = await ingestFeed(ctx(), {
      source,
      rows: [at('2026-06-14T00:00:00.000Z', 7)],
      trigger: 'api',
    });
    expect(r3.rowsChanged).toBe(1);
    expect(r3.rowsStale).toBe(0);
    expect(await onHand()).toBe(7);

    // Newest-wins WITHIN one batch regardless of row order: the older row that
    // follows the newer one is dropped, not applied last.
    const r4 = await ingestFeed(ctx(), {
      source,
      rows: [at('2026-06-16T00:00:00.000Z', 30), at('2026-06-15T00:00:00.000Z', 99)],
      trigger: 'api',
    });
    expect(r4.rowsStale).toBe(1);
    expect(await onHand()).toBe(30);
  });

  it('records, refreshes online/offline, rotates, and clears bridge enrollment', async () => {
    const source = await newSource();

    // Pristine: not paired, offline.
    let health = await getSyncHealth(ctx(), source.id);
    expect(health.agentEnrolled).toBe(false);
    expect(health.agentOnline).toBe(false);

    // Enroll → recorded; a fresh pairing hasn't been seen yet → offline.
    const key1 = crypto.randomUUID();
    const first = await recordAgentEnrollment(ctx(), source.id, {
      apiKeyId: key1,
      apiKeyPrefix: 'sk_live_aaaa1111',
    });
    expect(first.previousApiKeyId).toBeNull();
    health = await getSyncHealth(ctx(), source.id);
    expect(health.agentEnrolled).toBe(true);
    expect(health.apiKeyPrefix).toBe('sk_live_aaaa1111');
    expect(health.agentOnline).toBe(false);

    // Heartbeat → online + version recorded.
    await touchAgent(ctx(), source.id, { agentVersion: '0.1.0' });
    health = await getSyncHealth(ctx(), source.id);
    expect(health.agentOnline).toBe(true);
    expect(health.agentVersion).toBe('0.1.0');
    expect(health.agentLastSeenAt).not.toBeNull();

    // A stale last-seen (older than the grace window) reads offline.
    await withTenant(ctx(), (tx) =>
      tx.inventorySource.update({
        where: { id: source.id },
        data: { agentLastSeenAt: new Date(Date.now() - 60 * 60 * 1000) },
      })
    );
    expect((await getSyncHealth(ctx(), source.id)).agentOnline).toBe(false);

    // Rotate → returns the previous key id to revoke + resets liveness.
    const key2 = crypto.randomUUID();
    const rotated = await recordAgentEnrollment(ctx(), source.id, {
      apiKeyId: key2,
      apiKeyPrefix: 'sk_live_bbbb2222',
    });
    expect(rotated.previousApiKeyId).toBe(key1);
    health = await getSyncHealth(ctx(), source.id);
    expect(health.apiKeyPrefix).toBe('sk_live_bbbb2222');
    expect(health.agentOnline).toBe(false);

    // Clear → returns the current key id; enrollment gone.
    const cleared = await clearAgentEnrollment(ctx(), source.id);
    expect(cleared.previousApiKeyId).toBe(key2);
    expect((await getSyncHealth(ctx(), source.id)).agentEnrolled).toBe(false);
  });

  it('nets the safety buffer into availability + the reserve deny check', async () => {
    // Pure rule: 10 on hand − 2 allocated − 3 buffer = 5 sellable.
    expect(
      computeAvailability([{ onHand: 10, allocated: 2, safetyBuffer: 3 }], 'deny', {
        inventoryActive: true,
      }).available
    ).toBe(5);
    // Buffer can drive a deny variant out of stock even with on-hand left.
    const guarded = computeAvailability([{ onHand: 3, allocated: 0, safetyBuffer: 3 }], 'deny', {
      inventoryActive: true,
    });
    expect(guarded.available).toBe(0);
    expect(guarded.inStock).toBe(false);

    // Reserve path: 10 on hand, 8 withheld → only 2 reservable under deny.
    const v = await newVariant();
    await adjust(ctx(), { variantId: v.variantId, warehouseId, delta: 10, reason: 'manual' });
    await setSafetyBuffer(ctx(), { variantId: v.variantId, warehouseId, safetyBuffer: 8 });

    await expect(
      withTenant(ctx(), (tx) =>
        reserveOnTx(tx, ctx(), {
          variantId: v.variantId,
          warehouseId,
          quantity: 5,
          holderType: 'cart',
          holderId: crypto.randomUUID(),
        })
      )
    ).rejects.toBeInstanceOf(InventoryOutOfStockError);

    // Two units sits within the buffer-netted available → succeeds.
    const res = await withTenant(ctx(), (tx) =>
      reserveOnTx(tx, ctx(), {
        variantId: v.variantId,
        warehouseId,
        quantity: 2,
        holderType: 'cart',
        holderId: crypto.randomUUID(),
      })
    );
    expect(res.reservationId).toBeTruthy();
  });
});
