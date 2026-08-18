// Pure lifecycle rules — which stage a tenant's deal belongs in, given where it
// is now and what just happened. No DB, no events: kept separate so the rules
// that decide "is this churn or a trial that never converted?" are unit-testable
// without a database.

import type { StageKey } from './pipeline';

/** Stripe/tenant subscription statuses we act on. Anything else is recorded as a
 *  note without moving the deal — an unknown status must never close a deal. */
export type SubscriptionStatus =
  | 'trialing'
  | 'active'
  | 'past_due'
  | 'unpaid'
  | 'paused'
  | 'canceled'
  | 'incomplete'
  | 'incomplete_expired'
  | (string & {});

/**
 * The stage a subscription status implies, or null to leave the deal where it is.
 *
 * Two rules do the real work:
 *
 *  - **Never move backwards.** A `trialing` webhook arriving after the tenant
 *    already activated (or paid) must not drag the deal back to Trial. Stripe
 *    re-sends subscription.updated for unrelated field changes, so this is the
 *    common case, not an edge case.
 *  - **Ending is only churn if they ever paid.** A cancel/pause from `paying`
 *    is churn (a retention problem); the same status from Trial or Activated is
 *    a trial that expired (an activation problem). The two live in different
 *    stages because they are different work.
 */
export function nextStageForSubscription(
  current: StageKey | null,
  status: SubscriptionStatus
): StageKey | null {
  switch (status) {
    case 'active':
      return current === 'paying' ? null : 'paying';

    case 'trialing':
    case 'incomplete':
      // Only meaningful before anything else has happened — a fresh trial.
      return current === null ? 'trial' : null;

    // Payment trouble is not a stage change: the tenant is still a customer and
    // the account is still live through the dunning window. The caller records a
    // note + tag instead so it's visible on the timeline.
    case 'past_due':
    case 'unpaid':
      return null;

    case 'paused':
    case 'canceled':
    case 'incomplete_expired':
      if (current === 'churned' || current === 'trial_expired') return null;
      return current === 'paying' ? 'churned' : 'trial_expired';

    default:
      return null;
  }
}

/** Turning a module on is the activation signal — but only out of Trial. A tenant
 *  already paying who enables another module has not regressed to "activated". */
export function nextStageForModuleActivation(current: StageKey | null): StageKey | null {
  return current === 'trial' || current === null ? 'activated' : null;
}

/** A status that means "they are having a billing problem" — worth a tag on the
 *  deal so it surfaces on the board without moving it. */
export function isPaymentTrouble(status: SubscriptionStatus): boolean {
  return status === 'past_due' || status === 'unpaid';
}

/** Human sentence for the timeline. These land on a CRM activity a person reads,
 *  so they say what happened in plain words — no status codes as prose. */
export function subscriptionActivityDescription(
  status: SubscriptionStatus,
  monthlyLabel: string | null
): string {
  switch (status) {
    case 'active':
      return monthlyLabel
        ? `Subscription active — ${monthlyLabel} per month.`
        : 'Subscription active.';
    case 'trialing':
      return 'Free trial started.';
    case 'past_due':
      return 'A payment failed. The account is past due.';
    case 'unpaid':
      return 'Payments are still failing. The account is unpaid.';
    case 'paused':
      return 'The subscription paused — the trial ended without a card on file.';
    case 'canceled':
      return 'The subscription was cancelled.';
    case 'incomplete':
      return 'Signed up but the first payment has not completed.';
    case 'incomplete_expired':
      return 'The first payment never completed and the subscription expired.';
    default:
      return `Subscription status changed to ${status}.`;
  }
}
