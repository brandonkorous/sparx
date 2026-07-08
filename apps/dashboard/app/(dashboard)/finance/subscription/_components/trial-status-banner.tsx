// Trial / payment-lifecycle banner (docs/92 §C4, Phase 3). The Stripe portal can't
// proactively warn a tenant in-app, so this is the one custom billing UI we need:
// nudge before the trial lapses, and surface a failed payment before access pauses.
// Presentational + server-rendered off the billing state; the CTA reuses the portal
// button. Renders nothing in the steady state (active subscription, trial > 3 days).

import { AlertTriangle, Clock, CreditCard } from 'lucide-react';
import { Alert, AlertActions, AlertContent, AlertDescription, AlertTitle } from 'silicaui-react';

import type { BillingState } from '../actions';
import { ManageBillingButton } from './manage-billing-button';

function daysUntil(iso: string | null): number | null {
  if (!iso) return null;
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000);
}

export function TrialStatusBanner({
  state,
  canManage,
}: {
  state: BillingState;
  canManage: boolean;
}) {
  const status = state.subscriptionStatus;

  // 1) Payment problem — most urgent.
  if (status === 'past_due' || status === 'unpaid') {
    return (
      <Alert color="danger" variant="soft">
        <AlertTriangle />
        <AlertContent>
          <AlertTitle>Payment failed</AlertTitle>
          <AlertDescription>
            We couldn&rsquo;t charge your payment method. Update it to keep your modules active —
            access pauses if the balance stays unpaid.
          </AlertDescription>
        </AlertContent>
        {canManage ? (
          <AlertActions>
            <ManageBillingButton label="Update payment method" size="sm" />
          </AlertActions>
        ) : null}
      </Alert>
    );
  }

  // 2) Scheduled cancellation.
  if (state.cancelAtPeriodEnd && state.currentPeriodEnd) {
    const ends = new Date(state.currentPeriodEnd).toLocaleDateString();
    return (
      <Alert color="warning" variant="soft">
        <Clock />
        <AlertContent>
          <AlertTitle>Subscription ending</AlertTitle>
          <AlertDescription>
            Your subscription is set to cancel on {ends}. Reactivate any time before then to keep
            your modules.
          </AlertDescription>
        </AlertContent>
        {canManage ? (
          <AlertActions>
            <ManageBillingButton label="Manage subscription" size="sm" />
          </AlertActions>
        ) : null}
      </Alert>
    );
  }

  // 3) Trial ending within 3 days.
  if (status === 'trialing') {
    const left = daysUntil(state.trialEndsAt);
    if (left !== null && left <= 3) {
      const when = left <= 0 ? 'today' : left === 1 ? 'tomorrow' : `in ${left} days`;
      return (
        <Alert color="warning" variant="soft">
          <CreditCard />
          <AlertContent>
            <AlertTitle>Your free trial ends {when}</AlertTitle>
            <AlertDescription>
              Add a payment method now so your modules keep running when the trial ends. You
              won&rsquo;t be charged until then.
            </AlertDescription>
          </AlertContent>
          {canManage ? (
            <AlertActions>
              <ManageBillingButton label="Add payment method" size="sm" />
            </AlertActions>
          ) : null}
        </Alert>
      );
    }
  }

  return null;
}
