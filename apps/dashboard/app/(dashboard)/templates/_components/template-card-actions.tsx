'use client';

// The per-template action area: Install (when not yet installed), then the
// draft → go-live state once installed. Confirm-gated + toasts, mirroring the
// module-toggle pattern. router.refresh() re-reads the server page so the card
// reflects the new install state.

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Badge, Button, Stack, Text, toast, useConfirm } from '@sparx/ui';

import { goLiveAction, installBlueprintAction } from '../actions';

interface Props {
  blueprintKey: string;
  blueprintName: string;
  install: { id: string; status: string } | null;
  canInstall: boolean;
}

export function TemplateCardActions({ blueprintKey, blueprintName, install, canInstall }: Props) {
  const router = useRouter();
  const confirm = useConfirm();
  const [pending, startTransition] = React.useTransition();

  if (!canInstall) {
    return (
      <Text size="xs" variant="muted">
        Only an owner or admin can install a template.
      </Text>
    );
  }

  function onInstall(): void {
    // confirm() opens a dialog via React state — it MUST run outside
    // startTransition, or the transition holds the dialog-open update and the
    // dialog never appears (the await then never resolves → button spins
    // forever). Only the mutation belongs in the transition.
    void (async () => {
      const ok = await confirm({
        title: `Install “${blueprintName}”?`,
        description:
          'This creates a themed site, products, content, and emails as drafts on your active site. Nothing goes public until you review and go live.',
        confirmLabel: 'Install template',
        tone: 'module',
      });
      if (!ok) return;
      startTransition(async () => {
        try {
          const res = await installBlueprintAction(blueprintKey);
          if (res.ok) {
            toast.success(`${blueprintName} installed`, {
              description: 'Created as drafts. Review, customize, then go live.',
            });
            router.refresh();
          } else {
            toast.error("Couldn't install", { description: res.error.message });
          }
        } catch (err) {
          toast.error("Couldn't install", {
            description: err instanceof Error ? err.message : String(err),
          });
        }
      });
    })();
  }

  function onGoLive(): void {
    if (!install) return;
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
          const res = await goLiveAction(install.id);
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

  if (!install) {
    return (
      <Button color="primary" onClick={onInstall} loading={pending} disabled={pending}>
        Install
      </Button>
    );
  }

  if (install.status === 'live') {
    return (
      <Badge color="success" variant="soft">
        Live
      </Badge>
    );
  }

  // installed (draft) — offer go-live.
  return (
    <Stack direction="row" gap={2} align="center">
      <Badge variant="soft">Installed · draft</Badge>
      <Button color="primary" onClick={onGoLive} loading={pending} disabled={pending}>
        Go live
      </Button>
    </Stack>
  );
}
