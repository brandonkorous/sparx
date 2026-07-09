'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Trash } from 'lucide-react';

import { Button } from '@wizeworks/silicaui-react';
import { useConfirm } from '@sparx/ui';

import { deleteCategoryAction } from '../../category-actions';

// Delete affordance for the category detail view. Destructive, so it goes
// through `useConfirm` (name the target + spell out the consequence) per the
// platform's destructive-action rule. On success we leave the detail surface
// for the list — navigating to the list route drops the `?drawer`/`?modal`
// token, so this closes an overlay too.
//
// Lives in the SurfaceFrame toolbar's `destructive` slot (far left, away from
// Save) — never in the read-only summary aside — so it renders at the toolbar's
// default size with a quiet ghost-danger treatment matching the ghost Cancel
// beside it.

export function CategoryDeleteButton({ categoryId, name }: { categoryId: string; name: string }) {
  const router = useRouter();
  const confirm = useConfirm();
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);

  async function onDelete() {
    const ok = await confirm({
      title: `Delete category "${name}"?`,
      description:
        'Products keep their other category bindings; the category itself archives (soft-delete) and can be restored from the archive view. Remove or reparent any child categories first.',
      confirmLabel: 'Delete category',
      tone: 'danger',
    });
    if (!ok) return;
    setError(null);
    startTransition(async () => {
      const result = await deleteCategoryAction(categoryId);
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      router.push('/commerce/categories');
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
