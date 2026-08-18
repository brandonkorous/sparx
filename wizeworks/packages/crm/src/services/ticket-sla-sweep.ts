// The SLA sweep (docs/144 §7.3) — the thing that notices before anyone does.
//
// A due date on a row is only worth having if something reads it while there is
// still time to act. This runs on a short cron and does exactly two things:
// marks requests that have crossed their warn mark or their due instant, and
// announces each ONCE on the CRM bus, where a tenant's own automations pick it
// up ("when a request is about to breach, notify the shift lead").
//
// IDEMPOTENT BY CONSTRUCTION. Every query carries `…WarnedAt: null` /
// `…BreachedAt: null`, and the update that stamps them is the same statement
// that selects — so a run that overlaps the previous one, or a pod that dies
// halfway and restarts, announces nothing twice. Marking with `updateMany` and
// then reading back which rows moved is deliberate: read-then-write would let
// two overlapping runs both see an unmarked ticket.
//
// A WARNING IS NOT SENT FOR A REQUEST ALREADY BREACHED. Telling somebody a
// deadline is approaching after it has passed is noise, and the four states a
// row can be in are checked in the order a person would: breached first.

import { withTenant } from '@wizeworks/db';
import type { Prisma } from '@wizeworks/db';

import { publishCrmEvent } from '../events';
import type { ServiceContext } from '../errors';

/** How many requests one pass will mark per category. A cap, not a limit on
 *  correctness: whatever is left is picked up by the next run minutes later,
 *  and an unbounded pass on a tenant with a backlog would hold a transaction
 *  open long enough to matter. */
const MAX_PER_RUN = 500;

export interface SweepResult {
  firstResponseWarned: number;
  firstResponseBreached: number;
  resolutionWarned: number;
  resolutionBreached: number;
}

const EMPTY: SweepResult = {
  firstResponseWarned: 0,
  firstResponseBreached: 0,
  resolutionWarned: 0,
  resolutionBreached: 0,
};

type Kind = 'first_response' | 'resolution';
type Level = 'warning' | 'breached';

interface Marked {
  id: string;
  number: number;
  subject: string;
  priority: string;
  assignedToUserId: string | null;
  customerId: string | null;
}

/**
 * Everything owed on a request nobody has answered yet.
 *
 * Shared by all four buckets: not deleted, not filed away, and the promise in
 * question not already settled. A closed request with an unmet resolution
 * promise was recorded as breached while it was still open — re-reporting it
 * now would tell somebody about a deadline they can no longer do anything
 * about.
 */
function stillOwed(kind: Kind): Prisma.TicketWhereInput {
  return {
    deletedAt: null,
    closedAt: null,
    ...(kind === 'first_response' ? { firstRespondedAt: null } : { resolvedAt: null }),
  };
}

/** The four (kind × level) queries, written out rather than assembled from
 *  computed field names — the assembled version needed a type assertion to
 *  compile, which is exactly the wrong thing to have between a cron job and a
 *  customer's support promise. */
function bucketWhere(kind: Kind, level: Level, now: Date): Prisma.TicketWhereInput {
  const owed = stillOwed(kind);
  if (kind === 'first_response') {
    return level === 'breached'
      ? { ...owed, firstResponseDueAt: { not: null, lte: now }, firstResponseBreachedAt: null }
      : {
          ...owed,
          firstResponseWarnAt: { not: null, lte: now },
          // Not yet past the due instant — see the note at the top of the file.
          firstResponseDueAt: { not: null, gt: now },
          firstResponseWarnedAt: null,
          firstResponseBreachedAt: null,
        };
  }
  return level === 'breached'
    ? { ...owed, resolutionDueAt: { not: null, lte: now }, resolutionBreachedAt: null }
    : {
        ...owed,
        resolutionWarnAt: { not: null, lte: now },
        resolutionDueAt: { not: null, gt: now },
        resolutionWarnedAt: null,
        resolutionBreachedAt: null,
      };
}

/** Which column records "we have already said this" for a bucket. */
function stampFor(kind: Kind, level: Level): keyof Prisma.TicketUpdateManyMutationInput {
  if (kind === 'first_response') {
    return level === 'warning' ? 'firstResponseWarnedAt' : 'firstResponseBreachedAt';
  }
  return level === 'warning' ? 'resolutionWarnedAt' : 'resolutionBreachedAt';
}

/**
 * Mark and collect one bucket.
 *
 * The two-step — select the ids, then stamp exactly those — is what keeps the
 * announcement and the flag in agreement. Stamping first and re-reading would
 * find rows a concurrent run had stamped; announcing first and stamping after
 * would double-announce if the process died between them.
 */
async function markBucket(
  ctx: ServiceContext,
  now: Date,
  kind: Kind,
  level: Level
): Promise<Marked[]> {
  const where = bucketWhere(kind, level, now);
  const stamp = stampFor(kind, level);

  return withTenant(ctx, async (tx) => {
    const candidates = await tx.ticket.findMany({
      where,
      select: {
        id: true,
        number: true,
        subject: true,
        priority: true,
        assignedToUserId: true,
        customerId: true,
      },
      orderBy:
        kind === 'first_response' ? { firstResponseDueAt: 'asc' } : { resolutionDueAt: 'asc' },
      take: MAX_PER_RUN,
    });
    if (candidates.length === 0) return [];

    const ids = candidates.map((c) => c.id);
    const { count } = await tx.ticket.updateMany({
      // The null guard is REPEATED here on purpose. Between the read above and
      // this write, a concurrent run may have stamped some of these; the guard
      // is what makes the loser of that race stamp nothing.
      where: { id: { in: ids }, [stamp]: null },
      data: { [stamp]: now },
    });
    // Everything stamped is announced. When the counts disagree a concurrent
    // run took some, and it is announcing those — so this run stays quiet about
    // the overlap rather than guessing which half it won.
    return count === ids.length ? candidates : [];
  });
}

async function announce(
  ctx: ServiceContext,
  rows: Marked[],
  kind: Kind,
  level: Level
): Promise<void> {
  for (const row of rows) {
    await publishCrmEvent({
      tenantId: ctx.tenantId,
      topic: level === 'warning' ? 'crm.ticket.sla.warning' : 'crm.ticket.sla.breached',
      payload: {
        ticketId: row.id,
        number: row.number,
        subject: row.subject,
        priority: row.priority,
        promise: kind,
        assignedToUserId: row.assignedToUserId,
        customerId: row.customerId,
      },
      // One announcement per (ticket, promise, level), for all time. A ticket
      // cannot breach the same promise twice — a re-prioritisation clears the
      // stamps and is a NEW promise, which is why the dedupe key does not need
      // a timestamp.
      dedupeKey: `crm.ticket.sla.${level}:${kind}:${row.id}`,
    });
  }
}

/**
 * One pass for one tenant.
 *
 * Never throws for business reasons: this runs unattended on a cron, and a
 * single tenant's bad calendar must not stop the sweep for everyone else. The
 * caller logs and moves on.
 */
export async function sweepTenant(
  ctx: ServiceContext,
  now: Date = new Date()
): Promise<SweepResult> {
  const result: SweepResult = { ...EMPTY };

  // Breaches before warnings, so a request that crossed both marks between two
  // runs is reported as breached rather than announced twice.
  const firstBreached = await markBucket(ctx, now, 'first_response', 'breached');
  await announce(ctx, firstBreached, 'first_response', 'breached');
  result.firstResponseBreached = firstBreached.length;

  const resolutionBreached = await markBucket(ctx, now, 'resolution', 'breached');
  await announce(ctx, resolutionBreached, 'resolution', 'breached');
  result.resolutionBreached = resolutionBreached.length;

  const firstWarned = await markBucket(ctx, now, 'first_response', 'warning');
  await announce(ctx, firstWarned, 'first_response', 'warning');
  result.firstResponseWarned = firstWarned.length;

  const resolutionWarned = await markBucket(ctx, now, 'resolution', 'warning');
  await announce(ctx, resolutionWarned, 'resolution', 'warning');
  result.resolutionWarned = resolutionWarned.length;

  return result;
}
