'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Trash } from 'lucide-react';
import { Button } from 'silicaui-react';
import { useConfirm } from '@sparx/ui';

import { deleteBootcampAction } from '../actions';

// Delete affordance for a DRAFT bootcamp (the API only deletes drafts — published/
// cancelled cohorts are soft-kept for history). Destructive, so it routes through
// useConfirm. Lives in the SurfaceFrame toolbar's `destructive` slot, away from
// Save. On success it returns to the list.

export function BootcampDeleteButton({ id, title }: { id: string; title: string }) {
  const router = useRouter();
  const confirm = useConfirm();
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);

  async function onDelete() {
    const ok = await confirm({
      title: `Delete "${title}"?`,
      description:
        'This draft bootcamp is removed for good. Only drafts can be deleted — publish or cancel keeps a cohort on record instead.',
      confirmLabel: 'Delete bootcamp',
      tone: 'danger',
    });
    if (!ok) return;
    setError(null);
    startTransition(async () => {
      const result = await deleteBootcampAction(id);
      if (!result.ok) {
        setError(result.error ?? 'Could not delete the bootcamp.');
        return;
      }
      router.push('/partner/bootcamps');
      router.refresh();
    });
  }

  return (
    <div className="flex items-center gap-2">
      {error && <p className="text-danger text-xs">{error}</p>}
      <Button
        type="button"
        color="danger"
        variant="ghost"
        onClick={() => void onDelete()}
        iconStart={<Trash className="h-4 w-4" />}
        disabled={pending}
      >
        {pending ? 'Deleting…' : 'Delete'}
      </Button>
    </div>
  );
}
