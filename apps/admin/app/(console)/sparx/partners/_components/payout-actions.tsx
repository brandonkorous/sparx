'use client';

import * as React from 'react';
import { Button, Stack, toast, useConfirm } from '@sparx/ui';
import { formatMoneyCents } from '@/lib/format';
import { approveCommissionsAction, runPayoutsAction } from '../actions';

// The two platform-wide money actions (docs/114 §B.4), gated `partner:act`.
// "Approve pending commissions" promotes eligible commissions past their clawback
// window; "Run monthly payouts" transfers each active partner's approved balance
// (≥ their threshold) via Stripe Connect. Both confirmed; both surface the batch
// result. They no-op safely when platform Stripe isn't configured (the run throws
// a clear error the toast shows).
export function PayoutActions() {
  const confirm = useConfirm();
  const [pending, startTransition] = React.useTransition();

  function approve() {
    startTransition(async () => {
      const ok = await confirm({
        title: 'Approve pending commissions?',
        description:
          'Promotes every partner commission whose clawback window has passed to “approved”, making it eligible for the next payout run. Safe to run anytime.',
        confirmLabel: 'Approve commissions',
        color: 'module',
      });
      if (!ok) return;
      const res = await approveCommissionsAction();
      if (res.ok) toast.success(`${res.data.approved} commission(s) approved.`);
      else toast.error(res.error);
    });
  }

  function run() {
    startTransition(async () => {
      const ok = await confirm({
        title: 'Run the monthly payout batch?',
        description:
          'Transfers each active partner’s approved commission balance (at or above their payout threshold) to their connected Stripe account. Partners below threshold or without a connected account are skipped.',
        confirmLabel: 'Run payouts',
        color: 'warning',
      });
      if (!ok) return;
      const res = await runPayoutsAction();
      if (res.ok) {
        toast.success(
          `Paid ${res.data.partnersPaid} partner(s) — ${formatMoneyCents(res.data.totalCents)} total. ${res.data.skipped} skipped.`
        );
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <Stack direction="row" gap={2} className="flex-wrap">
      <Button type="button" variant="soft" onClick={approve} disabled={pending}>
        Approve pending commissions
      </Button>
      <Button type="button" color="primary" onClick={run} disabled={pending} loading={pending}>
        Run monthly payouts
      </Button>
    </Stack>
  );
}
