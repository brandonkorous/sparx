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

import { createContext, useContext, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
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

/** How often a tab re-asks whether its pane is dirty. Matches the status bar's
 *  cadence deliberately: the two indicators answer the same question, and a tab
 *  showing a dot while the bar's count disagrees reads as a bug. */
const DIRTY_POLL_MS = 1500;

/**
 * Whether ONE pane currently holds unsaved work — for a tab's indicator.
 *
 * Polled for the same reason the status bar polls: guards are pull-based
 * closures, and nothing fires when a form flips dirty. The cost is one function
 * call per pane per tick, which is why each tab can afford to ask for itself
 * rather than subscribing to a list it would have to search anyway.
 */
export function usePaneDirty(paneId: string): boolean {
  const { controller } = useWorkbench();
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    const sync = () => {
      setDirty(controller.isPaneDirty(paneId));
    };
    sync();
    const timer = setInterval(sync, DIRTY_POLL_MS);
    return () => {
      clearInterval(timer);
    };
  }, [controller, paneId]);

  return dirty;
}
