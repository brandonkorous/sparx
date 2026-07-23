// Social scheduled-drain tick (docs/133 §7, docs/134 Slice 5).
//
// Runs every `SOCIAL_SCHEDULED_INTERVAL_MS` (default 60s) from services/api-rest's
// bootstrap. Finds social posts with status='scheduled' whose `scheduledAt <= NOW()`,
// flips them to 'publishing', (re)arms their still-pending / previously-failed
// targets, and emits `social.post.due` on Pub/Sub so the social-worker drains the
// heavy platform I/O off this tick (mirrors how scheduled-publish.ts hands content
// publishes to webhook subscribers). Approval is enforced UPSTREAM: a post only ever
// reaches `scheduled` after it clears the approval gate (social-lifecycle.ts), so the
// drain never has to re-check it.
//
// Singleton across pods: a TRANSACTION-scoped Postgres advisory lock
// (SOCIAL_SCHEDULED_PUBLISH) via withAdvisoryTickLock; if another pod holds it the
// tick returns immediately. The lock auto-releases at transaction end.
//
// RLS: the cross-tenant SELECT uses the `find_due_social_posts(int)` SECURITY DEFINER
// function (migration 20270112000000), owned by sparx_owner and EXECUTE-granted only
// to sparx_app — the app role reads scheduled posts across tenants without itself
// gaining RLS bypass. Each per-post flip rides `withTenant({tenantId})` so the write
// still goes through the standard tenant_isolation policy.

import { ADVISORY_LOCKS, withAdvisoryTickLock } from '@sparx/db';
import type { FastifyBaseLogger } from 'fastify';
import { prisma, withTenant } from '@sparx/db';
import { publish } from '@sparx/api-core/pubsub';

const SOCIAL_SCHEDULED_LOCK_KEY = ADVISORY_LOCKS.SOCIAL_SCHEDULED_PUBLISH;
const DEFAULT_INTERVAL_MS = 60_000;

interface DuePost {
  id: string;
  tenant_id: string;
  scheduled_at: Date;
}

export interface TickResult {
  acquired: boolean;
  processed: number;
  errors: number;
}

// One-shot tick. Idempotent — running multiple times in quick succession is fine; the
// first run grabs whatever's due (flipping it off `scheduled`), subsequent runs find
// nothing.
export async function runSocialScheduledTick(logger: FastifyBaseLogger): Promise<TickResult> {
  const SKIPPED: TickResult = { acquired: false, processed: 0, errors: 0 };
  return withAdvisoryTickLock(SOCIAL_SCHEDULED_LOCK_KEY, SKIPPED, () => runLocked(logger));
}

async function runLocked(logger: FastifyBaseLogger): Promise<TickResult> {
  // SECURITY DEFINER function — runs as sparx_owner, returns the due-post projection
  // across all tenants without sparx_app gaining RLS bypass. See migration
  // 20270112000000.
  const due = await prisma.$queryRaw<DuePost[]>`
    SELECT id, tenant_id, scheduled_at
    FROM find_due_social_posts(100)
  `;

  if (due.length === 0) {
    return { acquired: true, processed: 0, errors: 0 };
  }

  logger.info({ count: due.length }, 'social-scheduled: draining due posts');

  let processed = 0;
  let errors = 0;

  for (const row of due) {
    try {
      // Re-check + flip under the tenant policy. A concurrent edit could have moved
      // the post off `scheduled` between the scan and here; if so, skip it.
      const flipped = await withTenant({ tenantId: row.tenant_id }, async (tx) => {
        const fresh = await tx.socialPost.findUnique({
          where: { id: row.id },
          select: { status: true },
        });
        if (fresh?.status !== 'scheduled') return false;

        // (Re)arm targets: pending stays armed, a previously-failed target retries.
        // Succeeded/skipped targets are left alone (the worker no-ops a target that
        // already published — the `postId:targetId` idempotency key guarantees it).
        await tx.socialPostTarget.updateMany({
          where: { postId: row.id, status: { in: ['pending', 'failed'] } },
          data: { status: 'pending', error: null },
        });
        await tx.socialPost.update({ where: { id: row.id }, data: { status: 'publishing' } });
        return true;
      });

      if (!flipped) continue;

      // Hand the drain to the social-worker (heavy platform I/O off this tick).
      await publish(logger, 'social.post.due', row.tenant_id, null, { postId: row.id });
      processed += 1;
    } catch (err) {
      errors += 1;
      logger.error({ err, postId: row.id }, 'social-scheduled: failed to drain post');
    }
  }

  return { acquired: true, processed, errors };
}

// Background loop. Started from src/index.ts at boot; returns a stop() function so
// graceful shutdown can cancel the pending tick. The loop drifts on long ticks (each
// tick runs to completion before the next is queued) — overlapping ticks would race
// for the advisory lock anyway.
export function startSocialScheduledLoop(
  logger: FastifyBaseLogger,
  intervalMs: number = DEFAULT_INTERVAL_MS
): () => void {
  let stopped = false;
  let timer: NodeJS.Timeout | null = null;

  const tick = async () => {
    if (stopped) return;
    try {
      await runSocialScheduledTick(logger);
    } catch (err) {
      logger.error({ err }, 'social-scheduled: tick threw — will retry next interval');
    }
    if (stopped) return;
    timer = setTimeout(() => void tick(), intervalMs);
  };

  // First tick fires after `intervalMs` so app startup isn't blocked on a table scan.
  timer = setTimeout(() => void tick(), intervalMs);
  logger.info({ intervalMs }, 'social-scheduled: loop started');

  return () => {
    stopped = true;
    if (timer) clearTimeout(timer);
    logger.info('social-scheduled: loop stopped');
  };
}
