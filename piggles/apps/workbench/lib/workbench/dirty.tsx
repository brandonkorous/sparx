'use client';

// Unsaved work, declared from wherever it actually lives.
//
// The original contract was one guard per pane: a surface called ctx.guard(() =>
// dirty) and that was the pane's answer. It was wrong in a way that only showed
// up in a browser — a modal's in-progress state is not the surface's state, so
// the invoice editor could report "clean" while its line composer held a fully
// typed line, and closing the pane threw it away without asking. The bug was not
// that someone forgot to register; it was that the contract had nowhere to say
// it. A nested editor could not contribute an answer even in principle.
//
// So dirtiness is a SET of sources per pane (see controller.registerGuard), and
// this is how a component joins that set. Any depth, no prop drilling, no ctx:
//
//   useDirtySource(dirty, 'This invoice has unsaved changes. Close it anyway?');
//
// Mount <DirtyScope paneId> once per pane and every descendant can speak for
// itself — which is what makes a picker three components deep able to protect
// its own work without the surface above it knowing the picker exists.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useSyncExternalStore,
} from 'react';
import type { ReactNode } from 'react';
import type { PaneDescriptor } from '../surfaces/descriptor';
import type { WorkbenchController } from './controller';
import { useWorkbench } from './context';

const PaneIdContext = createContext<string | null>(null);

/** Marks the subtree belonging to one pane, so dirty sources inside know where
 *  to register. Mounted by SurfaceMount; nothing else should need it. */
export function DirtyScope({ paneId, children }: { paneId: string; children: ReactNode }) {
  return <PaneIdContext.Provider value={paneId}>{children}</PaneIdContext.Provider>;
}

/** The pane a component is rendering inside, or null in the shell's own chrome. */
export function usePaneId(): string | null {
  return useContext(PaneIdContext);
}

// Distinguishes concurrent sources within one pane. Never persisted and never a
// React key — a plain counter is honest here, unlike the builder's node ids.
let sourceCounter = 0;

/**
 * Declares that this component is holding unsaved work.
 *
 * Registers for as long as the component is mounted and withdraws on unmount, so
 * a closed modal stops claiming the pane automatically — there is no "clear the
 * flag" step to forget on the path that matters.
 *
 * `message` is what the operator is asked when this source is the one at risk.
 * Write it about the thing being lost ("a line you haven't added yet"), not
 * about the pane.
 */
export function useDirtySource(dirty: boolean, message?: string): void {
  const { controller } = useWorkbench();
  const paneId = usePaneId();
  // Read through a ref so the registered closure always sees the CURRENT value.
  // Registering `() => dirty` directly would freeze the first render's answer and
  // the guard would report clean forever — the exact failure this file exists to
  // stop, reintroduced one layer down.
  const dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;
  const sourceIdRef = useRef<string | null>(null);
  sourceIdRef.current ??= `source-${String(++sourceCounter)}`;

  useEffect(() => {
    // Outside a pane there is nothing to guard — the shell's own chrome has no
    // close path of its own. Silently inert rather than throwing: a component
    // reused in both places should not have to know which it is in.
    if (!paneId) return;
    const sourceId = sourceIdRef.current ?? 'source-0';
    return controller.registerGuard(paneId, sourceId, () => dirtyRef.current, message);
  }, [controller, paneId, message]);
}

/** How often the workbench re-asks which panes are dirty. Matches the status
 *  bar's cadence deliberately: the two indicators answer the same question, and
 *  a tab showing a dot while the bar's count disagrees reads as a bug. */
const DIRTY_POLL_MS = 1500;

/**
 * ONE poll for the whole window, however many tabs are open.
 *
 * This used to be an interval per tab, and the reasoning written here was that
 * "one function call per pane per tick" is nothing — true of one tab and false
 * of the tab strip as a whole. An operator with 134 panes restored was running
 * 134 timers, ~90 callbacks a second, each walking that pane's guards: a cost
 * that grew with exactly the thing the workbench encourages you to accumulate.
 *
 * Now one timer walks every guard ONCE per tick and hands out the answer. The
 * timer only runs while something is subscribed, so a window with no tab strip
 * (a lone popout) polls not at all.
 *
 * Kept per-controller rather than module-global because a torn-off window has
 * its own React root but shares this controller — a WeakMap gets that right in
 * both directions without either side having to know which case it is in.
 */
class DirtyPoll {
  private readonly listeners = new Set<() => void>();
  private timer: ReturnType<typeof setInterval> | null = null;
  private panes: PaneDescriptor[] = [];
  private ids: ReadonlySet<string> = new Set<string>();

  constructor(private readonly controller: WorkbenchController) {}

  /** Stable identity — useSyncExternalStore re-subscribes when this changes. */
  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    if (this.timer === null) {
      this.sync();
      this.timer = setInterval(() => {
        this.sync();
      }, DIRTY_POLL_MS);
    }
    return () => {
      this.listeners.delete(listener);
      if (this.listeners.size === 0 && this.timer !== null) {
        clearInterval(this.timer);
        this.timer = null;
      }
    };
  };

  isDirty(paneId: string): boolean {
    return this.ids.has(paneId);
  }

  /** The same array identity until the SET of dirty panes actually changes, so
   *  a subscriber can return it straight from a snapshot without looping. */
  dirtyPanes(): PaneDescriptor[] {
    return this.panes;
  }

  /** Re-read now instead of waiting for the next tick. Closing a pane changes
   *  the list without any guard changing, and up to 1.5s of a closed pane still
   *  listed as unsaved reads as a bug. */
  refresh(): void {
    this.sync();
  }

  private sync(): void {
    const next = this.controller.dirtyPanes();
    const same =
      next.length === this.panes.length && next.every((pane, i) => pane.id === this.panes[i]?.id);
    if (same) return;
    this.panes = next;
    this.ids = new Set(next.map((pane) => pane.id));
    for (const listener of this.listeners) listener();
  }
}

const POLLS = new WeakMap<WorkbenchController, DirtyPoll>();

function pollFor(controller: WorkbenchController): DirtyPoll {
  let poll = POLLS.get(controller);
  if (!poll) {
    poll = new DirtyPoll(controller);
    POLLS.set(controller, poll);
  }
  return poll;
}

/** Whether ONE pane currently holds unsaved work — for a tab's indicator. */
export function usePaneDirty(paneId: string): boolean {
  const { controller } = useWorkbench();
  const poll = pollFor(controller);
  const snapshot = useCallback(() => poll.isDirty(paneId), [poll, paneId]);
  // The server never has a tab strip; false is the honest answer there and it
  // matches what the first client tick reports for a freshly restored pane.
  return useSyncExternalStore(poll.subscribe, snapshot, () => false);
}

/**
 * Every pane holding unsaved work — the status bar's list.
 *
 * Reads the SAME tick as the tabs, which is what keeps the bar's count and the
 * dots on the tabs from disagreeing. It also subscribes to the controller
 * itself: a pane closing changes the list without any guard changing, and
 * waiting up to 1.5s to drop a pane that is already gone looks like a bug.
 */
export function useDirtyPaneList(): PaneDescriptor[] {
  const { controller } = useWorkbench();
  const poll = pollFor(controller);
  const subscribe = useCallback(
    (listener: () => void) => {
      const stopPoll = poll.subscribe(listener);
      // Refresh rather than notify: the poll's own diff decides whether this
      // actually changed anything, so a close that removes no dirty pane costs
      // one walk and no render.
      const stopController = controller.subscribe(() => {
        poll.refresh();
      });
      return () => {
        stopPoll();
        stopController();
      };
    },
    [poll, controller]
  );
  const snapshot = useCallback(() => poll.dirtyPanes(), [poll]);
  return useSyncExternalStore(subscribe, snapshot, EMPTY_PANES);
}

const NO_PANES: PaneDescriptor[] = [];
function EMPTY_PANES(): PaneDescriptor[] {
  return NO_PANES;
}
