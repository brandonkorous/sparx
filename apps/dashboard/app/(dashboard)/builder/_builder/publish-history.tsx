'use client';

// The publish history drawer (docs/126 §5.3) — the surface that makes rollback real.
//
// Every publish seals an immutable release: the content-addressed trees that made up
// the whole site at that moment. Restoring one republishes it forward, so the history
// only ever grows and an undo is itself undoable. Without this drawer none of that is
// reachable — an owner who has just published a mistake to their live site has an API
// they cannot see, which is the same as having no undo at all.
//
// Three things this deliberately says out loud rather than leaving to be discovered:
//   · which release visitors are being served RIGHT NOW (the list is otherwise just
//     timestamps, and "which one is live" is the first question anyone has);
//   · that restoring changes the live site immediately — it is a publish, not a
//     preview, so it sits behind a confirm naming what it will do;
//   · that pages created after the target release will come DOWN. That is the one
//     genuinely surprising consequence, so it is stated before the action and
//     reported again afterwards with the real count.
//
// A release whose hash matches its predecessor changed nothing (someone pressed
// Publish twice). It still gets a row — it really happened — but it is labelled, so
// the list reads as a history of CHANGES rather than of button presses.

import { useEffect, useState } from 'react';
import { History, RotateCcw } from 'lucide-react';
import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@wizeworks/silicaui-react';
import { toast, useConfirm } from '@sparx/ui';
import type { ReleaseSummaryDto } from '@sparx/builder-schemas';

import { restoreRelease } from '../_lib/actions';

/** Absolute date + time. Deliberately not "3 hours ago": choosing which version of
 *  your live site to restore is a decision people make against a real clock ("before
 *  lunch", "yesterday evening"), and a relative string forces mental arithmetic at
 *  exactly the wrong moment. */
function formatWhen(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

/** A release that published byte-identical content to the one before it — the author
 *  pressed Publish with nothing changed. Content addressing makes this detectable:
 *  identical manifests hash identically. */
function isNoOp(list: ReleaseSummaryDto[], i: number): boolean {
  const prev = list[i + 1];
  return prev !== undefined && prev.hash === list[i]?.hash;
}

function ReleaseRow({
  release,
  noOp,
  busy,
  onRestore,
}: {
  release: ReleaseSummaryDto;
  noOp: boolean;
  busy: boolean;
  onRestore: () => void;
}) {
  return (
    <li className="border-base-300 flex items-center justify-between gap-4 border-b py-3 last:border-b-0">
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <span className="text-base-content text-base font-medium">
            {formatWhen(release.createdAt)}
          </span>
          {release.current && (
            <Badge color="success" variant="soft">
              Live now
            </Badge>
          )}
          {release.source === 'restore' && (
            <Badge color="info" variant="soft">
              Restored
            </Badge>
          )}
          {noOp && (
            <Badge color="neutral" variant="soft">
              No changes
            </Badge>
          )}
        </div>
        <span className="text-base-content text-sm">
          {release.pageCount} {release.pageCount === 1 ? 'page' : 'pages'}
        </span>
      </div>
      {/* The live release has nothing to restore TO — restoring it would republish
          what is already being served. */}
      {!release.current && (
        <Button variant="outline" size="sm" disabled={busy} onClick={onRestore}>
          <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
          Restore
        </Button>
      )}
    </li>
  );
}

export interface PublishHistoryProps {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  /** The history, newest first. Re-read by the parent whenever the drawer opens so
   *  a publish made since the last open shows up. */
  releases: ReleaseSummaryDto[];
  /** Reload the site after a restore. The engine reads its document once at mount,
   *  so a server revalidate alone would leave the editor holding the pre-restore
   *  tree — and its next autosave would write that straight back over the restore
   *  (the same hazard `resetSiteFrame` documents). */
  onRestored: () => void;
}

export function PublishHistory({ open, onOpenChange, releases, onRestored }: PublishHistoryProps) {
  const confirm = useConfirm();
  const [busy, setBusy] = useState(false);

  // Close on a successful restore: the list the drawer is showing describes a site
  // that no longer exists, and the parent is about to reload.
  useEffect(() => {
    if (!open) setBusy(false);
  }, [open]);

  async function onRestore(release: ReleaseSummaryDto): Promise<void> {
    const ok = await confirm({
      title: `Restore your site to ${formatWhen(release.createdAt)}?`,
      description:
        'This puts that version back on your live site straight away, exactly as visitors saw it then. ' +
        'Any page you added after that point will come down — your draft of it is kept, so you can put it back by publishing again. ' +
        'Nothing is deleted: this is saved as a new entry in your history, so you can undo it.',
      confirmLabel: 'Restore this version',
      tone: 'warning',
    });
    if (!ok) return;

    setBusy(true);
    const res = await restoreRelease(release.id);
    setBusy(false);
    if (!res.ok || !res.data) {
      toast.error(res.error ?? 'Could not restore that version.');
      return;
    }

    // Report what actually moved. The unpublished count is the one an author has to
    // know about — it is a change they did not directly ask for.
    const { pagesRestored, pagesUnpublished } = res.data;
    const took = `${pagesRestored} ${pagesRestored === 1 ? 'page' : 'pages'} restored`;
    toast.success(
      pagesUnpublished > 0
        ? `${took}. ${pagesUnpublished} newer ${pagesUnpublished === 1 ? 'page is' : 'pages are'} no longer live — the draft is still saved.`
        : `${took}. Your live site is back to how it was.`
    );
    onOpenChange(false);
    onRestored();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Publish history</DialogTitle>
        </DialogHeader>
        {releases.length === 0 ? (
          <p className="text-base-content py-4 text-base">
            You haven’t published this site yet. Once you do, every version shows up here and you
            can put any of them back.
          </p>
        ) : (
          <>
            <p className="text-base-content pb-2 text-base">
              Every time you publish, we save a copy of your whole site. Put any of them back on
              your live site — nothing here is ever deleted.
            </p>
            <ul className="max-h-96 overflow-y-auto">
              {releases.map((r, i) => (
                <ReleaseRow
                  key={r.id}
                  release={r}
                  noOp={isNoOp(releases, i)}
                  busy={busy}
                  onRestore={() => void onRestore(r)}
                />
              ))}
            </ul>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

/** The toolbar entry point. Icon + label rather than icon-only: "History" is not a
 *  universally-read glyph, and this is the control someone reaches for while
 *  stressed about something they just published. */
export function PublishHistoryButton({ onClick }: { onClick: () => void }) {
  return (
    <Button variant="ghost" size="sm" onClick={onClick}>
      <History className="mr-1.5 h-3.5 w-3.5" />
      History
    </Button>
  );
}
