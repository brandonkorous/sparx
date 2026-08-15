'use client';

// The pane host — what dockview actually renders in every tab.
//
// Thin on purpose. Resolving a pane to a surface, module scoping, crash
// isolation and the confirm bridge are identical in both presentations and live
// in components/surface-mount.tsx; what remains here is the two things that are
// genuinely dockview's: the window boundary that follows a torn-off pane into
// its own document, and how a crashed pane is asked to remount.

import type { IDockviewPanelProps } from 'dockview';
import { SurfaceMount } from '../../components/surface-mount';
import { PaneWindowBoundary } from './window-boundary';

/**
 * Registered with dockview as the `surface` component. dockview hands us only
 * the pane id via params; the descriptor lives in the controller so that layout
 * (dockview's job) and meaning (ours) stay cleanly separated.
 */
export function Pane(props: IDockviewPanelProps<{ paneId: string; revision?: number }>) {
  const paneId = props.params.paneId;

  return (
    <SurfaceMount
      paneId={paneId}
      // Bumping a parameter is what makes dockview remount the pane body.
      onReset={() => {
        props.api.updateParameters({ paneId, revision: Date.now() });
      }}
      // Overlays (menus, dialogs, toasts) follow the pane into a torn-off
      // window instead of appearing in the opener.
      boundary={(children) => <PaneWindowBoundary api={props.api}>{children}</PaneWindowBoundary>}
    />
  );
}
