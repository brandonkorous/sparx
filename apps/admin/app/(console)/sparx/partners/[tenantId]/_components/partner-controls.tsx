'use client';

import * as React from 'react';
import { Button, Label, NativeSelect, Stack, toast, useConfirm } from '@sparx/ui';
import type { OperatorPartnerTier } from '@sparx/operator';
import { tierLabel } from '@/lib/partners';
import { setPartnerStatusAction, setPartnerTierAction } from '../../actions';

const TIERS: OperatorPartnerTier[] = ['informal', 'registered', 'certified'];

// Operator controls on a partner's detail (gated `partner:act`): change the tier
// (immediate save) and suspend / reinstate (confirmed). Suspending drops the
// partner from the active roster; the detail page stays reachable by tenant id.
export function PartnerControls({
  tenantId,
  displayName,
  tier,
  status,
}: {
  tenantId: string;
  displayName: string;
  tier: OperatorPartnerTier;
  status: string;
}) {
  const confirm = useConfirm();
  const [selTier, setSelTier] = React.useState<OperatorPartnerTier>(tier);
  const [pending, startTransition] = React.useTransition();
  const suspended = status === 'suspended';

  React.useEffect(() => setSelTier(tier), [tier]);

  function saveTier() {
    if (selTier === tier) return;
    startTransition(async () => {
      const res = await setPartnerTierAction(tenantId, selTier);
      if (res.ok) toast.success(`${displayName} set to ${tierLabel(selTier)}`);
      else toast.error(res.error);
    });
  }

  function toggleStatus() {
    startTransition(async () => {
      const ok = await confirm({
        title: suspended ? `Reinstate ${displayName}?` : `Suspend ${displayName}?`,
        description: suspended
          ? `Reactivates the partner — they can host bootcamps, earn commissions, and appear in the public directory again.`
          : `Suspends the partner: they stop earning commissions and drop from the public directory and this roster. Their ledger is kept. Reinstate from this page.`,
        confirmLabel: suspended ? 'Reinstate' : 'Suspend',
        tone: suspended ? 'module' : 'danger',
      });
      if (!ok) return;
      const res = await setPartnerStatusAction(tenantId, suspended ? 'active' : 'suspended');
      if (res.ok)
        toast.success(suspended ? `${displayName} reinstated` : `${displayName} suspended`);
      else toast.error(res.error);
    });
  }

  return (
    <Stack direction="row" gap={3} align="end" className="flex-wrap">
      <Stack gap={1}>
        <Label htmlFor="partner-tier">Tier</Label>
        <NativeSelect
          id="partner-tier"
          value={selTier}
          onChange={(e) => setSelTier(e.target.value as OperatorPartnerTier)}
        >
          {TIERS.map((t) => (
            <option key={t} value={t}>
              {tierLabel(t)}
            </option>
          ))}
        </NativeSelect>
      </Stack>
      <Button
        type="button"
        color="primary"
        onClick={saveTier}
        disabled={pending || selTier === tier}
      >
        Save tier
      </Button>
      <Button
        type="button"
        color={suspended ? 'primary' : 'danger'}
        variant="soft"
        onClick={toggleStatus}
        disabled={pending}
      >
        {suspended ? 'Reinstate' : 'Suspend'}
      </Button>
    </Stack>
  );
}
