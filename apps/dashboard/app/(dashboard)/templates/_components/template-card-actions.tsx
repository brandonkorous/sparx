'use client';

// The per-template action area. State machine off the install row (docs/54):
//   none           → Install
//   running/failed → Reset & retry (the prior run crashed or partially failed;
//                    reset tears down what it made, then reinstalls)
//   installed      → Installed · draft + Go live (+ quiet Reset to undo) + an
//                    "Update available" hint when the installed version drifts
//   live           → Live (+ update hint)
// Confirm-gated + toasts, mirroring the module-toggle pattern. router.refresh()
// re-reads the server page so the card reflects the new state.

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Badge, Button, Stack, Text, toast, useConfirm } from '@sparx/ui';

import { goLiveAction, installBlueprintAction, resetBlueprintAction } from '../actions';

interface Props {
  blueprintKey: string;
  blueprintName: string;
  latestVersion: string;
  install: { id: string; status: string; version: string; update_available: boolean } | null;
  canInstall: boolean;
}

export function TemplateCardActions({
  blueprintKey,
  blueprintName,
  latestVersion,
  install,
  canInstall,
}: Props) {
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

  // confirm() opens a dialog via React state — it MUST run outside startTransition,
  // or the transition holds the dialog-open update and the dialog never appears
  // (the await then never resolves → button spins forever). Only the mutation
  // belongs in the transition.

  function onInstall(): void {
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

  // Reset = uninstall: tear down everything the install created. Destructive, so
  // the confirm names the target and what's lost. `retry` chains a fresh install
  // afterward (the recovery path for a failed run).
  function onReset(retry: boolean): void {
    if (!install) return;
    void (async () => {
      const ok = await confirm({
        title: retry ? `Reset & retry “${blueprintName}”?` : `Reset “${blueprintName}”?`,
        description:
          'This deletes the pages, products, content, components, and emails this template created on your site. This cannot be undone.' +
          (retry ? ' Then it installs the template again, fresh.' : ''),
        confirmLabel: retry ? 'Reset & retry' : 'Reset',
        tone: 'danger',
      });
      if (!ok) return;
      startTransition(async () => {
        try {
          const reset = await resetBlueprintAction(install.id);
          if (!reset.ok) {
            toast.error("Couldn't reset", { description: reset.error.message });
            return;
          }
          if (!retry) {
            toast.success(`${blueprintName} reset`);
            router.refresh();
            return;
          }
          const res = await installBlueprintAction(blueprintKey);
          if (res.ok) {
            toast.success(`${blueprintName} reinstalled`, {
              description: 'Created as drafts. Review, customize, then go live.',
            });
          } else {
            toast.error('Reset, but reinstall failed', { description: res.error.message });
          }
          router.refresh();
        } catch (err) {
          toast.error("Couldn't reset", {
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

  // A prior run crashed (`running`, never finalized) or errored (`failed`): offer
  // a clean reset-and-retry rather than a blocked re-install.
  if (install.status === 'failed' || install.status === 'running') {
    return (
      <Stack direction="row" gap={2} align="center">
        <Badge color="danger" variant="soft">
          {install.status === 'failed' ? 'Install failed' : 'Interrupted'}
        </Badge>
        <Button color="primary" onClick={() => onReset(true)} loading={pending} disabled={pending}>
          Reset &amp; retry
        </Button>
      </Stack>
    );
  }

  const driftBadge = install.update_available ? (
    <Badge
      color="warning"
      variant="soft"
      title={`Installed v${install.version} · v${latestVersion} available`}
    >
      Update available
    </Badge>
  ) : null;

  if (install.status === 'live') {
    // A live install can still be reset — the lifecycle has to be completable
    // (start over, or reinstall a newer catalog version when one is available).
    // It's destructive (tears down the live pages/products/content), so it stays
    // a quiet ghost button behind the same name-the-target danger confirm.
    return (
      <Stack direction="row" gap={2} align="center" className="flex-wrap">
        <Badge color="success" variant="soft">
          Live
        </Badge>
        {driftBadge}
        <Button
          color="danger"
          variant="ghost"
          size="sm"
          onClick={() => onReset(false)}
          loading={pending}
          disabled={pending}
        >
          Reset
        </Button>
      </Stack>
    );
  }

  // installed (draft) — offer go-live, a quiet uninstall, and the drift hint.
  return (
    <Stack direction="row" gap={2} align="center" className="flex-wrap">
      <Badge variant="soft">Installed · draft</Badge>
      {driftBadge}
      <Button color="primary" onClick={onGoLive} loading={pending} disabled={pending}>
        Go live
      </Button>
      <Button
        color="danger"
        variant="ghost"
        size="sm"
        onClick={() => onReset(false)}
        loading={pending}
        disabled={pending}
      >
        Reset
      </Button>
    </Stack>
  );
}
