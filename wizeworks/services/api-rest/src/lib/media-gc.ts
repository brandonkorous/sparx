// Media garbage-collection tick.
//
// Soft-deleted MediaAssets (deletedAt IS NOT NULL) older than MEDIA_GC_GRACE_MS
// (default 30 days) are candidates for hard deletion. The tick:
//   1. selects candidates cross-tenant,
//   2. for each, COUNTS its live references with `countOneAssetUsage` (the same
//      helper both delete guards use) and keeps it if anything still uses it,
//   3. otherwise deletes every variant object + the original from storage,
//   4. and removes the MediaVariant + MediaAsset rows in a per-tenant tx.
//
// Eligibility used to be `usage_count = 0`, a column nothing has ever written,
// so the one check between a live photo and permanent deletion always passed.
//
// Singleton across pods via Postgres advisory lock (key MEDIA_GC_LOCK_KEY) —
// same pattern as scheduled-publish + webhook-delivery so the three workers
// never contend.
//
// Interval default is daily; in dev we can run it more aggressively via
// MEDIA_GC_INTERVAL_MS to exercise the path.

import { ADVISORY_LOCKS, withAdvisoryTickLock } from '@wizeworks/db';
import type { FastifyBaseLogger } from 'fastify';
import { prisma, withTenant } from '@wizeworks/db';
import { countOneAssetUsage } from '@wizeworks/media';
import { getStorage } from './storage.js';

const MEDIA_GC_LOCK_KEY = ADVISORY_LOCKS.MEDIA_GC;
const DEFAULT_INTERVAL_MS = 24 * 60 * 60 * 1000; // daily
const DEFAULT_GRACE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const BATCH_LIMIT = 200;

interface EligibleAsset {
  id: string;
  tenant_id: string;
  key: string;
}

export interface MediaGcTickResult {
  acquired: boolean;
  removed: number;
  /** Past the grace period but still referenced, so left alone. */
  kept: number;
  errors: number;
}

export async function runMediaGcTick(
  logger: FastifyBaseLogger,
  graceMs: number = DEFAULT_GRACE_MS
): Promise<MediaGcTickResult> {
  const SKIPPED: MediaGcTickResult = { acquired: false, removed: 0, kept: 0, errors: 0 };
  return withAdvisoryTickLock(MEDIA_GC_LOCK_KEY, SKIPPED, async () => {
    const cutoff = new Date(Date.now() - graceMs);
    const storage = getStorage();
    let removed = 0;
    let kept = 0;
    let errors = 0;
    // Keyset-paged, because an asset kept for being in use stays a candidate:
    // a plain `LIMIT 200` would reselect the same 200 kept rows every tick and
    // starve everything behind them.
    let after = '00000000-0000-0000-0000-000000000000';

    while (removed < BATCH_LIMIT) {
      // Cross-tenant SELECT. Same approach as scheduled-publish: we'd rather
      // run a hand-rolled query than try to express "across all tenants" via
      // RLS-protected Prisma. The query is fully parameterized, and the row's
      // tenant_id is carried into the per-asset tx below where RLS applies.
      //
      // NO `usage_count = 0` here. That column is written by nothing, so it is
      // zero on every row and the test it made was a formality (issue 381).
      // Whether something still uses the asset is COUNTED per candidate below,
      // by the same helper both delete guards use.
      const candidates = await prisma.$queryRaw<EligibleAsset[]>`
        SELECT id, tenant_id, key
        FROM media_assets
        WHERE deleted_at IS NOT NULL
          AND deleted_at < ${cutoff}
          AND id > ${after}::uuid
        ORDER BY id
        LIMIT ${BATCH_LIMIT}
      `;
      if (candidates.length === 0) break;
      after = candidates[candidates.length - 1]!.id;

      for (const asset of candidates) {
        try {
          const outcome = await purgeIfUnused(asset, storage);
          if (outcome === 'removed') removed += 1;
          else {
            kept += 1;
            logger.warn(
              { assetId: asset.id, tenantId: asset.tenant_id },
              'media-gc: soft-deleted asset is still referenced; keeping it'
            );
          }
        } catch (err) {
          errors += 1;
          logger.error({ err, assetId: asset.id }, 'media-gc: failed to purge asset');
        }
      }
    }

    if (removed + kept + errors > 0) {
      logger.info({ removed, kept, errors, cutoff }, 'media-gc: tick finished');
    }
    return { acquired: true, removed, kept, errors };
  });
}

/**
 * Purge one soft-deleted asset, unless something still uses it.
 *
 * The count runs FIRST and in the asset's own tenant, before a single byte is
 * deleted: a reference that appeared after the soft delete (an import, a
 * restore, a write that raced the delete) means a live page would lose its
 * picture, and hard deletion cannot be taken back.
 */
async function purgeIfUnused(
  asset: EligibleAsset,
  storage: ReturnType<typeof getStorage>
): Promise<'removed' | 'kept'> {
  const found = await withTenant({ tenantId: asset.tenant_id }, async (tx) => {
    const usage = await countOneAssetUsage(tx, asset.id);
    if (usage.total > 0) return null;
    // Every variant too: variants live in the public bucket, the original in
    // the private one, and storage.deleteObject routes by key prefix.
    return tx.mediaVariant.findMany({
      where: { assetId: asset.id },
      select: { id: true, key: true },
    });
  });
  if (found === null) return 'kept';

  // Bytes first, rows second. If a storage delete fails the row stays and the
  // next tick retries; the usage count is taken again then, so a retry can
  // never purge something that became referenced in between.
  for (const v of found) {
    await storage.deleteObject(v.key);
  }
  await storage.deleteObject(asset.key);

  await withTenant({ tenantId: asset.tenant_id }, async (tx) => {
    // MediaVariant rows cascade-delete on MediaAsset deletion via the FK, but
    // emptying explicitly is more defensive and avoids surprising ON DELETE.
    await tx.mediaVariant.deleteMany({ where: { assetId: asset.id } });
    await tx.mediaAsset.delete({ where: { id: asset.id } });
  });
  return 'removed';
}

export function startMediaGcLoop(
  logger: FastifyBaseLogger,
  intervalMs: number = DEFAULT_INTERVAL_MS,
  graceMs: number = DEFAULT_GRACE_MS
): () => void {
  let stopped = false;
  let timer: NodeJS.Timeout | null = null;

  const tick = async () => {
    if (stopped) return;
    try {
      await runMediaGcTick(logger, graceMs);
    } catch (err) {
      logger.error({ err }, 'media-gc: tick threw, will retry next interval');
    }
    if (stopped) return;
    timer = setTimeout(() => void tick(), intervalMs);
  };

  // First tick fires after one full interval so a deploy doesn't burn its
  // startup budget on a table scan.
  timer = setTimeout(() => void tick(), intervalMs);
  logger.info({ intervalMs, graceMs }, 'media-gc: loop started');

  return () => {
    stopped = true;
    if (timer) clearTimeout(timer);
    logger.info('media-gc: loop stopped');
  };
}
