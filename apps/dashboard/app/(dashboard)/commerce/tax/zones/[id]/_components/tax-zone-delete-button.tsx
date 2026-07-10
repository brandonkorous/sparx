'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Trash2 } from 'lucide-react';

import { Button, Tooltip } from '@wizeworks/silicaui-react';

import { toast, useConfirm } from '@sparx/ui';

import { deleteTaxZoneAction } from '../../../../tax-actions';

export function TaxZoneDeleteButton({ zoneId }: { zoneId: string }) {
  const router = useRouter();
  const confirm = useConfirm();
  const [pending, startTransition] = React.useTransition();

  function onDelete() {
    void (async () => {
      const ok = await confirm({
        title: 'Delete tax zone?',
        description:
          'Removes the zone and all rates beneath it. Active checkouts in this jurisdiction will fall through to "no nexus" tax (zero).',
        confirmLabel: 'Delete zone',
        tone: 'danger',
      });
      if (!ok) return;
      startTransition(async () => {
        const result = await deleteTaxZoneAction(zoneId);
        if (!result.ok) {
          toast.error(result.error.message);
          return;
        }
        router.push('/commerce/tax');
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
