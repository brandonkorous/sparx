'use client';

// Go-live + Delete for the "Review & go live" surface (docs/54 §8, docs/55 §9).
// Go-live publishes everything the install created; delete uninstalls it. Confirm-
// gated + toasts. After go-live we refresh (status → live); after delete the install
// is gone, so we return to the marketplace.

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@wizeworks/silicaui-react';
import { toast, useConfirm } from '@sparx/ui';

import { deleteBlueprintAction, goLiveAction } from '../../../actions';

interface Props {
  installId: string;
  blueprintName: string;
  status: string;
  canManage: boolean;
}

export function ReviewActions({ installId, blueprintName, status, canManage }: Props) {
  const router = useRouter();
  const confirm = useConfirm();
  const [pending, startTransition] = React.useTransition();

  if (!canManage) {
    return (
      <p className="text-base-content/70 text-sm">
        Only an owner or admin can go live or delete this install.
      </p>
    );
  }

  const isDraft = status !== 'live';

  function onGoLive(): void {
    void (async () => {
      const ok = await confirm({
        title: `Go live with “${blueprintName}”?`,
        description:
          'Publishes the pages, activates the layout, and sets the products and content live on your site.',
        confirmLabel: 'Go live',
        tone: 'module',
      });
      if (!ok) return;
      startTransition(async () => {
        try {
          const res = await goLiveAction(installId);
          if (res.ok) {
            toast.success('Your site is live');
            router.refresh();
          } else {
            toast.error("Couldn't go live", { description: res.error.message });
          }
        } catch (err) {
          toast.error("Couldn't go live", {
            description: err instanceof Error ? err.message : String(err),
          });
        }
      });
    })();
  }

  function onDelete(): void {
    void (async () => {
      const ok = await confirm({
        title: `Delete “${blueprintName}”?`,
        description:
          'This uninstalls the blueprint — deleting the pages, products, content, components, and emails it created on your site. This cannot be undone. (To get a newer version of the blueprint, use Update instead — it keeps your edits.)',
        confirmLabel: 'Delete',
        tone: 'danger',
      });
      if (!ok) return;
      startTransition(async () => {
        try {
          const res = await deleteBlueprintAction(installId);
          if (res.ok) {
            toast.success(`${blueprintName} deleted`);
            router.push('/marketplace');
          } else {
            toast.error("Couldn't delete", { description: res.error.message });
          }
        } catch (err) {
          toast.error("Couldn't delete", {
            description: err instanceof Error ? err.message : String(err),
          });
        }
      });
    })();
  }

  return (
    <div className="flex flex-row flex-wrap items-center gap-3">
      {isDraft ? (
        <Button color="primary" onClick={onGoLive} loading={pending} disabled={pending}>
          Go live
        </Button>
      ) : null}
      <Button
        color="danger"
        variant="outline"
        onClick={onDelete}
        loading={pending}
        disabled={pending}
      >
        Delete
      </Button>
    </div>
  );
}
