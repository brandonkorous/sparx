// The one ingest funnel for every external stock feed (docs/100 P5 Tier C).
//
// A feed — a CSV pull (inventory-worker), an external push (`/sources/:id/push`),
// or a future scheduled poll — reports an ABSOLUTE on-hand per external SKU. This
// funnel is the single place that:
//
//   1. resolves each row to an InventorySourceLink (exact `sku|location`, falling
//      back to a `sku`-only link),
//   2. reconciles a matched row into the master `inventory_levels` through
//      `reconcileStockLevel` (a corrective `sync` movement, never a blind
//      overwrite — so onHand stays reconcilable to Σ(movements) and a concurrent
//      sale can't be lost),
//   3. queues a row that resolves to NO link in `inventory_unmapped_skus` (the
//      tenant-facing review queue — we never auto-create products), and
//   4. records the whole run in `inventory_sync_runs` with full bookkeeping so the
//      sync-health panel can answer "is this source healthy, and what did the last
//      sync do?".
//
// Both transports (worker + push endpoint) call this — one implementation, one
// funnel, one set of counters. The caller owns its own source load + paused
// short-circuit + event emission; the funnel owns matching, reconciliation, the
// queue, and the run row.

import { withTenant } from '@sparx/db';
import type { TxClient } from '@sparx/db';
import type { SyncTrigger } from '@sparx/commerce-schemas';

import type { ServiceContext } from '../errors';

import { reconcileStockLevel } from './sync';

export interface FeedRow {
  externalSku: string;
  externalLocation: string | null;
  quantity: number;
  /** Per-unit cost from the feed, when it carries one (moves the avg-cost basis). */
  unitCostCents?: number | null;
  /**
   * The source's OWN observation time for this row (ISO 8601), when it carries one
   * (Tier B/A feeds). Drives last-writer ordering: a row whose timestamp is older
   * than the newest already applied to its link is dropped as out-of-order. CSV
   * feeds omit it — ordering is skipped and last-write-in-batch wins as before.
   */
  sourceSyncedAt?: string | null;
}

export interface IngestFeedInput {
  /** The already-loaded, active source — the caller validated it exists / isn't paused. */
  source: { id: string; name: string };
  rows: FeedRow[];
  trigger: SyncTrigger;
  /**
   * True when `rows` is a FULL snapshot of the source's stock (a CSV export), so a
   * mapped link whose external SKU is ABSENT can be flagged stale (docs/28 §6). A
   * partial push (`/sources/:id/push`) is NOT a full snapshot — absence means
   * "not in this batch", not "gone" — so it never flags stale.
   */
  fullSnapshot?: boolean;
}

export interface IngestFeedResult {
  runId: string;
  status: 'success' | 'partial';
  rowsTotal: number;
  /** Rows that resolved to a link (= changed + unchanged + skipped). */
  rowsMatched: number;
  /** Matched rows whose on-hand differed from our mirror → a corrective movement. */
  rowsChanged: number;
  /** Matched rows already in agreement (no movement written). */
  rowsUnchanged: number;
  /** Rows with no link — queued for review. */
  rowsUnmatched: number;
  /** Matched rows whose reconcile threw (e.g. an archived warehouse). */
  rowsSkipped: number;
  /** Matched rows dropped as out-of-order by last-writer ordering (Tier B/A). */
  rowsStale: number;
}

interface LinkRecord {
  id: string;
  variantId: string;
  warehouseId: string;
  externalSku: string;
  externalLocation: string | null;
  unitsPerExternal: number;
  /** Newest source observation time already applied — last-writer floor (Tier B/A). */
  lastSourceSyncedAt: Date | null;
}

interface UnmatchedRow {
  externalSku: string;
  externalLocation: string | null;
  quantity: number;
}

/** Lookup key for a (sku, location) pair — a null location matches on sku alone. */
function feedKey(sku: string, location: string | null): string {
  return location !== null ? `${sku}|${location}` : sku;
}

export async function ingestFeed(
  ctx: ServiceContext,
  input: IngestFeedInput
): Promise<IngestFeedResult> {
  const { source, rows, trigger } = input;

  const linkMap = await loadLinkMap(ctx, source.id);

  let rowsMatched = 0;
  let rowsChanged = 0;
  let rowsUnchanged = 0;
  let rowsSkipped = 0;
  let rowsStale = 0;
  // Dedupe unmatched rows within a single feed: one queue bump per run, last
  // reported quantity wins.
  const unmatched = new Map<string, UnmatchedRow>();
  // Links a feed row resolved to this run — stamped fresh (and un-stale'd) below.
  const matchedLinkIds = new Set<string>();
  // Newest source-observation time applied per link this run — the last-writer
  // floor, seeded from the persisted value and advanced as we apply rows.
  const appliedSyncedAt = new Map<string, number>();

  for (const row of rows) {
    const link =
      linkMap.get(feedKey(row.externalSku, row.externalLocation)) ?? linkMap.get(row.externalSku);

    if (!link) {
      unmatched.set(feedKey(row.externalSku, row.externalLocation), {
        externalSku: row.externalSku,
        externalLocation: row.externalLocation,
        quantity: row.quantity,
      });
      continue;
    }

    // The SKU appeared in the feed → the mapping is not stale, even if we end up
    // dropping this particular value as out-of-order.
    rowsMatched++;
    matchedLinkIds.add(link.id);

    // Last-writer ordering (Tier B/A): drop a row whose source timestamp is not
    // newer than the value already applied to this link (persisted floor OR a
    // newer row earlier in this same batch). Rows without a timestamp skip the
    // guard entirely (CSV — last-write-in-batch wins as before).
    const rowTs = parseTimestamp(row.sourceSyncedAt);
    if (rowTs !== null) {
      const floor = Math.max(
        link.lastSourceSyncedAt?.getTime() ?? Number.NEGATIVE_INFINITY,
        appliedSyncedAt.get(link.id) ?? Number.NEGATIVE_INFINITY
      );
      if (rowTs <= floor) {
        rowsStale++;
        continue;
      }
    }

    try {
      // Each reconcile runs in its own tenant tx (it takes the level's row lock and
      // emits post-commit events). A redelivered/no-change row is `deduped`. The
      // feed quantity is converted from its UoM to "each" via the link multiplier.
      const result = await reconcileStockLevel(ctx, {
        variantId: link.variantId,
        warehouseId: link.warehouseId,
        onHand: row.quantity * link.unitsPerExternal,
        source: source.name,
        unitCostCents: row.unitCostCents ?? null,
      });
      if (result.deduped) rowsUnchanged++;
      else rowsChanged++;
      // Only advance the floor once the row actually applied.
      if (rowTs !== null) appliedSyncedAt.set(link.id, rowTs);
    } catch {
      // A single bad row must not fail the whole run — count it and keep going.
      rowsSkipped++;
    }
  }

  const rowsUnmatched = unmatched.size;
  const status: 'success' | 'partial' =
    rowsUnmatched > 0 || rowsSkipped > 0 ? 'partial' : 'success';

  // Persist the queue + the run + link freshness + bump the source in one tx.
  const runId = await withTenant(ctx, async (tx) => {
    const now = new Date();
    await upsertUnmapped(tx, ctx.tenantId, source.id, [...unmatched.values()]);
    await stampLinkFreshness(tx, ctx.tenantId, source.id, matchedLinkIds, input.fullSnapshot, now);
    await stampLinkSyncedAt(tx, appliedSyncedAt);
    const run = await tx.inventorySyncRun.create({
      data: {
        tenantId: ctx.tenantId,
        sourceId: source.id,
        trigger,
        status,
        rowsTotal: rows.length,
        rowsMatched,
        rowsChanged,
        rowsUnchanged,
        rowsUnmatched,
        rowsSkipped,
        rowsStale,
        finishedAt: now,
      },
      select: { id: true },
    });
    await tx.inventorySource.update({
      where: { id: source.id },
      data: { lastSyncAt: now, status: 'active', updatedAt: now },
    });
    return run.id;
  });

  return {
    runId,
    status,
    rowsTotal: rows.length,
    rowsMatched,
    rowsChanged,
    rowsUnchanged,
    rowsUnmatched,
    rowsSkipped,
    rowsStale,
  };
}

/** Parse a feed row's source timestamp to epoch ms; null when absent/unparseable. */
function parseTimestamp(value: string | null | undefined): number | null {
  if (!value) return null;
  const t = new Date(value).getTime();
  return Number.isNaN(t) ? null : t;
}

async function loadLinkMap(
  ctx: ServiceContext,
  sourceId: string
): Promise<Map<string, LinkRecord>> {
  const links = await withTenant(ctx, (tx) =>
    tx.inventorySourceLink.findMany({
      where: { tenantId: ctx.tenantId, sourceId, status: 'active' },
      select: {
        id: true,
        variantId: true,
        warehouseId: true,
        externalSku: true,
        externalLocation: true,
        unitsPerExternal: true,
        lastSourceSyncedAt: true,
      },
    })
  );
  const map = new Map<string, LinkRecord>();
  for (const link of links) map.set(feedKey(link.externalSku, link.externalLocation), link);
  return map;
}

/** Stamp `lastSeenAt` + clear `isStale` on every link a feed row matched. On a
 *  FULL snapshot, flag any active link that was seen before but is now absent as
 *  stale (its external part likely vanished) — a never-seen link is left alone. */
async function stampLinkFreshness(
  tx: TxClient,
  tenantId: string,
  sourceId: string,
  matchedLinkIds: Set<string>,
  fullSnapshot: boolean | undefined,
  now: Date
): Promise<void> {
  const matched = [...matchedLinkIds];
  if (matched.length > 0) {
    await tx.inventorySourceLink.updateMany({
      where: { id: { in: matched } },
      data: { lastSeenAt: now, isStale: false },
    });
  }
  if (fullSnapshot) {
    await tx.inventorySourceLink.updateMany({
      where: {
        tenantId,
        sourceId,
        status: 'active',
        lastSeenAt: { not: null },
        id: { notIn: matched },
      },
      data: { isStale: true },
    });
  }
}

/** Persist the newest applied source-observation time per link (last-writer floor),
 *  so the NEXT run drops anything older. Only links that actually applied a
 *  timestamped row appear here — individual updates, bounded by distinct links. */
async function stampLinkSyncedAt(
  tx: TxClient,
  appliedSyncedAt: Map<string, number>
): Promise<void> {
  for (const [linkId, epochMs] of appliedSyncedAt) {
    await tx.inventorySourceLink.update({
      where: { id: linkId },
      data: { lastSourceSyncedAt: new Date(epochMs) },
    });
  }
}

/** Find-or-bump each unmapped row. A row already `ignored` is bumped (quantity /
 *  lastSeen / seenCount) but NOT re-surfaced — the queue view filters `pending`. */
async function upsertUnmapped(
  tx: TxClient,
  tenantId: string,
  sourceId: string,
  rows: UnmatchedRow[]
): Promise<void> {
  if (rows.length === 0) return;

  const existing = await tx.inventoryUnmappedSku.findMany({
    where: { tenantId, sourceId },
    select: { id: true, externalSku: true, externalLocation: true },
  });
  const byKey = new Map(existing.map((u) => [feedKey(u.externalSku, u.externalLocation), u.id]));
  const now = new Date();

  for (const row of rows) {
    const id = byKey.get(feedKey(row.externalSku, row.externalLocation));
    if (id) {
      await tx.inventoryUnmappedSku.update({
        where: { id },
        data: { lastQuantity: row.quantity, lastSeenAt: now, seenCount: { increment: 1 } },
      });
    } else {
      await tx.inventoryUnmappedSku.create({
        data: {
          tenantId,
          sourceId,
          externalSku: row.externalSku,
          externalLocation: row.externalLocation,
          lastQuantity: row.quantity,
        },
      });
    }
  }
}
