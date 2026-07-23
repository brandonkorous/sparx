'use client';

// Draft version history (docs/126 §4.6) — the studio's undo-across-saves.
//
// Every save is a restorable version (the service seals one on each sync). This drawer
// lists them newest-first and restores any one: the server rewrites the draft NON-
// destructively (it never deletes a page added since, nor resurrects a deleted one) and
// seals the restore as its own version, then the editor reloads to show the result. It is
// the recovery net that makes concurrent agent+operator editing safe to promise — a
// last-write-wins overwrite is one click back, not gone.

import { useState } from 'react';
import {
  Badge,
  Button,
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  useToast,
} from '@wizeworks/silicaui-react';
import { Clock, History, RotateCcw, Sparkles, User } from 'lucide-react';
import { useConfirm } from '../../../lib/confirm';
import {
  builderErrorMessage,
  useDraftVersions,
  useRestoreDraftVersion,
  type DraftVersionDto,
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

interface Props {
  /** Reload the editor (refetch + remount) after a restore, so the canvas shows it. */
  onReload: () => void;
}

export function VersionHistory({ onReload }: Props) {
  const [open, setOpen] = useState(false);
  const versions = useDraftVersions(open);
  const restore = useRestoreDraftVersion();
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

  return (
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
          <DrawerTitle>Version history</DrawerTitle>
          <p className="text-base-content text-base">
            Every save is kept. Restore any version — it won’t delete anything you’ve added since.
          </p>
        </DrawerHeader>

        <div className="flex-1 overflow-y-auto px-4 pb-4">
          {versions.isPending ? (
            <p className="p-4 text-base" role="status">
              Loading history…
            </p>
          ) : !versions.data || versions.data.length === 0 ? (
            <p className="p-4 text-base">
              No saved versions yet. Every time you (or your assistant) save, a version lands here.
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
        </div>
      </DrawerContent>
    </Drawer>
  );
}
