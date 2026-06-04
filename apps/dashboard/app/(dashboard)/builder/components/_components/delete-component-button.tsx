'use client';

// Delete a tenant component (docs/53 §6). Behind a useConfirm dialog naming the
// target ([[destructive-actions-confirm]]); where-used impact analysis (blocking
// on live page placements) lands with insertion in P-B.

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Trash2 } from 'lucide-react';
import { Button, useConfirm } from '@sparx/ui';

import { deleteComponent } from '../_lib/component-actions';

export function DeleteComponentButton({
  componentKey,
  name,
  redirectTo,
}: {
  componentKey: string;
  name: string;
  redirectTo?: string;
}) {
  const router = useRouter();
  const confirm = useConfirm();
  const [busy, setBusy] = React.useState(false);

  const onDelete = async () => {
    const ok = await confirm({
      title: `Delete “${name}”?`,
      description:
        'This permanently removes the component and all its versions. This can’t be undone.',
      confirmLabel: 'Delete component',
      tone: 'danger',
    });
    if (!ok) return;
    setBusy(true);
    const res = await deleteComponent(componentKey);
    setBusy(false);
    if (!res.ok) return;
    if (redirectTo) router.push(redirectTo);
    else router.refresh();
  };

  return (
    <Button
      size="sm"
      variant="ghost"
      color="danger"
      leftIcon={<Trash2 className="h-3.5 w-3.5" />}
      disabled={busy}
      onClick={() => void onDelete()}
    >
      Delete
    </Button>
  );
}
