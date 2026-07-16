'use client';

import * as React from 'react';
import { Banknote, CheckCircle2 } from 'lucide-react';
import { Badge, Button } from '@wizeworks/silicaui-react';

import { setupPayoutsAction } from '../actions';

// The payout-account CTA (docs/114 §B.4). When a Connect Express account is already
// linked, this shows a connected badge; otherwise a "Set up payouts" button that
// kicks off Connect onboarding. The onboarding endpoint is a later slice, so the
// action degrades to a calm "coming soon" notice instead of throwing.

export function PayoutSetup({ connected }: { connected: boolean }) {
  const [pending, startTransition] = React.useTransition();
  const [notice, setNotice] = React.useState<string | null>(null);

  function start() {
    setNotice(null);
    startTransition(async () => {
      const result = await setupPayoutsAction();
      if (result.ok && result.url) {
        window.location.href = result.url;
        return;
      }
      setNotice(result.message ?? 'Payout setup isn’t available yet.');
    });
  }

  if (connected) {
    return (
      <div className="flex flex-row items-center gap-2">
        <Badge color="success" variant="soft">
          <CheckCircle2 className="h-3.5 w-3.5" />
          Payout account connected
        </Badge>
        <p className="text-base-content text-sm">
          Approved commissions are paid to your connected account each month.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-base-content text-sm">
        Connect a Stripe payout account to receive your commissions. We pay out monthly once your
        approved balance clears your threshold.
      </p>
      <div>
        <Button
          type="button"
          color="module"
          onClick={start}
          loading={pending}
          disabled={pending}
          iconStart={<Banknote className="h-4 w-4" />}
        >
          Set up payouts
        </Button>
      </div>
      {notice && (
        <p className="text-base-content text-sm" role="status" aria-live="polite">
          {notice}
        </p>
      )}
    </div>
  );
}
