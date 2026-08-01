'use client';

import * as React from 'react';
import { Mail } from 'lucide-react';
import { Button, toast, useConfirm } from '@sparx/ui';
import { resendOrderConfirmationAction } from '../actions';

// Re-send an order confirmation. Confirmed first (it emails a real customer),
// then dispatches the support:act server action and toasts the outcome. A
// `sent:false` result (no template / no email / suppressed) is shown as a
// non-error notice, not a success.
export function ResendButton({
  tenantId,
  orderId,
  orderNumber,
  customerEmail,
}: {
  tenantId: string;
  orderId: string;
  orderNumber: string;
  customerEmail: string | null;
}) {
  const confirm = useConfirm();
  const [pending, startTransition] = React.useTransition();

  async function run() {
    const ok = await confirm({
      title: `Re-send confirmation for ${orderNumber}?`,
      description: customerEmail
        ? `The order-confirmation email will be re-sent to ${customerEmail} using the tenant’s own template.`
        : 'This order has no customer email on file, so nothing can be sent.',
      confirmLabel: 'Re-send email',
      color: 'module',
    });
    if (!ok) return;

    startTransition(async () => {
      const res = await resendOrderConfirmationAction(tenantId, orderId);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      if (res.result.sent) {
        toast.success(`Confirmation re-sent to ${res.result.to}.`);
      } else {
        toast.error(reasonLabel(res.result.reason));
      }
    });
  }

  return (
    <Button
      type="button"
      variant="soft"
      size="sm"
      onClick={run}
      disabled={pending || !customerEmail}
      loading={pending}
    >
      <Mail className="mr-1.5 h-3.5 w-3.5" />
      Re-send
    </Button>
  );
}

function reasonLabel(reason: string | null): string {
  switch (reason) {
    case 'no-email':
      return 'This order has no customer email on file.';
    case 'no-template':
      return 'This tenant has no published order-confirmation email yet.';
    case 'compliance':
      return 'The send was withheld by the compliance gate.';
    default:
      return 'The confirmation could not be sent.';
  }
}
