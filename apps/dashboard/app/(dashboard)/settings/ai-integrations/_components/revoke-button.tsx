'use client';

import * as React from 'react';
import { Trash2 } from 'lucide-react';
import { toast, useConfirm } from '@sparx/ui';
import { Button } from '@wizeworks/silicaui-react';

// Shared revoke affordance for the AI Integrations lists — a danger ghost icon
// button behind a confirm (destructive-actions-confirm). Reused for both API keys
// and OAuth connections; the caller binds the server action + the confirm copy.

type RevokeResult = { ok: true } | { ok: false; error: { message: string } };

export function RevokeButton({
  action,
  ariaLabel,
  confirmTitle,
  confirmDescription,
  confirmLabel = 'Revoke',
}: {
  action: () => Promise<RevokeResult>;
  ariaLabel: string;
  confirmTitle: string;
  confirmDescription: string;
  confirmLabel?: string;
}) {
  const confirm = useConfirm();
  const [pending, startTransition] = React.useTransition();

  async function onClick() {
    const ok = await confirm({
      title: confirmTitle,
      description: confirmDescription,
      confirmLabel,
      tone: 'danger',
    });
    if (!ok) return;
    startTransition(async () => {
      const res = await action();
      if (!res.ok) toast.error(res.error.message);
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
      aria-label={ariaLabel}
    >
      <Trash2 className="h-3.5 w-3.5" />
    </Button>
  );
}
