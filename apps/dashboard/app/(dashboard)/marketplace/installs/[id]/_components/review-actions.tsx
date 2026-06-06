'use client';

// Go-live + Reset for the "Review & go live" surface (docs/54 §8). Go-live
// publishes everything the install created; reset tears it down. Confirm-gated +
// toasts, mirroring the card actions. After go-live we refresh (status → live);
// after reset the install is gone, so we return to the marketplace.

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Button, Stack, Text, toast, useConfirm } from '@sparx/ui';

import { goLiveAction, resetBlueprintAction } from '../../../actions';

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
      <Text size="sm" variant="muted">
        Only an owner or admin can go live or reset this install.
      </Text>
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

  function onReset(): void {
    void (async () => {
      const ok = await confirm({
        title: `Reset “${blueprintName}”?`,
        description:
          'This deletes the pages, products, content, components, and emails this blueprint created on your site. This cannot be undone.',
        confirmLabel: 'Reset',
        tone: 'danger',
      });
      if (!ok) return;
      startTransition(async () => {
        try {
          const res = await resetBlueprintAction(installId);
          if (res.ok) {
            toast.success(`${blueprintName} reset`);
            router.push('/marketplace');
          } else {
            toast.error("Couldn't reset", { description: res.error.message });
          }
        } catch (err) {
          toast.error("Couldn't reset", {
            description: err instanceof Error ? err.message : String(err),
          });
        }
      });
    })();
  }

  return (
    <Stack direction="row" gap={3} align="center" className="flex-wrap">
      {isDraft ? (
        <Button color="primary" onClick={onGoLive} loading={pending} disabled={pending}>
          Go live
        </Button>
      ) : null}
      <Button
        color="danger"
        variant="outline"
        onClick={onReset}
        loading={pending}
        disabled={pending}
      >
        Reset
      </Button>
    </Stack>
  );
}
