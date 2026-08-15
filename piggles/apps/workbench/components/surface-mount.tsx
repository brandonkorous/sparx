'use client';

// Mounting a surface — everything both presentations do identically.
//
// Resolve a pane id to a descriptor, the descriptor to a registered surface,
// and mount it inside its own module scope, error boundary, and confirm
// bridge. Per-pane isolation is the point: one surface throwing must take out
// one pane, not the operator's whole arrangement.
//
// This lives outside lib/dock deliberately. It used to BE the dock's pane, and
// leaving it there would have meant the mobile stack either imported from the
// dock (a presentation depending on a rival presentation) or grew a second copy
// of the error boundary that then drifted. The dock now supplies the two things
// that really are dockview's — the window boundary for torn-off panes, and how
// a reset is triggered — and this owns the rest.

import { Component, Suspense, useEffect, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@wizeworks/silicaui-react';
import { useConfirm } from '../lib/confirm';
import { isChunkLoadError, reloadOnceForStaleBuild } from '@sparx/app-kit';
import { productName } from '../lib/product';
import { reportCrash } from '../lib/analytics';
import { PaneModuleProvider } from './module-beta-notice';
import { ModuleScope } from './module-scope';
import { PaneWaiting } from './pane-waiting';
import { getSurface } from '../lib/surfaces/registry';
import { useSurfaceContext, useWorkbench } from '../lib/workbench/context';
import { DirtyScope } from '../lib/workbench/dirty';
import { PaneIdentityProvider } from '../lib/workbench/pane-identity';

interface PaneErrorBoundaryProps {
  children: ReactNode;
  onReset: () => void;
  /** Which surface crashed. Carried into the crash report — "a pane threw" is
   *  true of every one of these and tells us nothing about which to go fix. */
  readonly surface: string;
}

export class PaneErrorBoundary extends Component<PaneErrorBoundaryProps, { error: Error | null }> {
  override state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[workbench] pane crashed', error, info.componentStack);
    // Reported as well as logged: this boundary RECOVERS, so the crash produces
    // no unhandled rejection and nothing autocapture would see. A pane that
    // reliably falls over is otherwise only ever discovered by the operator
    // living with it. See lib/analytics.ts.
    reportCrash(error, { boundary: 'pane', surface: this.props.surface });
    // A release purged the chunk this pane's surface needed. onReset() re-mounts
    // the same dead import, so per-pane isolation has nothing left to isolate —
    // only a full reload fetches the new build. Shared cooldown with
    // ChunkReloadGuard and the route boundaries stops a broken build looping.
    if (isChunkLoadError(error)) reloadOnceForStaleBuild();
  }

  override render() {
    if (!this.state.error) return this.props.children;
    const stale = isChunkLoadError(this.state.error);

    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
        <AlertTriangle className="text-warning size-6" aria-hidden />
        <div>
          <p className="font-medium">
            {stale ? `A new version of ${productName()} is ready` : 'This panel ran into a problem'}
          </p>
          <p className="mt-1 text-sm">
            {stale
              ? 'This tab was left open across an update. Reload to load the latest version — your panel arrangement comes back.'
              : 'Nothing else in your workspace was affected. Try loading it again.'}
          </p>
        </div>
        {stale ? (
          <Button color="primary" size="sm" onClick={() => window.location.reload()}>
            Reload
          </Button>
        ) : (
          <Button
            color="neutral"
            variant="outline"
            size="sm"
            onClick={() => {
              this.setState({ error: null });
              this.props.onReset();
            }}
          >
            Try again
          </Button>
        )}
      </div>
    );
  }
}

export function MissingSurface({ surface }: { surface: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center">
      <p className="font-medium">This panel is no longer available</p>
      <p className="max-w-sm text-sm">
        It was saved in your workspace but the feature it showed has since moved. You can close this
        panel — the rest of your layout is unaffected.
      </p>
      <code className="mt-1 font-mono text-sm">{surface}</code>
    </div>
  );
}

/**
 * Registers this pane's "are you sure" with the controller. On the dock it sits
 * INSIDE the pane's window boundary, so the dialog resolves the PANE-level
 * provider and appears in whichever window the pane occupies — closing a dirty
 * pane on a second monitor must ask on that monitor, not in the opener.
 */
export function PaneConfirmBridge({ paneId }: { paneId: string }) {
  const { controller } = useWorkbench();
  const confirm = useConfirm();

  useEffect(
    () =>
      controller.setConfirmDelegate(paneId, (message) =>
        confirm({
          title: 'Unsaved changes',
          description: message,
          confirmLabel: 'Close anyway',
          cancelLabel: 'Keep working',
          color: 'danger',
        })
      ),
    [controller, paneId, confirm]
  );

  return null;
}

/** The surface itself. Split out so the context hook sits below the boundary. */
export function SurfaceBody({ paneId }: { paneId: string }) {
  const { controller } = useWorkbench();
  const descriptor = controller.getDescriptor(paneId);
  const ctx = useSurfaceContext(descriptor ?? { id: paneId, surface: 'unknown' });

  if (!descriptor) return <MissingSurface surface={paneId} />;
  const definition = getSurface(descriptor.surface);
  if (!definition) return <MissingSurface surface={descriptor.surface} />;

  const Surface = definition.component;
  return <Surface ctx={ctx} />;
}

/**
 * A mounted surface, module-scoped and crash-isolated.
 *
 * `boundary` is how the dock injects its window boundary without this file
 * importing dockview: the dock passes a wrapper, the mobile stack passes
 * nothing (it has exactly one window, so there is nothing to portal across).
 */
export function SurfaceMount({
  paneId,
  onReset,
  boundary,
}: {
  paneId: string;
  onReset: () => void;
  boundary?: (children: ReactNode) => ReactNode;
}) {
  const { controller } = useWorkbench();
  const descriptor = controller.getDescriptor(paneId);

  if (!descriptor) return <MissingSurface surface={paneId} />;

  const definition = getSurface(descriptor.surface);
  if (!definition) return <MissingSurface surface={descriptor.surface} />;

  const inner = (
    // DirtyScope wraps the whole pane body so ANY descendant — the surface, a
    // modal it opens, a picker inside that modal — can declare unsaved work
    // without being handed the pane id. See lib/workbench/dirty.tsx.
    <DirtyScope paneId={paneId}>
      <PaneConfirmBridge paneId={paneId} />
      {/* Which module this pane belongs to, for chrome rendered deep inside the
          surface that would otherwise have to be handed it by every surface in
          turn (the beta notice under PaneToolbar). Renders no DOM. */}
      <PaneModuleProvider module={definition.module}>
        {/* And which pane, for chrome that needs to name THIS pane rather than
            this module — the copy-link control in the toolbar. Same reasoning,
            same shape, no DOM. */}
        <PaneIdentityProvider paneId={paneId}>
          <PaneErrorBoundary onReset={onReset} surface={descriptor.surface}>
            <Suspense fallback={<PaneWaiting />}>
              <SurfaceBody paneId={paneId} />
            </Suspense>
          </PaneErrorBoundary>
        </PaneIdentityProvider>
      </PaneModuleProvider>
    </DirtyScope>
  );

  return (
    // The module scope must wrap the surface in the DOM, not just the React
    // tree: CSS custom properties cascade by DOM, and a detached pane renders
    // into a different document entirely.
    // base-200, one step down from the base-100 cards a surface puts on it —
    // without the step the two are the same value and a card has no edge to
    // read against. A surface that wants an unbroken sheet (an editor canvas,
    // a full-bleed table) sets its own background.
    <ModuleScope module={definition.module} className="bg-base-200 h-full min-h-0 overflow-hidden">
      {boundary ? boundary(inner) : inner}
    </ModuleScope>
  );
}
