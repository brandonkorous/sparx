'use client';

import * as React from 'react';
import { Badge, Button, FieldStatus } from '@wizeworks/silicaui-react';
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
      <div className="border-base-300 bg-base-100 rounded-xl border p-6">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="bg-base-200 flex h-11 w-11 items-center justify-center rounded-lg">
              {stripeConnected ? (
                <CheckCircle className="text-success h-5 w-5" />
              ) : (
                <CreditCard className="text-base-content/70 h-5 w-5" />
              )}
            </span>
            <div>
              <span className="flex items-center gap-2">
                <p className="font-medium">Stripe</p>
                {stripeConnected && (
                  <Badge color="success" variant="soft" size="sm">
                    Connected
                  </Badge>
                )}
              </span>
              <p className="text-base-content/70 text-sm">
                {stripeConnected
                  ? 'Your Stripe account is connected. Checkout is enabled.'
                  : 'Cards, wallets, and bank debits — paid out to your bank.'}
              </p>
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

        <div className="border-base-300 mt-4 flex items-start gap-2.5 border-t pt-4">
          <Info className="text-base-content/50 mt-0.5 h-4 w-4 shrink-0" />
          <p className="text-base-content/70 text-xs">
            This is the account that{' '}
            <span className="text-base-content/70 font-medium">
              receives money from your customers
            </span>{' '}
            — separate from your own sparx subscription, which stays free for 14 days.
          </p>
        </div>
      </div>

      {error && (
        <FieldStatus
          status="error"
          attached={false}
          role="alert"
          aria-live="polite"
          className="mt-4"
        >
          {error}
        </FieldStatus>
      )}
    </div>
  );
}
