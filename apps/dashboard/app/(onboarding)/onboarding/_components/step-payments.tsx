'use client';

import * as React from 'react';
import { Badge, Button, Text } from '@sparx/ui';
import { CheckCircle, CreditCard, Info } from 'lucide-react';
import { startStripeConnectAction } from '../_lib/actions';
import type { WizardResult } from '../_lib/types';

// Step 5 — Payments (work pane). Connects Stripe CONNECT — the account that
// RECEIVES customer money — which the note makes clear is separate from the
// tenant's own sparx subscription. Continue/Skip lives in the setup card; this
// body owns the Connect action (a redirect to Stripe OAuth).
//
// `connectAction` is the server action that mints the OAuth URL. The classic
// wizard uses the default (returns to /onboarding); the story flow passes its own
// variant that marks the flow so the shared callback returns to /story instead.
export function StepPayments({
  stripeConnected,
  connectAction = startStripeConnectAction,
}: {
  stripeConnected: boolean;
  connectAction?: () => Promise<WizardResult<{ url: string }>>;
}) {
  const [error, setError] = React.useState<string | null>(null);
  const [connecting, startConnect] = React.useTransition();

  function onConnectStripe() {
    setError(null);
    startConnect(async () => {
      const res = await connectAction();
      if (res.ok) window.location.href = res.data.url;
      else setError(res.error);
    });
  }

  return (
    <div className="max-w-xl">
      <div className="rounded-xl border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] p-6">
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
              disabled={connecting}
              loading={connecting}
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
            — separate from your own sparx subscription, which stays free for 14 days.
          </Text>
        </div>
      </div>

      {error && (
        <Text size="sm" variant="danger" role="alert" aria-live="polite" className="mt-4 block">
          {error}
        </Text>
      )}
    </div>
  );
}
