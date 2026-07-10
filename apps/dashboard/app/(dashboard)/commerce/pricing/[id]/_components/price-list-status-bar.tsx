'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Archive } from 'lucide-react';

import { Button, Tooltip } from '@wizeworks/silicaui-react';
import { toast, useConfirm } from '@sparx/ui';

import { archivePriceListAction, updatePriceListAction } from '../../../pricing-actions';

// Lifecycle controls for a price list, teleported into the detail frame's
// header (drawer/modal chrome or the full-page shell) via the shared header
// slot — parity with TemplateStatusBar. Errors surface as a toast: the
// header bar has no room for inline error text.
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

  function transition(next: 'active' | 'draft') {
    startTransition(async () => {
      const result = await updatePriceListAction(priceListId, { status: next });
      if (!result.ok) {
        toast.error(result.error.message);
        return;
      }
      router.refresh();
    });
  }

  function onArchive() {
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
          toast.error(result.error.message);
          return;
        }
        router.push('/commerce/pricing');
      });
    })();
  }

  return (
    <div className="flex flex-row items-center gap-2">
      {status !== 'archived' && (
        <Tooltip content="Archive">
          <Button
            variant="ghost"
            size="sm"
            aria-label="Archive"
            disabled={pending}
            onClick={onArchive}
          >
            <Archive className="h-3.5 w-3.5" />
          </Button>
        </Tooltip>
      )}
      {status === 'active' && (
        <Button variant="ghost" size="sm" disabled={pending} onClick={() => transition('draft')}>
          Move to draft
        </Button>
      )}
      {status === 'draft' && (
        <Button
          variant="solid"
          color="module"
          size="sm"
          disabled={pending}
          onClick={() => transition('active')}
        >
          Activate
        </Button>
      )}
    </div>
  );
}
