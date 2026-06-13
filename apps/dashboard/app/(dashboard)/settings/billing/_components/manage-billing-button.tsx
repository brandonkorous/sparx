'use client';

// Opens the Stripe Customer Portal. The return URL is this page's own origin
// (computed client-side), so the portal sends the tenant straight back here after
// they manage payment / modules. Disabled-with-reason until billing is live.

import * as React from 'react';
import { Button, toast } from '@sparx/ui';

import { openBillingPortal } from '../actions';

export function ManageBillingButton({ disabled }: { disabled?: boolean }) {
  const [pending, startTransition] = React.useTransition();

  function onClick(): void {
    startTransition(async () => {
      const returnUrl = `${window.location.origin}/settings/billing`;
      const res = await openBillingPortal(returnUrl);
      if (res.ok) {
        window.location.href = res.url;
        return;
      }
      toast.error("Couldn't open billing", { description: res.error });
    });
  }

  return (
    <Button
      type="button"
      color="module"
      variant="solid"
      onClick={onClick}
      disabled={disabled === true || pending}
      loading={pending}
    >
      Manage billing
    </Button>
  );
}
