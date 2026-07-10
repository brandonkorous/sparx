'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Trash2 } from 'lucide-react';

import { Button, Tooltip } from '@wizeworks/silicaui-react';

import { toast, useConfirm } from '@sparx/ui';

import { deleteShippingProfileAction } from '../../../../shipping-actions';

export function ProfileDeleteButton({ profileId }: { profileId: string }) {
  const router = useRouter();
  const confirm = useConfirm();
  const [pending, startTransition] = React.useTransition();

  function onDelete() {
    void (async () => {
      const ok = await confirm({
        title: 'Delete shipping profile?',
        description:
          'Products attached to this profile lose their carrier eligibility — they will fall back to the default profile.',
        confirmLabel: 'Delete profile',
        tone: 'danger',
      });
      if (!ok) return;
      startTransition(async () => {
        const result = await deleteShippingProfileAction(profileId);
        if (!result.ok) {
          toast.error(result.error.message);
          return;
        }
        router.push('/commerce/shipping');
      });
    })();
  }

  return (
    <Tooltip content="Delete">
      <Button variant="ghost" size="sm" aria-label="Delete" onClick={onDelete} disabled={pending}>
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
    </Tooltip>
  );
}
