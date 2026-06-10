'use client';

import * as React from 'react';
import { useSearchParams } from 'next/navigation';
import { Badge, Button, Heading, Stack, Text } from '@sparx/ui';
import { CheckCircle, CreditCard } from 'lucide-react';
import { completePaymentsAction, startStripeConnectAction } from '../_lib/actions';
import type { StepNav } from './onboarding-wizard';

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
      if (res.ok) {
        window.location.href = res.data.url;
      } else {
        setError(res.error);
      }
    });
  }

  function onFinish() {
    setError(null);
    startFinish(async () => {
      const res = await completePaymentsAction({ paymentsConnected: stripeConnected });
      if (res.ok) nav.onNext();
      else setError(res.error);
    });
  }

  return (
    <Stack gap={6}>
      <Stack gap={1}>
        <Heading level={3}>Connect payments</Heading>
        <Text variant="muted">
          Connect a processor to start taking orders. Your store can go live now and you can connect
          payments whenever you&apos;re ready — checkout simply stays off until then.
        </Text>
      </Stack>

      <div className="rounded-lg border border-[var(--color-border-default)] p-5">
        <Stack direction="row" align="center" justify="between" gap={3}>
          <Stack direction="row" align="center" gap={3}>
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--color-bg-subtle)]">
              {stripeConnected ? (
                <CheckCircle className="h-5 w-5 text-[var(--color-success-text)]" />
              ) : (
                <CreditCard className="h-5 w-5 text-[var(--color-text-secondary)]" />
              )}
            </span>
            <Stack gap={1}>
              <Stack direction="row" align="center" gap={2}>
                <Text weight="medium">Stripe</Text>
                {stripeConnected && (
                  <Badge color="success" variant="soft">
                    Connected
                  </Badge>
                )}
              </Stack>
              <Text size="sm" variant="muted">
                {stripeConnected
                  ? 'Your Stripe account is connected. Checkout is enabled.'
                  : 'Cards, wallets, and bank debits via Stripe Connect.'}
              </Text>
            </Stack>
          </Stack>
          {!stripeConnected && (
            <Button
              variant="outline"
              onClick={onConnectStripe}
              disabled={pending}
              loading={connectPending}
            >
              Connect Stripe
            </Button>
          )}
        </Stack>
      </div>

      {error && (
        <Text size="sm" variant="danger" role="alert" aria-live="polite">
          {error}
        </Text>
      )}

      <Stack direction="row" justify="between">
        <Button variant="ghost" onClick={nav.onBack} disabled={pending || nav.navPending}>
          Back
        </Button>
        <Button color="module" onClick={onFinish} disabled={pending} loading={finishPending}>
          {stripeConnected ? 'Continue' : 'Skip for now'}
        </Button>
      </Stack>
    </Stack>
  );
}
