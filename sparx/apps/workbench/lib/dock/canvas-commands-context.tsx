'use client';

// The canvas commands, for the chrome dockview renders. A title bar is mounted by
// dockview rather than by the shell, so a prop cannot reach it; context crosses the
// portal (the same reason as ../window-mode-context.tsx).

import { createContext, useContext, type ReactNode } from 'react';
import type { CanvasCommands } from './use-canvas-commands';

const CanvasCommandsContext = createContext<CanvasCommands | null>(null);

export function CanvasCommandsProvider({
  commands,
  children,
}: {
  commands: CanvasCommands;
  children: ReactNode;
}) {
  return (
    <CanvasCommandsContext.Provider value={commands}>{children}</CanvasCommandsContext.Provider>
  );
}

/** Null outside a console dock (a popout window, say). */
export function useCanvasCommandsContext(): CanvasCommands | null {
  return useContext(CanvasCommandsContext);
}
