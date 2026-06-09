'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Text } from '@sparx/ui';
import { RefreshCw } from 'lucide-react';
import { syncSupplier } from '../../../_lib/actions';

interface Props {
  supplierId: string;
}

export function SyncButton({ supplierId }: Props) {
  const [syncError, setSyncError] = useState<string | null>(null);
  const [pending, startSync] = useTransition();
  const router = useRouter();

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        color="neutral"
        variant="outline"
        size="sm"
        disabled={pending}
        onClick={() =>
          startSync(async () => {
            setSyncError(null);
            const { error } = await syncSupplier(supplierId);
            if (error) {
              setSyncError(error);
            } else {
              router.refresh();
            }
          })
        }
      >
        <RefreshCw className={`mr-1 h-4 w-4 ${pending ? 'animate-spin' : ''}`} />
        {pending ? 'Syncing…' : 'Sync now'}
      </Button>
      {syncError && (
        <Text size="xs" className="text-right text-[var(--color-danger)]">
          {syncError}
        </Text>
      )}
    </div>
  );
}
