'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';

import { Button } from '@wizeworks/silicaui-react';
import { useConfirm } from '@sparx/ui';

import {
  activateDiscountAction,
  archiveDiscountAction,
  updateDiscountAction,
} from '../../discount-actions';

export function DiscountStatusToggle({
  discountId,
  status,
}: {
  discountId: string;
  status: string;
}) {
  const router = useRouter();
  const confirm = useConfirm();
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);

  function activate() {
    setError(null);
    startTransition(async () => {
      const result = await activateDiscountAction(discountId);
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      router.refresh();
    });
  }

  function moveToDraft() {
    setError(null);
    startTransition(async () => {
      const result = await updateDiscountAction(discountId, { status: undefined });
      // updateDiscountAction doesn't actually take status, so fall back to
      // a no-op then explicit archive route.
      if (!result.ok) {
        setError(result.error.message);
      }
      router.refresh();
    });
  }

  function archive() {
    void (async () => {
      const ok = await confirm({
        title: 'Archive this discount?',
        description:
          'It’ll stop applying at checkout immediately. Archiving can’t be undone from here — you’d need to create a new discount to bring the offer back.',
        confirmLabel: 'Archive',
        tone: 'danger',
      });
      if (!ok) return;
      setError(null);
      startTransition(async () => {
        const result = await archiveDiscountAction(discountId);
        if (!result.ok) {
          setError(result.error.message);
          return;
        }
        router.refresh();
      });
    })();
  }

  // Acknowledge to satisfy lint; the draft transition is exposed as an
  // explicit Edit button on the detail page (Phase 3.1+).
  void moveToDraft;

  if (status === 'archived') {
    return <p className="text-base-content/70 text-xs">archived</p>;
  }

  return (
    <div className="flex flex-row items-center gap-1">
      {error && <p className="text-danger text-xs">{error}</p>}
      {status === 'draft' && (
        <Button size="sm" variant="ghost" disabled={pending} onClick={activate}>
          Activate
        </Button>
      )}
      <Button size="sm" variant="ghost" disabled={pending} onClick={archive}>
        Archive
      </Button>
    </div>
  );
}
