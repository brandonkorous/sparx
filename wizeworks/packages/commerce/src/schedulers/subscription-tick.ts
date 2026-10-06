// The subscription tick (docs/142 §6) — what makes recurring orders actually
// recur.
//
// Two things are due at any moment, and this collects both in one pass:
//   1. Occurrences — a subscription whose `next_occurrence_at` has arrived.
//   2. Retries     — a past_due subscription whose dunning `next_retry_at` has.
//
// They share a scheduler on purpose. Running two would mean two crons, two
// windows, and the possibility of a retry and a fresh renewal firing against the
// same card seconds apart.
//
// Runs every 15 minutes. Renewals are DATED, not urgent — a subscription due
// today does not care which quarter-hour it is billed in — so the cadence is set
// by how stale a "next charge" date is allowed to look, not by latency.

import { repeatStartService, subscriptionBilling, subscriptionService } from '../services';
import type { CollectionResult } from '../services/subscription-billing';
import { withTenant } from '@wizeworks/db';

export interface SubscriptionTickResult {
  tenantId: string;
  /** Renewals that came due this pass. */
  due: number;
  /** Dunning retries that came due this pass. */
  retries: number;
  charged: number;
  invoiced: number;
  /** Failed and scheduled for another attempt. */
  retryScheduled: number;
  /** Ladder exhausted or card dead — the subscription was paused/cancelled. */
  exhausted: number;
  /** Waiting on the customer to authenticate with their bank. */
  actionRequired: number;
  /** Card subscriptions with no usable saved card. Reported rather than failed:
   *  only the merchant can fix these, so running a dunning ladder would email
   *  the customer about someone else's problem. */
  unbillable: number;
  /**
   * Came due, and nothing happened to it.
   *
   * This counter used to not exist: `skipped` was the one outcome with no
   * bucket, so a pass where EVERY renewal did nothing reported `due: 12` and
   * twelve zeroes, with no errors — a perfectly healthy-looking tick over a
   * business that billed nobody. A count nobody keeps is an outcome nobody can
   * see. [[feedback_never_present_absence_as_measurement]]
   *
   * It is ordinary in small numbers (a concurrent tick got there first, an
   * order was paid between the two passes). It is a problem when it equals
   * `due`.
   */
  skipped: number;
  /** Paid checkouts whose repeat orders were started this pass (issue 739). */
  repeatsStarted: number;
  /** Paid checkouts still waiting for their card to be read; tried again next pass. */
  repeatsWaiting: number;
  /** Anything that threw. The tick continues; the subscription is picked up
   *  again next pass because its date is still in the past. */
  errors: { subscriptionId: string; message: string }[];
}

/** Per tenant, per pass. Keeps one large tenant from starving the sequential
 *  loop — leftovers are picked up 15 minutes later, because their
 *  `next_occurrence_at` is still behind now. */
const BATCH_LIMIT = 200;

export async function runSubscriptionTick(input: {
  tenantId: string;
  /** Override "now" — the internal route accepts it so an operator can dry-run
   *  a future date against a staging tenant. */
  asOf?: string;
  limit?: number;
}): Promise<SubscriptionTickResult> {
  const ctx = { tenantId: input.tenantId };
  const asOf = input.asOf ?? new Date().toISOString();
  const limit = input.limit ?? BATCH_LIMIT;

  const result: SubscriptionTickResult = {
    tenantId: input.tenantId,
    due: 0,
    retries: 0,
    charged: 0,
    invoiced: 0,
    retryScheduled: 0,
    exhausted: 0,
    actionRequired: 0,
    unbillable: 0,
    skipped: 0,
    repeatsStarted: 0,
    repeatsWaiting: 0,
    errors: [],
  };

  // Start the repeat orders paid checkouts asked for, BEFORE billing what is due:
  // a repeat order is never due on the pass that creates it (its first delivery
  // was the order itself), so the order does not matter for correctness, and
  // starting first means a shopper's repeat order is visible a pass sooner.
  //
  // A failure to FIND them is recorded and the pass goes on. It used to throw
  // out of the tick, which stopped every renewal for the tenant behind it: a
  // shop's existing repeat orders went unbilled because of a query about new
  // ones.
  let awaiting: string[] = [];
  try {
    awaiting = await repeatStartService.findOrdersAwaitingRepeat(ctx, limit);
  } catch (err) {
    result.errors.push({
      subscriptionId: 'repeat-start',
      message: err instanceof Error ? err.message : String(err),
    });
  }
  for (const orderId of awaiting) {
    try {
      const started = await repeatStartService.startForOrder(ctx, orderId);
      if (started.result === 'started') result.repeatsStarted += 1;
      if (started.result === 'waiting') result.repeatsWaiting += 1;
    } catch (err) {
      result.errors.push({
        subscriptionId: `order:${orderId}`,
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  const dueIds = await subscriptionService.findDueOccurrences(ctx, asOf, limit);
  result.due = dueIds.length;
  for (const id of dueIds) {
    // `asOf` goes all the way down. The selector above and the "is it due" test
    // inside have to read one clock, or an operator's dry-run date finds rows
    // here and the renewal refuses every one of them against the real one.
    await runOne(result, id, () => subscriptionBilling.runDueOccurrence(ctx, id, asOf));
  }

  const retryIds = await findDueRetries(ctx, asOf, limit);
  result.retries = retryIds.length;
  for (const id of retryIds) {
    await runOne(result, id, () => subscriptionBilling.runDueRetry(ctx, id));
  }

  return result;
}

/**
 * Past-due subscriptions whose newest dunning attempt says it is time to try
 * again.
 *
 * "Newest attempt" matters: an older attempt's `next_retry_at` is history, and
 * selecting on any row with a past date would re-charge on every pass forever.
 * So this reads the latest attempt per subscription and keeps only the ones
 * whose retry has actually arrived.
 */
async function findDueRetries(
  ctx: { tenantId: string },
  asOf: string,
  limit: number
): Promise<string[]> {
  return withTenant(ctx, async (tx) => {
    const pastDue = await tx.subscription.findMany({
      where: { status: 'past_due' },
      select: {
        id: true,
        dunningAttempts: {
          orderBy: { attemptedAt: 'desc' },
          take: 1,
          select: { nextRetryAt: true },
        },
      },
      take: limit,
    });

    const cutoff = new Date(asOf).getTime();
    return pastDue
      .filter((s) => {
        const next = s.dunningAttempts[0]?.nextRetryAt;
        return next != null && next.getTime() <= cutoff;
      })
      .map((s) => s.id);
  });
}

async function runOne(
  result: SubscriptionTickResult,
  subscriptionId: string,
  run: () => Promise<CollectionResult>
): Promise<void> {
  try {
    const outcome = await run();
    switch (outcome.outcome) {
      case 'charged':
        result.charged += 1;
        break;
      case 'invoiced':
        result.invoiced += 1;
        break;
      case 'retry_scheduled':
        result.retryScheduled += 1;
        break;
      case 'exhausted':
        result.exhausted += 1;
        break;
      case 'action_required':
        result.actionRequired += 1;
        break;
      case 'unbillable':
        result.unbillable += 1;
        break;
      case 'skipped':
        result.skipped += 1;
        break;
    }
  } catch (err) {
    // One bad subscription must not stop the rest of the tenant's billing.
    result.errors.push({
      subscriptionId,
      message: err instanceof Error ? err.message : String(err),
    });
  }
}
