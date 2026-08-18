'use client';

// The quiet trial/lifecycle chip in the toolbar (docs/17 §6 ladder, row 1). Always
// present while a tenant is trialing / in grace / suspended, so the countdown is
// glanceable without a banner; clicking opens the bill. Renders nothing for a
// paid-active or exempt tenant. Shares the ['finance','bill'] query key with the
// Finance surface + the banner, so all three dedupe to one fetch.

import { Button, Tooltip } from '@wizeworks/silicaui-react';
import { AlarmClock, TriangleAlert, CircleSlash } from 'lucide-react';

import { useWorkbench } from '../../lib/workbench/context';
import { useBill } from '../../surfaces/finance/bill-data';
import { billingChip } from '../../lib/billing/notice';

const PHASE_ICON = {
  trialing: AlarmClock,
  grace: TriangleAlert,
  suspended: CircleSlash,
} as const;

export function TrialChip() {
  const { data: bill } = useBill();
  const { controller } = useWorkbench();

  if (!bill) return null;
  const chip = billingChip(bill.billing);
  if (!chip) return null;

  const Icon = PHASE_ICON[bill.billing.phase as keyof typeof PHASE_ICON] ?? AlarmClock;
  const neutral = chip.tone === 'neutral';

  return (
    <Tooltip content="View your sparx bill">
      <Button
        color={neutral ? 'neutral' : chip.tone}
        variant={neutral ? 'ghost' : 'soft'}
        size="xs"
        className="gap-1.5"
        onClick={() => controller.open('finance.subscription')}
      >
        <Icon className="size-3.5" aria-hidden />
        {chip.label}
      </Button>
    </Tooltip>
  );
}
