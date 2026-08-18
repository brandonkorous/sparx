'use client';

// Which pane a piece of chrome is inside.
//
// The same problem the beta notice solved (see components/module-beta-notice.tsx)
// and the same answer: context, so shared chrome mounted deep inside a surface
// can know which pane it belongs to without all 233 surfaces threading their own
// pane id down to it. A prop would work exactly once and then have to be added
// again for the next piece of chrome.
//
// It carries the id rather than the descriptor: the descriptor changes when a
// surface renames its tab, and chrome that re-rendered on every retitle would be
// paying for a fact it does not use. Whoever needs the descriptor reads it live
// from the controller, which is the one place it is authoritative anyway.

import { createContext, useContext, type ReactNode } from 'react';

const PaneIdContext = createContext<string | null>(null);

export function PaneIdentityProvider({
  paneId,
  children,
}: {
  paneId: string;
  children: ReactNode;
}) {
  return <PaneIdContext.Provider value={paneId}>{children}</PaneIdContext.Provider>;
}

/** The pane this chrome is inside, or null when it is not inside one. */
export function usePaneId(): string | null {
  return useContext(PaneIdContext);
}
