'use client';

// "Manage on Stripe" — opens the single-use Stripe-hosted Express dashboard where the
// merchant manages their bank account, payout schedule, and full payout history.
// sparx Pay is Stripe-hosted-first, so balance lives in the Finance hub (GAP A) but
// payout MANAGEMENT stays on Stripe's hosted surface (docs/94). Client-only: the link
// is minted on demand and we redirect to it.

import * as React from 'react';
import { ExternalLink } from 'lucide-react';
import { Button } from 'silicaui-react';

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
    <div className="flex flex-col gap-2">
      <div>
        <Button
          variant="outline"
          color="module"
          onClick={open}
          disabled={pending}
          loading={pending}
          iconStart={<ExternalLink className="h-4 w-4" />}
        >
          Manage on Stripe
        </Button>
      </div>
      {error && (
        <p className="text-danger text-sm" role="alert" aria-live="polite">
          {error}
        </p>
      )}
    </div>
  );
}
