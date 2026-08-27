'use client';

// Whether a pane's surface is MOUNTED, which is not the same as whether the
// pane is open.
//
// ── WHY THIS EXISTS ────────────────────────────────────────────────────────
//
// dockview creates every panel up front. Its `onlyWhenVisible` renderer — the
// default, and what this dock uses — decides where a panel's element SITS, not
// whether React mounts it: `ReactPanelContentPart.init()` runs at panel
// creation. So restoring a saved layout mounted every surface in it at once.
//
// That is fine at five panes and fatal at a hundred. An operator with 134 panes
// saved opened the workbench, and it mounted 134 surfaces, fired well over a
// hundred API calls in one breath, and killed the browser tab outright. Every
// route was affected, not just the one that had the panes on it, because the
// arrangement is restored before anything renders — so there was no way to
// click past it from inside the app, and the reset control lives inside it.
//
// The fix is two rules, and neither of them closes a pane:
//
//   1. A pane mounts the first time it is actually LOOKED AT. A restored pane
//      nobody opened was never opened, so nothing is lost by not building it.
//   2. A pane that has been out of sight for a while, and holds no unsaved
//      work, unmounts again. Its tab, its title and its place in the layout all
//      stay exactly where they were; looking at it builds it back.
//
// ── WHAT MAKES THIS SAFE ───────────────────────────────────────────────────
//
// The dirty registry already answers the only question that matters: a pane
// with a live dirty source is holding work that exists nowhere else, and
// unmounting it would destroy that work silently. So dirtiness is an absolute
// veto here, checked at the moment of sleeping rather than when the timer was
// set — a pane that goes dirty while hidden keeps itself alive.
//
// What is NOT protected, and is worth saying out loud: scroll position, and any
// view state a surface keeps in local state rather than in its pane params.
// Waking is a fresh mount, so those reset. That is the same bargain a browser
// makes when it discards a background tab, and the same one dockview would make
// if it did this itself.

import { useEffect, useState } from 'react';
import type { DockviewPanelApi } from 'dockview';
import type { WorkbenchController } from '../workbench/controller';
import { useWorkbench } from '../workbench/context';

/**
 * How long a hidden, clean pane stays mounted before it is let go.
 *
 * Tied to the query client's `gcTime` (5 minutes) on purpose rather than picked
 * for feel: past that point a woken pane refetches anyway, so whatever it was
 * holding in memory had already stopped being worth anything. Sleeping at
 * roughly the same mark costs nothing that was not already being paid.
 */
const HIBERNATE_AFTER_MS = 5 * 60_000;

/**
 * The most surfaces allowed to be mounted at once, as a backstop.
 *
 * Hibernation bounds the steady state by TIME, which leaves one case open:
 * somebody working fast enough to touch thirty panes inside five minutes has
 * thirty mounted, all of them legitimately recent. This is the ceiling for
 * that.
 *
 * Twelve, not five. A cap low enough to bite normal work thrashes — with two
 * working sets either side of it, every switch evicts what the next switch
 * needs — so it is set well above what anyone reads at once and exists only to
 * stop the number running away. Nothing VISIBLE is ever evicted, however many
 * panes are on screen: a split with twenty visible panes keeps all twenty,
 * because the operator is looking at them.
 */
const MAX_LIVE_PANES = 12;

/**
 * Which panes are mounted, most-recently-seen first.
 *
 * Cross-pane, so it cannot live in a hook: waking pane A is what puts pane L
 * over the ceiling, and A has no way to reach L on its own. One registry per
 * controller, for the same reason the dirty poll is — a torn-off window has its
 * own React root and shares the controller, and both cases want one ceiling
 * across all of them rather than one each.
 */
class LivenessRegistry {
  /** Insertion order IS the recency order: re-waking deletes and re-adds. */
  private readonly live = new Map<string, LivePane>();

  constructor(private readonly controller: WorkbenchController) {}

  register(paneId: string, pane: LivePane): void {
    this.live.delete(paneId);
    this.live.set(paneId, pane);
    this.enforceCeiling();
  }

  release(paneId: string): void {
    this.live.delete(paneId);
  }

  private enforceCeiling(): void {
    if (this.live.size <= MAX_LIVE_PANES) return;
    // Oldest first, and only ever a pane that is out of sight and holds nothing
    // unsaved. Both are hard refusals, not preferences: evicting a visible pane
    // would blank a surface somebody is reading, and evicting a dirty one would
    // destroy work. If every candidate refuses, the ceiling simply does not
    // apply right now — which is the correct answer, not a failure.
    for (const [paneId, pane] of this.live) {
      if (this.live.size <= MAX_LIVE_PANES) return;
      if (pane.isVisible()) continue;
      if (this.controller.isPaneDirty(paneId)) continue;
      this.live.delete(paneId);
      pane.sleep();
    }
  }
}

interface LivePane {
  isVisible: () => boolean;
  sleep: () => void;
}

const REGISTRIES = new WeakMap<WorkbenchController, LivenessRegistry>();

function registryFor(controller: WorkbenchController): LivenessRegistry {
  let registry = REGISTRIES.get(controller);
  if (!registry) {
    registry = new LivenessRegistry(controller);
    REGISTRIES.set(controller, registry);
  }
  return registry;
}

/**
 * Whether this pane's surface should be mounted right now.
 *
 * False before a pane has ever been visible, and false again once it has been
 * hidden long enough with nothing unsaved in it. True the instant it becomes
 * visible, so waking is part of the same commit that shows the pane rather than
 * a flash of something else.
 */
export function usePaneAwake(api: DockviewPanelApi, paneId: string): boolean {
  const { controller } = useWorkbench();
  const registry = registryFor(controller);
  const [awake, setAwake] = useState(false);

  useEffect(() => {
    let live = true;
    let sleepTimer: ReturnType<typeof setTimeout> | null = null;

    const cancelSleep = () => {
      if (sleepTimer === null) return;
      clearTimeout(sleepTimer);
      sleepTimer = null;
    };

    const wake = () => {
      cancelSleep();
      setAwake(true);
      registry.register(paneId, {
        isVisible: () => api.isVisible,
        sleep: () => {
          if (!live) return;
          cancelSleep();
          setAwake(false);
        },
      });
    };

    const scheduleSleep = () => {
      cancelSleep();
      sleepTimer = setTimeout(() => {
        sleepTimer = null;
        if (!live) return;
        // Checked NOW, not when the timer was set: a pane can go dirty while
        // hidden (a background save failing, an editor left mid-word before the
        // tab was switched), and the answer that matters is the current one.
        if (controller.isPaneDirty(paneId)) {
          scheduleSleep();
          return;
        }
        registry.release(paneId);
        setAwake(false);
      }, HIBERNATE_AFTER_MS);
    };

    const settle = (visible: boolean) => {
      if (!live) return;
      if (visible) wake();
      else scheduleSleep();
    };

    // The first read is DEFERRED, and that is the whole of rule 1. Restoring a
    // layout creates every panel before it arranges the groups, so `isVisible`
    // is optimistically true for a beat on panes that are about to be
    // background tabs — reading it synchronously would wake all of them and
    // change nothing. A timeout rather than an animation frame because a
    // workbench restored in a background browser tab still has to resolve: rAF
    // does not run there, and a pane that never wakes is a blank pane.
    const firstRead = setTimeout(() => {
      settle(api.isVisible);
    }, 0);

    const subscription = api.onDidVisibilityChange((event) => {
      settle(event.isVisible);
    });

    return () => {
      live = false;
      clearTimeout(firstRead);
      cancelSleep();
      subscription.dispose();
      // A closed pane must stop counting against the ceiling, or a long session
      // of opening and closing would starve the panes that are still open.
      registry.release(paneId);
    };
  }, [api, controller, registry, paneId]);

  return awake;
}
