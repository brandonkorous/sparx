'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Trash2 } from 'lucide-react';

import { toast, useConfirm } from '@sparx/ui';
import { Button, Tooltip } from '@wizeworks/silicaui-react';

import { deleteBundleAction } from '../../../configurator-actions';

export function BundleDeleteButton({ bundleId }: { bundleId: string }) {
  const router = useRouter();
  const confirm = useConfirm();
  const [pending, startTransition] = React.useTransition();

  function onDelete() {
    void (async () => {
      const ok = await confirm({
        title: 'Delete bundle?',
        description:
          'Removes the bundle wrapper. The wrapper product and component variants stay intact.',
        confirmLabel: 'Delete bundle',
        tone: 'danger',
      });
      if (!ok) return;
      startTransition(async () => {
        const result = await deleteBundleAction(bundleId);
        if (!result.ok) {
          toast.error(result.error.message);
          return;
        }
        router.push('/commerce/bundles');
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
