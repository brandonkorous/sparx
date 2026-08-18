'use client';

// Which screens are OPEN, and which one is being looked at.
//
// ── WHY THE PANEL IS ALLOWED TO KNOW THIS ───────────────────────────────────
//
// The navigation panel is a BROWSER, not a mirror (components/app-panel.tsx):
// picking Sell means "show me what Sell has", and it deliberately does not
// follow the focused pane around. That decision stands. This is a different
// fact from the one it rejects.
//
// "Which app am I browsing" is a navigation POSITION, and reflecting the dock
// there would take the browser away. "Is this screen already open" is a
// property of the row itself — the same kind of thing as its badge count — and
// answering it costs the panel none of its independence. A person with panes
// from five apps on screen has no single "here", but every row can still say
// whether it is one of the five.
//
// Without it the navigation was the only part of the console that behaved as
// though nothing was open: clicking an open screen silently focused the pane
// you already had, with nothing beforehand to say it would.

import { useMemo } from 'react';
import { useSyncExternalStore } from 'react';
import { useWorkbench } from '@/lib/workbench/context';

export interface OpenSurfaces {
  /** Surface keys with at least one pane open, in any window this shell owns. */
  readonly open: ReadonlySet<string>;
  /** The surface key of the focused pane, or null when nothing has focus. */
  readonly focused: string | null;
}

const NONE: OpenSurfaces = { open: new Set(), focused: null };

/**
 * Keyed by SURFACE, not by pane. Two panes of one surface (a deliberate
 * side-by-side compare) are one open row — the row's question is "is this
 * screen open", which has no plural.
 */
export function useOpenSurfaces(): OpenSurfaces {
  const { controller } = useWorkbench();

  const panes = useSyncExternalStore(
    controller.subscribe,
    () => controller.snapshotDescriptors(),
    // No panes exist until the dock mounts in the browser.
    () => null
  );

  const activeSurface = useSyncExternalStore(
    controller.subscribe,
    () => controller.getActiveDescriptor()?.surface ?? null,
    () => null
  );

  return useMemo(() => {
    if (!panes) return NONE;
    const open = new Set(Object.values(panes).map((descriptor) => descriptor.surface));
    return { open, focused: activeSurface };
  }, [panes, activeSurface]);
}
