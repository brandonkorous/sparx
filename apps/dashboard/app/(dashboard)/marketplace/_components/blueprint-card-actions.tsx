'use client';

// The per-blueprint action area. State machine off the install row (docs/54, 55):
//   none           → Install
//   running/failed → Delete & retry (the prior run crashed or partially failed;
//                    delete tears down what it made, then reinstalls)
//   installed      → Installed · draft + "Review & go live" (the checklist surface,
//                    docs/54 §8, owns go-live + delete) + an "Update available" hint
//   live           → Live + "View" (the same review surface) + update hint
// Confirm-gated + toasts, mirroring the module-toggle pattern. router.refresh()
// re-reads the server page so the card reflects the new state.

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Badge, Button } from 'silicaui-react';
import { toast, useConfirm } from '@sparx/ui';

import type { MarketplaceInstallState } from '../_types';

import { deleteBlueprintAction, installBlueprintAction } from '../actions';

interface Props {
  blueprintKey: string;
  blueprintName: string;
  latestVersion: string;
  install: MarketplaceInstallState | null;
  canInstall: boolean;
}

export function BlueprintCardActions({
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
      <p className="text-base-content/70 text-xs">
        Only an owner or admin can install a blueprint.
      </p>
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
        confirmLabel: 'Install blueprint',
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

  // A failed/interrupted run: delete (tear down whatever it made) then reinstall
  // fresh. Destructive, so the confirm names the target and what's lost.
  function onDeleteAndRetry(): void {
    if (!install) return;
    void (async () => {
      const ok = await confirm({
        title: `Delete & retry “${blueprintName}”?`,
        description:
          'This deletes anything the failed install created, then installs the blueprint again, fresh. This cannot be undone.',
        confirmLabel: 'Delete & retry',
        tone: 'danger',
      });
      if (!ok) return;
      startTransition(async () => {
        try {
          const del = await deleteBlueprintAction(install.id);
          if (!del.ok) {
            toast.error("Couldn't delete", { description: del.error.message });
            return;
          }
          const res = await installBlueprintAction(blueprintKey);
          if (res.ok) {
            toast.success(`${blueprintName} reinstalled`, {
              description: 'Created as drafts. Review, customize, then go live.',
            });
          } else {
            toast.error('Deleted, but reinstall failed', { description: res.error.message });
          }
          router.refresh();
        } catch (err) {
          toast.error("Couldn't delete", {
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
  // a clean delete-and-retry rather than a blocked re-install.
  if (install.status === 'failed' || install.status === 'running') {
    return (
      <div className="flex flex-row items-center gap-2">
        <Badge color="danger" variant="soft">
          {install.status === 'failed' ? 'Install failed' : 'Interrupted'}
        </Badge>
        <Button color="primary" onClick={onDeleteAndRetry} loading={pending} disabled={pending}>
          Delete &amp; retry
        </Button>
      </div>
    );
  }

  const driftBadge = install.updateAvailable ? (
    <Badge
      color="warning"
      variant="soft"
      title={`Installed v${install.version} · v${latestVersion} available`}
    >
      Update available
    </Badge>
  ) : null;

  if (install.status === 'live') {
    // Live — the review surface (View) owns update + delete, so the lifecycle stays
    // completable (update to a newer version, or delete) without a destructive
    // control on the marketplace card.
    return (
      <div className="flex flex-row flex-wrap items-center gap-2">
        <Badge color="success" variant="soft">
          Live
        </Badge>
        {driftBadge}
        <Button
          variant="outline"
          size="sm"
          render={<Link href={`/marketplace/installs/${install.id}`} />}
        >
          View
        </Button>
      </div>
    );
  }

  // installed (draft) — lead to the Review & go-live surface (it owns the checklist
  // + go-live + update + delete), plus the drift hint.
  return (
    <div className="flex flex-row flex-wrap items-center gap-2">
      <Badge variant="soft">Installed · draft</Badge>
      {driftBadge}
      <Button color="primary" render={<Link href={`/marketplace/installs/${install.id}`} />}>
        Review &amp; go live
      </Button>
    </div>
  );
}
