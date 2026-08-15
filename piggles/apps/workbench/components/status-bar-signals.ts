'use client';

// The facts the status bar reports, each as its own hook.
//
// Split out of status-bar.tsx because they share exactly one trait — "a thing
// that changes while you work" — and nothing else: one polls closures, one
// reads the pane host, one listens to the mutation cache. Keeping them here
// leaves the bar itself as pure presentation.

import { useEffect, useState } from 'react';
import { useQueryClient } from '@sparx/query';
import { readWriteMeta } from '../lib/api/write-meta';
import type { DetachedWindow } from '../lib/workbench/pane-host';
import type { PaneDescriptor } from '../lib/surfaces/descriptor';
import { useWorkbench } from '../lib/workbench/context';

/** Dirty guards are pull-based closures — nothing fires when an editor flips
 *  dirty — so the count is polled. Iterating a handful of closures every
 *  1.5s is nothing, and the state setter bails when the ids match. */
const DIRTY_POLL_MS = 1500;

/** How often "Saved 2m ago" re-reads the clock. The label only changes at
 *  minute boundaries, so anything finer is wasted renders. */
const AGO_TICK_MS = 30_000;

export function useDirtyPanes(): PaneDescriptor[] {
  const { controller } = useWorkbench();
  const [dirty, setDirty] = useState<PaneDescriptor[]>([]);

  useEffect(() => {
    const sync = () => {
      setDirty((current) => {
        const next = controller.dirtyPanes();
        const same =
          next.length === current.length && next.every((pane, i) => pane.id === current[i]?.id);
        return same ? current : next;
      });
    };
    sync();
    const timer = setInterval(sync, DIRTY_POLL_MS);
    const unsubscribe = controller.subscribe(sync);
    return () => {
      clearInterval(timer);
      unsubscribe();
    };
  }, [controller]);

  return dirty;
}

/**
 * The windows panes have been torn into.
 *
 * `controller.detachedWindows()` mints a fresh array (and fresh closures) on
 * every call, so this CANNOT be a useSyncExternalStore — that would re-render
 * forever. Same diff-then-set shape as useDirtyPanes: compare by window id and
 * by the panes inside, since a pane dragged between two popouts changes neither
 * count.
 */
export function useDetachedWindows(): DetachedWindow[] {
  const { controller } = useWorkbench();
  const [windows, setWindows] = useState<DetachedWindow[]>([]);

  useEffect(() => {
    const sync = () => {
      setWindows((current) => {
        const next = controller.detachedWindows();
        const same =
          next.length === current.length &&
          next.every((window, i) => {
            const previous = current[i];
            return (
              previous?.id === window.id &&
              previous.paneIds.length === window.paneIds.length &&
              previous.paneIds.every((paneId, j) => paneId === window.paneIds[j])
            );
          });
        return same ? current : next;
      });
    };
    sync();
    return controller.subscribe(sync);
  }, [controller]);

  return windows;
}

/**
 * When the last write actually landed, as an ISO string — or null until one
 * does this session.
 *
 * Read off the mutation cache rather than threaded through every save, so a
 * surface written next year reports here for free. Only successes count: a
 * failed save must never move the "Saved" clock forward, because that clock is
 * the answer to "did my work make it?".
 */
export function useLastSaved(): string | null {
  const queryClient = useQueryClient();
  const [at, setAt] = useState<string | null>(null);

  useEffect(() => {
    const cache = queryClient.getMutationCache();
    return cache.subscribe((event) => {
      if (event.mutation?.state.status !== 'success') return;
      // Only the operator's OWN writes count. The app makes its own — a visit
      // ping on every pane opened, chief among them — and counting those made
      // the strip announce "Saved just now" within a second of boot, before
      // anybody had saved anything. This is the one place people look to check
      // their work is safe, so it must never report a save that is not theirs.
      // The flag is set on the mutation; see lib/api/write-meta.ts.
      if (readWriteMeta(event.mutation.meta).housekeeping === true) return;
      setAt(new Date().toISOString());
    });
  }, [queryClient]);

  return at;
}

/**
 * A value that changes every tick, purely to re-render relative timestamps.
 *
 * Returned rather than ignored so the caller has something to depend on —
 * a hook whose only job is a side effect on the render loop is too easy for a
 * later reader (or a linter) to delete as dead.
 */
export function useAgoTick(active: boolean): number {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => {
      setTick((value) => value + 1);
    }, AGO_TICK_MS);
    return () => {
      clearInterval(timer);
    };
  }, [active]);

  return tick;
}
