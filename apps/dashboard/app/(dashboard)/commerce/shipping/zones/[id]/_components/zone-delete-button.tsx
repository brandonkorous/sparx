'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Trash2 } from 'lucide-react';

import { Button, Tooltip } from '@wizeworks/silicaui-react';

import { toast, useConfirm } from '@sparx/ui';

import { deleteShippingZoneAction } from '../../../../shipping-actions';

export function ZoneDeleteButton({ zoneId }: { zoneId: string }) {
  const router = useRouter();
  const confirm = useConfirm();
  const [pending, startTransition] = React.useTransition();

  function onDelete() {
    void (async () => {
      const ok = await confirm({
        title: 'Delete shipping zone?',
        description:
          'All rates attached to this zone are removed. Active checkouts will lose this rate option.',
        confirmLabel: 'Delete zone',
        tone: 'danger',
      });
      if (!ok) return;
      startTransition(async () => {
        const result = await deleteShippingZoneAction(zoneId);
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
