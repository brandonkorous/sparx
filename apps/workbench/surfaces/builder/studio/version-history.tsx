'use client';

// History — the studio's two undo ladders, side by side (docs/126 §4.6 + §5.3).
//
// TWO HISTORIES, and conflating them would be the dangerous bug. They restore
// different things and one of them is visible to the public:
//
//   · DRAFTS — every Save seals a version. Restoring one rewrites the working copy.
//     Visitors see nothing until the author publishes, so it is a private, cheap,
//     fully reversible action. This is the undo-across-saves that makes concurrent
//     agent+operator editing safe to promise.
//   · PUBLISHED — every Publish seals an immutable release. Restoring one changes
//     what VISITORS SEE, the moment it returns; there is no publish step in between.
//     This is a live-site rollback, and it is the recovery path for "we published
//     something broken" — the one moment an owner most needs a way back.
//
// They are separate TABS rather than one merged, timestamp-ordered list. Interleaved,
// the two kinds sit adjacent and read as one ladder, and the only thing distinguishing
// "changes my copy" from "changes my live website" would be a badge — which is not
// enough weight for an action a customer can see. The tab is the wall.
//
// The published side never lists a Restore on the current release: rolling back to what
// is already live is a no-op that still mints a release, so offering it would add noise
// to the history the author is trying to read.

import { useState } from 'react';
import {
  Alert,
  AlertContent,
  AlertDescription,
  Badge,
  Button,
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  Tabs,
  TabsList,
  TabsPanel,
  TabsTab,
  useToast,
} from '@wizeworks/silicaui-react';
import { Clock, Globe, History, RotateCcw, Sparkles, User } from 'lucide-react';
import { PaneScope } from '../../../lib/dock/window-boundary';
import { useConfirm } from '../../../lib/confirm';
import {
  builderErrorMessage,
  useDraftVersions,
  useReleases,
  useRestoreDraftVersion,
  useRestoreRelease,
  type DraftVersionDto,
  type ReleaseDto,
  type RestoreReleaseResult,
} from './data';

/** A short "2 minutes ago" for a save timestamp — non-technical, no library. */
function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  const secs = Math.max(0, Math.round((Date.now() - then) / 1000));
  if (secs < 45) return 'just now';
  const mins = Math.round(secs / 60);
  if (mins < 60) return `${mins} minute${mins === 1 ? '' : 's'} ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} hour${hrs === 1 ? '' : 's'} ago`;
  const days = Math.round(hrs / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

/** How a version reads to a non-technical owner: label + the hue/icon that names the author. */
function sourceMeta(source: string): {
  label: string;
  icon: typeof User;
  color: 'neutral' | 'module';
} {
  if (source === 'agent') return { label: 'Assistant saved', icon: Sparkles, color: 'module' };
  if (source === 'restore') return { label: 'Restored', icon: RotateCcw, color: 'neutral' };
  return { label: 'You saved', icon: User, color: 'neutral' };
}

/** The same, for the published ladder. A release's `source` is `publish` or
 *  `restore` — never `agent`, since publishing is always a deliberate act. */
function releaseMeta(source: string): { label: string; icon: typeof Globe } {
  if (source === 'restore') return { label: 'Rolled back', icon: RotateCcw };
  return { label: 'Published', icon: Globe };
}

/**
 * What a rollback actually did, in a sentence an owner can act on.
 *
 * `pagesUnpublished` is the number that has to be said out loud. A page created
 * after the chosen release is not in its manifest, so restoring takes it OFF the
 * live site — correct (otherwise "restore" would produce a site that never existed)
 * and completely invisible from the drawer. Its draft survives, so the fix is one
 * Publish away, and that is the half of the sentence that stops the news being alarming.
 */
function rollbackSummary(result: RestoreReleaseResult): string {
  const pages = `${result.pagesRestored} page${result.pagesRestored === 1 ? '' : 's'}`;
  if (result.pagesUnpublished === 0) return `Your live site is back to that version — ${pages}.`;
  const gone = `${result.pagesUnpublished} page${result.pagesUnpublished === 1 ? '' : 's'}`;
  return (
    `Your live site is back to that version — ${pages}. ${gone} you added later ` +
    `${result.pagesUnpublished === 1 ? 'is' : 'are'} no longer public, because ` +
    `${result.pagesUnpublished === 1 ? 'it did' : 'they did'}n’t exist yet. ` +
    `Nothing you wrote is lost — publish again to bring ${result.pagesUnpublished === 1 ? 'it' : 'them'} back.`
  );
}

interface Props {
  /** Reload the editor (refetch + remount) after a restore, so the canvas shows it. */
  onReload: () => void;
}

export function VersionHistory({ onReload }: Props) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState('drafts');
  const versions = useDraftVersions(open);
  const releases = useReleases(open);
  const restore = useRestoreDraftVersion();
  const rollback = useRestoreRelease();
  const confirm = useConfirm();
  const toast = useToast();

  const onRestore = async (v: DraftVersionDto): Promise<void> => {
    const ok = await confirm({
      title: `Restore the version from ${timeAgo(v.createdAt)}?`,
      description:
        'Your site’s draft switches back to how it was then. Any unsaved changes will be lost, ' +
        'and pages you’ve added since are kept. You can restore a newer version to undo this.',
      confirmLabel: 'Restore it',
      cancelLabel: 'Keep current',
      color: 'primary',
    });
    if (!ok) return;
    try {
      await restore.mutateAsync(v.id);
      toast.add({
        title: 'Restored',
        description: 'Your draft was rolled back. Publish when you’re happy with it.',
        type: 'success',
      });
      setOpen(false);
      onReload();
    } catch (error) {
      toast.add({
        title: 'Could not restore',
        description: builderErrorMessage(error, 'Nothing changed. Try again in a moment.'),
        type: 'error',
      });
    }
  };

  const onRollback = async (r: ReleaseDto): Promise<void> => {
    // A HEAVIER confirm than the draft one, because the consequence is heavier: this
    // is the only action in the editor that changes what the public sees without a
    // Publish. `danger` and an explicit "visitors will see" — the confirm has to name
    // the audience, not just the operation.
    const ok = await confirm({
      title: `Put the version from ${timeAgo(r.createdAt)} back on your live site?`,
      description:
        'Visitors will see that version straight away — this changes your public website, not ' +
        'just your working copy. Anything you’ve published since goes back to how it was then, ' +
        'and pages you added later stop being public until you publish them again. Nothing you ' +
        'have written is deleted, and this itself can be rolled back.',
      confirmLabel: 'Put it back live',
      cancelLabel: 'Leave my site as it is',
      color: 'danger',
    });
    if (!ok) return;
    try {
      const result = await rollback.mutateAsync(r.id);
      toast.add({
        title: 'Your live site was rolled back',
        description: rollbackSummary(result),
        type: 'success',
      });
      setOpen(false);
      // DELIBERATELY NO `onReload()` here, unlike the draft restore above.
      //
      // A rollback rewrites the PUBLISHED trees and leaves the draft alone, so the
      // canvas is already showing the right thing. `onReload` remounts the editor
      // from the server's draft — which would throw away any unsaved edit the author
      // had on screen, to fix nothing. Rolling back a bad publish is exactly the
      // moment someone is mid-repair with unsaved work open, so this is the wrong
      // place of all places to reload.
      //
      // The one thing that DOES go stale is the "Published / not live yet" badge,
      // computed from draft-vs-published; `useRestoreRelease` invalidates that query,
      // so it refetches on its own without touching the canvas.
    } catch (error) {
      toast.add({
        title: 'Could not roll back',
        description: builderErrorMessage(
          error,
          'Your live site is unchanged. Try again in a moment.'
        ),
        type: 'error',
      });
    }
  };

  return (
    // PaneScope, because this app is an MDI: without it the drawer portals to
    // `document.body` and dims the whole workbench — the rail, the status bar and every
    // other open pane — for a panel that belongs to ONE editor. Scoped, it covers the
    // editor it was opened from and nothing else, which is also what makes it correct in
    // a torn-off window (see window-boundary.tsx). Same treatment as the media browser
    // and every other pane-owned overlay in the app.
    <PaneScope>
      <Drawer open={open} onOpenChange={setOpen}>
        <Button
          size="sm"
          variant="ghost"
          color="neutral"
          onClick={() => {
            setOpen(true);
          }}
        >
          <History className="size-4" aria-hidden />
          History
        </Button>
        <DrawerContent side="right" className="flex w-[26rem] max-w-full flex-col">
          <DrawerHeader>
            <DrawerTitle>History</DrawerTitle>
            <p className="text-base-content text-base">
              Go back to how things were — either your working copy, or what your visitors see.
            </p>
          </DrawerHeader>

          <Tabs value={tab} onValueChange={setTab} className="flex min-h-0 flex-1 flex-col">
            <div className="bg-base-300 mx-4 shrink-0 rounded-full px-4 py-2">
              <TabsList>
                {/* Full ink on both labels: silica's resting `.tabs-tab` is a faded
                  token, and "which of my two histories am I in" is exactly the
                  question that must be readable BEFORE you click. */}
                <TabsTab value="drafts" className="text-base-content">
                  Your drafts
                </TabsTab>
                <TabsTab value="published" className="text-base-content">
                  Published
                </TabsTab>
              </TabsList>
            </div>

            <TabsPanel value="drafts" className="min-h-0 flex-1 overflow-y-auto px-4 pt-3 pb-4">
              <p className="text-base-content mb-3 text-base">
                Every time you save, a version is kept. Restoring one changes your working copy only
                — your visitors won’t see anything until you publish.
              </p>
              {versions.isPending ? (
                <p className="p-4 text-base" role="status">
                  Loading history…
                </p>
              ) : !versions.data || versions.data.length === 0 ? (
                <p className="p-4 text-base">
                  No saved versions yet. Every time you (or your assistant) save, a version lands
                  here.
                </p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {versions.data.map((v) => {
                    const meta = sourceMeta(v.source);
                    const Icon = meta.icon;
                    return (
                      <li
                        key={v.id}
                        className="border-base-300 flex items-center justify-between gap-3 rounded-lg border p-3"
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <Badge color={meta.color} variant="soft" size="sm">
                            <Icon className="size-3.5" aria-hidden />
                            {meta.label}
                          </Badge>
                          <span className="text-base-content flex items-center gap-1 text-base">
                            <Clock className="size-3.5" aria-hidden />
                            {timeAgo(v.createdAt)}
                            <span>
                              · {v.pageCount} page{v.pageCount === 1 ? '' : 's'}
                            </span>
                          </span>
                        </div>
                        {v.current ? (
                          <Badge color="success" variant="soft" size="sm">
                            Current
                          </Badge>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            color="neutral"
                            loading={restore.isPending}
                            onClick={() => {
                              void onRestore(v);
                            }}
                          >
                            <RotateCcw className="size-4" aria-hidden />
                            Restore
                          </Button>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </TabsPanel>

            <TabsPanel value="published" className="min-h-0 flex-1 overflow-y-auto px-4 pt-3 pb-4">
              {/* The warning belongs at the TOP of this panel, not on each row: it is
                true of the whole tab, and repeating it per release would train the
                eye to skip it — which is the opposite of what a live-site action
                needs. `warning`, not `danger`: this is a caution about what the
                buttons below do, not a report that something is wrong. */}
              <Alert color="warning" variant="soft" className="mb-3">
                <AlertContent>
                  <AlertDescription>
                    These are the versions your visitors have seen. Putting one back changes your
                    live website straight away — no publishing step. Your working copy is left
                    alone.
                  </AlertDescription>
                </AlertContent>
              </Alert>

              {releases.isPending ? (
                <p className="p-4 text-base" role="status">
                  Loading publish history…
                </p>
              ) : releases.isError ? (
                <p className="p-4 text-base">
                  We couldn’t load your publish history just now. Your live site is unaffected —
                  close this and try again.
                </p>
              ) : !releases.data || releases.data.length === 0 ? (
                <p className="p-4 text-base">
                  You haven’t published yet. Once you do, every version you put live is kept here so
                  you can go back to it.
                </p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {releases.data.map((r) => {
                    const meta = releaseMeta(r.source);
                    const Icon = meta.icon;
                    return (
                      <li
                        key={r.id}
                        className="border-base-300 flex items-center justify-between gap-3 rounded-lg border p-3"
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <Badge color="neutral" variant="soft" size="sm">
                            <Icon className="size-3.5" aria-hidden />
                            {meta.label}
                          </Badge>
                          <span className="text-base-content flex items-center gap-1 text-base">
                            <Clock className="size-3.5" aria-hidden />
                            {timeAgo(r.createdAt)}
                            <span>
                              · {r.pageCount} page{r.pageCount === 1 ? '' : 's'}
                            </span>
                          </span>
                        </div>
                        {r.current ? (
                          <Badge color="success" variant="soft" size="sm">
                            Live now
                          </Badge>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            color="danger"
                            loading={rollback.isPending}
                            onClick={() => {
                              void onRollback(r);
                            }}
                          >
                            <RotateCcw className="size-4" aria-hidden />
                            Put back live
                          </Button>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </TabsPanel>
          </Tabs>
        </DrawerContent>
      </Drawer>
    </PaneScope>
  );
}
