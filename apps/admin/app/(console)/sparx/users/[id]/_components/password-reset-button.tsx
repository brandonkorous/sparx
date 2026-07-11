'use client';

// Trigger a Better Auth password-reset email for a staff user (gated `user:act`),
// via the dashboard reverse seam. Confirmed, since it emails the user directly.

import * as React from 'react';
import { Button, toast, useConfirm } from '@sparx/ui';
import { resetPasswordAction } from '../actions';

export function PasswordResetButton({
  userId,
  homeTenantId,
  email,
}: {
  userId: string;
  homeTenantId: string;
  email: string;
}) {
  const confirm = useConfirm();
  const [pending, startTransition] = React.useTransition();

  function run() {
    startTransition(async () => {
      const ok = await confirm({
        title: 'Send a password reset?',
        description: `Emails ${email} a secure link to set a new password. Their current password keeps working until they use it.`,
        confirmLabel: 'Send reset email',
        tone: 'module',
      });
      if (!ok) return;
      const res = await resetPasswordAction(userId, homeTenantId);
      if (res.ok && res.result.sent) toast.success(`Reset email sent to ${email}`);
      else if (res.ok) toast.error('Could not send the reset email. Try again shortly.');
      else toast.error(res.error);
    });
  }

  return (
    <Button type="button" variant="soft" onClick={run} disabled={pending} loading={pending}>
      Send password reset
    </Button>
  );
}
