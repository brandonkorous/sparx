'use client';

import * as React from 'react';
import { useSearchParams } from 'next/navigation';
import { Badge, Button, Text, WizardStep } from '@sparx/ui';
import { CheckCircle, CreditCard, Info } from 'lucide-react';
import { completePaymentsAction, startStripeConnectAction } from '../_lib/actions';
import type { StepNav } from './onboarding-wizard';

// Step 5 — Payments (only shown when a selling module is on). Connects Stripe
// CONNECT — the account that RECEIVES money from customers — which is a different
// thing from the tenant's own Sparx subscription (the trial). The note spells
// that out so "connect Stripe" never reads as "enter a card to pay Sparx".
export function StepPayments({ nav }: { nav: StepNav }) {
  const searchParams = useSearchParams();
  const stripeConnected = searchParams.get('stripe_connected') === '1';
  const stripeError = searchParams.get('stripe_error');

  const [error, setError] = React.useState<string | null>(stripeError ?? null);
  const [connectPending, startConnect] = React.useTransition();
  const [finishPending, startFinish] = React.useTransition();

  const pending = connectPending || finishPending;

  function onConnectStripe() {
    setError(null);
    startConnect(async () => {
      const res = await startStripeConnectAction();
      if (res.ok) window.location.href = res.data.url;
      else setError(res.error);
    });
  }

  function onFinish() {
    setError(null);
    startFinish(async () => {
      const res = await completePaymentsAction({
        paymentsConnected: stripeConnected,
        next: nav.nextKey,
      });
      if (res.ok) nav.onNext();
      else setError(res.error);
    });
  }

  return (
    <WizardStep
      width="default"
      header={{
        title: 'Get paid',
        supporting:
          "Connect your Stripe account so your store can take customer payments. Your site can go live now and you can connect this whenever you're ready — checkout simply stays off until then.",
      }}
      actions={{
        onBack: nav.onBack,
        onNext: onFinish,
        nextLabel: stripeConnected ? 'Continue' : 'Skip for now',
        nextLoading: finishPending,
        nextDisabled: pending,
      }}
    >
      <div className="max-w-xl rounded-xl border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] p-6">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-[var(--color-bg-subtle)]">
              {stripeConnected ? (
                <CheckCircle className="h-5 w-5 text-[var(--color-success-text)]" />
              ) : (
                <CreditCard className="h-5 w-5 text-[var(--color-text-secondary)]" />
              )}
            </span>
            <div>
              <span className="flex items-center gap-2">
                <Text weight="medium">Stripe</Text>
                {stripeConnected && (
                  <Badge color="success" variant="soft" size="sm">
                    Connected
                  </Badge>
                )}
              </span>
              <Text size="sm" variant="muted">
                {stripeConnected
                  ? 'Your Stripe account is connected. Checkout is enabled.'
                  : 'Cards, wallets, and bank debits — paid out to your bank.'}
              </Text>
            </div>
          </div>
          {!stripeConnected && (
            <Button
              variant="outline"
              color="neutral"
              onClick={onConnectStripe}
              disabled={pending}
              loading={connectPending}
            >
              Connect Stripe
            </Button>
          )}
        </div>

        <div className="mt-4 flex items-start gap-2.5 border-t border-[var(--color-border-default)] pt-4">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-text-tertiary)]" />
          <Text size="xs" variant="muted">
            This is the account that{' '}
            <span className="font-medium text-[var(--color-text-secondary)]">
              receives money from your customers
            </span>{' '}
            — separate from your own Sparx subscription, which stays free for 14 days.
          </Text>
        </div>
      </div>

      {error && (
        <Text size="sm" variant="danger" role="alert" aria-live="polite" className="mt-4 block">
          {error}
        </Text>
      )}
    </WizardStep>
  );
}
