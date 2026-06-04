'use client';

// Delete a tenant component (docs/53 §6). Behind a useConfirm dialog naming the
// target ([[destructive-actions-confirm]]). Where-used impact analysis runs FIRST:
// if the component is still placed on any page/layout, deletion is blocked (the
// server refuses too) and the dialog names where it's used so the author can
// remove those placements before trying again.

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Trash2 } from 'lucide-react';
import { Button, useConfirm } from '@sparx/ui';

import { deleteComponent, getComponentUsages } from '../_lib/component-actions';

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
    setBusy(true);
    const usage = await getComponentUsages(componentKey);
    setBusy(false);
    // In use → block with a dialog naming the placements (no delete action).
    if (usage.ok && usage.data && usage.data.total > 0) {
      const names = [
        ...usage.data.pages.map((p) => p.name),
        ...usage.data.layouts.map((l) => l.name),
      ];
      await confirm({
        title: `“${name}” is still in use`,
        description: `It’s placed on ${usage.data.total} ${
          usage.data.total === 1 ? 'page or layout' : 'pages/layouts'
        }: ${names.join(', ')}. Remove those placements before deleting it.`,
        confirmLabel: 'OK',
        cancelLabel: 'Close',
        tone: 'warning',
      });
      return;
    }

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
    if (!res.ok) {
      await confirm({
        title: 'Couldn’t delete the component',
        description: res.error ?? 'Something went wrong. Please try again.',
        confirmLabel: 'OK',
        cancelLabel: 'Close',
        tone: 'warning',
      });
      return;
    }
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
