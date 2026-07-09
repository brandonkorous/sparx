'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Trash2 } from 'lucide-react';

import { Button } from '@wizeworks/silicaui-react';

import { useConfirm } from '@sparx/ui';

import { deleteTaxRateAction } from '../../../../tax-actions';

export function TaxRateDeleteButton({ rateId, zoneId }: { rateId: string; zoneId: string }) {
  const router = useRouter();
  const confirm = useConfirm();
  const [pending, startTransition] = React.useTransition();

  function onDelete() {
    void (async () => {
      const ok = await confirm({
        title: 'Delete tax rate?',
        description: 'Customers in this jurisdiction will no longer be charged the rate.',
        confirmLabel: 'Delete',
        tone: 'danger',
      });
      if (!ok) return;
      startTransition(async () => {
        const result = await deleteTaxRateAction(rateId, zoneId);
        if (!result.ok) {
          console.error('Failed to delete rate', result.error);
          return;
        }
        router.refresh();
      });
    })();
  }

  return (
    <Button variant="ghost" size="sm" shape="square" onClick={onDelete} disabled={pending}>
      <Trash2 className="h-3.5 w-3.5" />
    </Button>
  );
}
