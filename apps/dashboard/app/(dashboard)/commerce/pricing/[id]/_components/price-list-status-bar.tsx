'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';

import { Button } from '@wizeworks/silicaui-react';
import { useConfirm } from '@sparx/ui';

import { archivePriceListAction, updatePriceListAction } from '../../../pricing-actions';

export function PriceListStatusBar({
  priceListId,
  status,
}: {
  priceListId: string;
  status: string;
}) {
  const router = useRouter();
  const confirm = useConfirm();
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);

  function transition(next: 'active' | 'draft') {
    setError(null);
    startTransition(async () => {
      const result = await updatePriceListAction(priceListId, { status: next });
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      router.refresh();
    });
  }

  function onArchive() {
    setError(null);
    void (async () => {
      const ok = await confirm({
        title: 'Archive this price list?',
        description:
          'Archiving removes the price list from active use. Existing orders are unaffected but the list can no longer be applied to new orders.',
        confirmLabel: 'Archive',
        tone: 'warning',
      });
      if (!ok) return;
      startTransition(async () => {
        const result = await archivePriceListAction(priceListId);
        if (!result.ok) {
          setError(result.error.message);
          return;
        }
        router.push('/commerce/pricing');
      });
    })();
  }

  return (
    <div className="flex flex-row items-center gap-2">
      {error && <p className="text-danger text-xs">{error}</p>}
      {status === 'draft' && (
        <Button color="module" size="sm" disabled={pending} onClick={() => transition('active')}>
          Activate
        </Button>
      )}
      {status === 'active' && (
        <Button variant="outline" size="sm" disabled={pending} onClick={() => transition('draft')}>
          Move to draft
        </Button>
      )}
      {status !== 'archived' && (
        <Button variant="ghost" size="sm" disabled={pending} onClick={onArchive}>
          Archive
        </Button>
      )}
    </div>
  );
}
