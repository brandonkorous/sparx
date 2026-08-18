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

import { subscriptionBilling, subscriptionService } from '../services';
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
    errors: [],
  };

  const dueIds = await subscriptionService.findDueOccurrences(ctx, asOf, limit);
  result.due = dueIds.length;
  for (const id of dueIds) {
    await runOne(result, id, () => subscriptionBilling.runDueOccurrence(ctx, id));
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
