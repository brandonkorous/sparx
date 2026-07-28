// The social module's background sweeps (docs/social-audit/01-roadmap.md).
//
// Four ticks, one shape. Each asks a SECURITY DEFINER function for work that has come
// due across every tenant, then hands each row to the social-worker as an event —
// because every one of these ends in a call to a platform API, and platform I/O has no
// business on an api-rest tick (the same split `social.post.due` already uses).
//
//   · health   — is this connected account still working? (docs/social-audit GAP 1)
//   · metrics  — a published post's numbers keep climbing; re-read them on a cadence
//                that decays with the post's age
//   · inbox    — pull new comments / mentions / reviews for each destination
//   · targets  — a destination carrying its OWN send time has come due, independently
//                of its siblings
//
// They share `runSweep` rather than existing as four near-identical files: the loop, the
// advisory lock, the per-row error isolation and the logging are the same every time —
// only the query and the event differ. The evergreen slot filler is deliberately NOT
// here: it composes posts rather than dispatching work, so it lives in its own file.
//
// RLS: each scan rides a `find_due_social_*` SECURITY DEFINER function owned by
// sparx_owner and EXECUTE-granted only to sparx_app, so the app role reads across
// tenants without gaining RLS bypass (migration 20270122000000). Every write these ticks
// then perform goes through `withTenant`, so it still passes tenant_isolation.

import { ADVISORY_LOCKS, prisma, withAdvisoryTickLock, withTenant } from '@sparx/db';
import type { FastifyBaseLogger } from 'fastify';
import { publish } from '@sparx/api-core/pubsub';
import type { EventType } from '@sparx/events';

/** Every sweep reports the same three numbers. `acquired: false` means another pod held
 *  the lock — not an error, just "someone else is doing it." */
export interface SweepResult {
  acquired: boolean;
  processed: number;
  errors: number;
}

const SKIPPED: SweepResult = { acquired: false, processed: 0, errors: 0 };

/** A row any sweep can dispatch: something with an id, belonging to a tenant. */
interface DueRow {
  id: string;
  tenant_id: string;
}

interface SweepSpec<Row extends DueRow> {
  /** For the log line — "social-health", "social-inbox". */
  name: string;
  lockKey: number;
  /** The cross-tenant scan. */
  scan: () => Promise<Row[]>;
  /** The event handed to the worker for one row. */
  event: EventType;
  /** That event's payload. */
  payload: (row: Row) => Record<string, unknown>;
  /** Optional per-row work under the tenant policy BEFORE the event goes out. Return
   *  false to skip the row (something changed between the scan and now). */
  claim?: (row: Row) => Promise<boolean>;
}

/**
 * The shared body of every sweep: take the lock, scan, dispatch each row, isolate
 * per-row failures so one bad tenant never stalls the rest.
 */
async function runSweep<Row extends DueRow>(
  logger: FastifyBaseLogger,
  spec: SweepSpec<Row>
): Promise<SweepResult> {
  return withAdvisoryTickLock(spec.lockKey, SKIPPED, async () => {
    const due = await spec.scan();
    if (due.length === 0) return { acquired: true, processed: 0, errors: 0 };

    logger.info({ count: due.length }, `${spec.name}: dispatching due work`);

    let processed = 0;
    let errors = 0;
    for (const row of due) {
      try {
        if (spec.claim && !(await spec.claim(row))) continue;
        await publish(logger, spec.event, row.tenant_id, null, spec.payload(row));
        processed += 1;
      } catch (err) {
        errors += 1;
        logger.error({ err, id: row.id }, `${spec.name}: failed to dispatch`);
      }
    }
    return { acquired: true, processed, errors };
  });
}

// ── 1. Connection health ─────────────────────────────────────────────────────────

interface DueConnection extends DueRow {
  platform: string;
  token_expires_at: Date | null;
  health_checked_at: Date | null;
}

/**
 * Find grants that want checking — never checked, stale, or inside the renewal window
 * ahead of expiry — and ask the worker to check each.
 *
 * The check itself has to talk to the platform (a refresh, and a liveness probe that is
 * the only way to catch a revoked grant), so it belongs in the worker. This tick just
 * decides WHO gets checked, and stamps nothing: `health_checked_at` moves when the
 * worker actually reaches a verdict, so a dispatch that never lands is retried.
 */
export async function runSocialHealthTick(logger: FastifyBaseLogger): Promise<SweepResult> {
  return runSweep<DueConnection>(logger, {
    name: 'social-health',
    lockKey: ADVISORY_LOCKS.SOCIAL_CONNECTION_HEALTH,
    event: 'social.connection.check',
    scan: () => prisma.$queryRaw<DueConnection[]>`
      SELECT id, tenant_id, platform, token_expires_at, health_checked_at
      FROM find_due_social_connections(200, 360, 4320)
    `,
    payload: (row) => ({ connectionId: row.id, platform: row.platform }),
  });
}

// ── 2. Post metrics ──────────────────────────────────────────────────────────────

interface DueMetricTarget extends DueRow {
  post_id: string;
}

/**
 * Re-read the numbers on posts that are still moving.
 *
 * Collecting only at publish time (and on a manual "Refresh numbers") froze every post's
 * figures minutes after it went out, which made Insights look like a report on a dead
 * business. The cadence lives in SQL, decaying with the post's age — hourly for a day,
 * six-hourly to a week, daily to thirty days, then never again, because a month-old
 * post's numbers have stopped moving.
 *
 * Dispatched per POST (deduped), not per destination: `social.metrics.collect` already
 * snapshots every target of a post in one pass, so a post with four destinations is one
 * message, not four.
 */
export async function runSocialMetricsTick(logger: FastifyBaseLogger): Promise<SweepResult> {
  return withAdvisoryTickLock(ADVISORY_LOCKS.SOCIAL_METRICS_SWEEP, SKIPPED, async () => {
    const due = await prisma.$queryRaw<DueMetricTarget[]>`
      SELECT id, tenant_id, post_id
      FROM find_due_social_metric_targets(200)
    `;
    if (due.length === 0) return { acquired: true, processed: 0, errors: 0 };

    // One message per post, however many of its destinations came due together.
    const byPost = new Map<string, string>();
    for (const row of due) byPost.set(row.post_id, row.tenant_id);

    logger.info({ posts: byPost.size, targets: due.length }, 'social-metrics: refreshing');

    let processed = 0;
    let errors = 0;
    for (const [postId, tenantId] of byPost) {
      try {
        await publish(logger, 'social.metrics.collect', tenantId, null, { postId });
        processed += 1;
      } catch (err) {
        errors += 1;
        logger.error({ err, postId }, 'social-metrics: failed to dispatch');
      }
    }
    return { acquired: true, processed, errors };
  });
}

// ── 3. Engagement inbox ──────────────────────────────────────────────────────────

interface DueInboxTarget extends DueRow {
  connection_id: string;
  platform: string;
  inbox_synced_at: Date | null;
}

/** Pull new inbound activity for each destination that is due a poll. */
export async function runSocialInboxTick(logger: FastifyBaseLogger): Promise<SweepResult> {
  return runSweep<DueInboxTarget>(logger, {
    name: 'social-inbox',
    lockKey: ADVISORY_LOCKS.SOCIAL_INBOX_SYNC,
    event: 'social.inbox.sync',
    scan: () => prisma.$queryRaw<DueInboxTarget[]>`
      SELECT id, tenant_id, connection_id, platform, inbox_synced_at
      FROM find_due_social_inbox_targets(200, 15)
    `,
    payload: (row) => ({ socialTargetId: row.id, platform: row.platform }),
  });
}

// ── 4. Per-destination scheduled drain ───────────────────────────────────────────

interface DuePostTarget extends DueRow {
  post_id: string;
}

/**
 * Fire a destination that carries its OWN send time.
 *
 * The post-level drain cannot do this: it flips a whole post to `publishing` at one
 * moment, and a post whose Facebook slot is 9am and whose LinkedIn slot is 5pm has two
 * moments. So a fan-out row with its own `scheduled_at` gets its own clock — it is armed
 * here and the worker's drain publishes only the destinations whose time has come.
 *
 * Approval is enforced upstream by the scan (a `pending_approval` post's destinations are
 * excluded), so nothing reaches a live account unreviewed by taking this path.
 */
export async function runSocialTargetScheduleTick(logger: FastifyBaseLogger): Promise<SweepResult> {
  return runSweep<DuePostTarget>(logger, {
    name: 'social-target-schedule',
    lockKey: ADVISORY_LOCKS.SOCIAL_TARGET_SCHEDULED_PUBLISH,
    event: 'social.post.due',
    scan: () => prisma.$queryRaw<DuePostTarget[]>`
      SELECT id, post_id, tenant_id, scheduled_at
      FROM find_due_social_post_targets(100)
    `,
    // Move the POST to `publishing` if it is not already, so the queue and calendar read
    // honestly while one destination is going out. The target itself stays `pending` —
    // the worker's drain is what claims it.
    claim: async (row) => {
      return withTenant({ tenantId: row.tenant_id }, async (tx) => {
        const post = await tx.socialPost.findUnique({
          where: { id: row.post_id },
          select: { status: true },
        });
        if (!post) return false;
        if (post.status === 'scheduled' || post.status === 'partially_published') {
          await tx.socialPost.update({
            where: { id: row.post_id },
            data: { status: 'publishing' },
          });
        }
        return true;
      });
    },
    payload: (row) => ({ postId: row.post_id }),
  });
}

// ── The loop ─────────────────────────────────────────────────────────────────────

/** How often each sweep runs. Health is slow on purpose — a grant's expiry moves in
 *  days, and the check costs a platform call per connection. The inbox is the one a
 *  person is waiting on, so it is the briskest. */
const INTERVALS = {
  health: 15 * 60_000,
  metrics: 10 * 60_000,
  inbox: 2 * 60_000,
  targets: 60_000,
} as const;

type SweepName = keyof typeof INTERVALS;

const RUNNERS: Record<SweepName, (logger: FastifyBaseLogger) => Promise<SweepResult>> = {
  health: runSocialHealthTick,
  metrics: runSocialMetricsTick,
  inbox: runSocialInboxTick,
  targets: runSocialTargetScheduleTick,
};

/**
 * Start all four loops. Returns one stop() that cancels every pending tick, so graceful
 * shutdown stays a single call at the boot site. Each loop drifts on a long tick (the
 * next is queued only after the previous returns) — overlapping ticks would contend for
 * the same advisory lock anyway.
 */
export function startSocialSweepLoops(logger: FastifyBaseLogger): () => void {
  let stopped = false;
  const timers: NodeJS.Timeout[] = [];

  for (const name of Object.keys(RUNNERS) as SweepName[]) {
    const intervalMs = INTERVALS[name];
    const run = RUNNERS[name];

    const tick = async () => {
      if (stopped) return;
      try {
        await run(logger);
      } catch (err) {
        logger.error({ err }, `social-sweep ${name}: tick threw — will retry next interval`);
      }
      if (stopped) return;
      timers.push(setTimeout(() => void tick(), intervalMs));
    };

    // First tick fires after one interval so boot isn't blocked on four table scans.
    timers.push(setTimeout(() => void tick(), intervalMs));
  }

  logger.info({ intervals: INTERVALS }, 'social sweeps: loops started');

  return () => {
    stopped = true;
    for (const timer of timers) clearTimeout(timer);
    logger.info('social sweeps: loops stopped');
  };
}
