'use client';

import * as React from 'react';
import { Trash2 } from 'lucide-react';
import { Button, toast, useConfirm } from '@sparx/ui';
import { deleteCouponAction } from '../actions';

// Delete a platform coupon, behind a danger confirm (destructive-actions-confirm).
export function CouponDeleteButton({ couponId, label }: { couponId: string; label: string }) {
  const confirm = useConfirm();
  const [pending, startTransition] = React.useTransition();

  async function onClick() {
    const ok = await confirm({
      title: 'Delete coupon?',
      description: `“${label}” will be removed from Stripe. Existing redemptions are unaffected, but it can no longer be applied.`,
      confirmLabel: 'Delete coupon',
      color: 'danger',
    });
    if (!ok) return;
    startTransition(async () => {
      const res = await deleteCouponAction(couponId);
      if (!res.ok) toast.error(res.error);
      else toast.success('Coupon deleted.');
    });
  }

  return (
    <Button
      type="button"
      variant="ghost"
      color="danger"
      size="sm"
      onClick={() => void onClick()}
      disabled={pending}
      loading={pending}
      aria-label={`Delete coupon ${label}`}
    >
      <Trash2 className="h-3.5 w-3.5" />
    </Button>
  );
}
