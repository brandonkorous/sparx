'use client';

// Restore-revision button. Confirms first because a restore is a real
// state change (it copies the old body onto the entry and creates a new
// revision — history isn't lost, but the live entry changes). After
// success we router.push back to /cms/[id] so the editor reloads with
// the restored content.

import { useRouter } from 'next/navigation';
import * as React from 'react';
import { toast, useConfirm } from '@sparx/ui';
import { Button } from '@wizeworks/silicaui-react';
import { RotateCcw } from 'lucide-react';
import { restoreRevision } from '../../actions';

export function RestoreButton({
  entryId,
  revisionNumber,
}: {
  entryId: string;
  revisionNumber: number;
}) {
  const router = useRouter();
  const confirm = useConfirm();
  const [pending, startTransition] = React.useTransition();

  async function handleRestore() {
    const ok = await confirm({
      title: `Restore revision #${revisionNumber}?`,
      description: (
        <>
          The current entry body and SEO will be replaced with the contents of this revision.
          History is preserved — a new revision is created at the top of the stack, so you can undo
          by restoring the previous revision.
        </>
      ),
      confirmLabel: 'Restore revision',
      tone: 'warning',
    });
    if (!ok) return;
    startTransition(async () => {
      const result = await restoreRevision(entryId, revisionNumber);
      if (!result.ok) {
        toast.error(result.error ?? 'Could not restore revision.');
        return;
      }
      toast.success(`Revision #${revisionNumber} restored.`);
      router.push(`/cms/${entryId}`);
      router.refresh();
    });
  }

  return (
    <Button
      size="sm"
      color="module"
      variant="outline"
      iconStart={<RotateCcw className="h-3.5 w-3.5" />}
      onClick={handleRestore}
      disabled={pending}
      loading={pending}
    >
      Restore
    </Button>
  );
}
