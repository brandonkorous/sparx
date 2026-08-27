'use client';

// The pane host — what dockview actually renders in every tab.
//
// Thin on purpose. Resolving a pane to a surface, module scoping, crash
// isolation and the confirm bridge are identical in both presentations and live
// in components/surface-mount.tsx; what remains here is the three things that
// are genuinely dockview's: the window boundary that follows a torn-off pane
// into its own document, how a crashed pane is asked to remount, and WHEN the
// surface inside is mounted at all (see pane-liveness).
//
// The mobile stack needs none of that third one — it already renders only the
// pane on top.

import type { IDockviewPanelProps } from 'dockview';
import { SurfaceMount } from '../../components/surface-mount';
import { PaneWindowBoundary } from './window-boundary';
import { usePaneAwake } from './pane-liveness';

/**
 * Registered with dockview as the `surface` component. dockview hands us only
 * the pane id via params; the descriptor lives in the controller so that layout
 * (dockview's job) and meaning (ours) stay cleanly separated.
 */
export function Pane(props: IDockviewPanelProps<{ paneId: string; revision?: number }>) {
  const paneId = props.params.paneId;
  const awake = usePaneAwake(props.api, paneId);

  // A sleeping pane still owns its space, so it paints the surface ground
  // rather than nothing — otherwise waking would flash the dock's own color
  // through for a frame. There is deliberately no label and no spinner: the
  // pane is either off screen, where nobody can read one, or a frame away from
  // being real, where one would be noise about an implementation detail.
  if (!awake) return <div className="bg-base-200 h-full" />;

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
