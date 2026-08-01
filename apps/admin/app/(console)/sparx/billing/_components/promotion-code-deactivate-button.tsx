'use client';

import * as React from 'react';
import { Ban } from 'lucide-react';
import { Button, toast, useConfirm } from '@sparx/ui';
import { deactivatePromotionCodeAction } from '../actions';

// Deactivate a promotion code, behind a confirm (destructive-actions-confirm).
// Stripe codes can't be deleted or reactivated — turning it off is permanent.
export function PromotionCodeDeactivateButton({ id, code }: { id: string; code: string }) {
  const confirm = useConfirm();
  const [pending, startTransition] = React.useTransition();

  async function onClick() {
    const ok = await confirm({
      title: 'Turn off this code?',
      description: `“${code}” will stop working immediately and can’t be turned back on. Existing redemptions are unaffected.`,
      confirmLabel: 'Turn off code',
      color: 'danger',
    });
    if (!ok) return;
    startTransition(async () => {
      const res = await deactivatePromotionCodeAction(id);
      if (!res.ok) toast.error(res.error);
      else toast.success('Promotion code turned off.');
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
      aria-label={`Turn off code ${code}`}
    >
      <Ban className="h-3.5 w-3.5" />
    </Button>
  );
}
