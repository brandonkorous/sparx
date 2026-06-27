'use client';

// "Manage on Stripe" — opens the single-use Stripe-hosted Express dashboard where the
// merchant manages their bank account, payout schedule, and full payout history.
// sparx Pay is Stripe-hosted-first, so balance lives in the Finance hub (GAP A) but
// payout MANAGEMENT stays on Stripe's hosted surface (docs/94). Client-only: the link
// is minted on demand and we redirect to it.

import * as React from 'react';
import { ExternalLink } from 'lucide-react';
import { Button, Stack, Text } from '@sparx/ui';

import { openSparxPayDashboard } from '../../payments/actions';

export function OpenDashboardButton() {
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);

  function open() {
    setError(null);
    startTransition(async () => {
      const res = await openSparxPayDashboard();
      if (res.ok) {
        window.location.href = res.url;
        return;
      }
      setError(res.error);
    });
  }

  return (
    <Stack gap={2}>
      <div>
        <Button
          variant="outline"
          color="module"
          onClick={open}
          disabled={pending}
          loading={pending}
        >
          <ExternalLink className="mr-1.5 h-4 w-4" />
          Manage on Stripe
        </Button>
      </div>
      {error && (
        <Text size="sm" variant="danger" role="alert" aria-live="polite">
          {error}
        </Text>
      )}
    </Stack>
  );
}
