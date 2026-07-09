'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';

import { Button } from '@wizeworks/silicaui-react';

import { archiveSupplierAction } from '../../../_lib/supplier-actions';

export function SupplierArchiveButton({
  supplierId,
  isActive,
}: {
  supplierId: string;
  isActive: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);
  const [armed, setArmed] = React.useState(false);

  function onArchive() {
    setError(null);
    startTransition(async () => {
      const result = await archiveSupplierAction(supplierId);
      if (!result.ok) {
        setError(result.error.message);
        setArmed(false);
        return;
      }
      router.push('/inventory/suppliers');
    });
  }

  if (!isActive) {
    return <p className="text-base-content/70 text-xs">Already inactive</p>;
  }

  return (
    <div className="flex items-center gap-2">
      {error && <p className="text-danger text-xs">{error}</p>}
      {armed ? (
        <>
          <Button variant="ghost" size="sm" onClick={() => setArmed(false)} disabled={pending}>
            Cancel
          </Button>
          <Button color="danger" size="sm" onClick={onArchive} disabled={pending}>
            {pending ? 'Archiving…' : 'Confirm archive'}
          </Button>
        </>
      ) : (
        <Button variant="outline" size="sm" onClick={() => setArmed(true)}>
          Archive
        </Button>
      )}
    </div>
  );
}
