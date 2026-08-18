'use client';

import * as React from 'react';
import { Button, toast, useConfirm } from '@wizeworks/ui';
import { refundChargeAction } from '../actions';

// Full-refund a single platform charge, behind a danger confirm that names the
// amount (destructive/irreversible money action). Partial refunds are a follow-up.
export function RefundButton({
  tenantId,
  chargeId,
  amountLabel,
  disabled,
}: {
  tenantId: string;
  chargeId: string;
  amountLabel: string;
  disabled?: boolean;
}) {
  const confirm = useConfirm();
  const [pending, startTransition] = React.useTransition();

  async function onClick() {
    const ok = await confirm({
      title: `Refund ${amountLabel}?`,
      description:
        'This refunds the full charge on the platform Stripe account. Refunds can’t be undone.',
      confirmLabel: 'Issue refund',
      color: 'danger',
    });
    if (!ok) return;
    startTransition(async () => {
      const res = await refundChargeAction(tenantId, { chargeId });
      if (res.ok) toast.success(res.message);
      else toast.error(res.error);
    });
  }

  return (
    <Button
      type="button"
      variant="soft"
      color="danger"
      size="sm"
      onClick={() => void onClick()}
      disabled={pending || disabled}
      loading={pending}
    >
      Refund
    </Button>
  );
}
