'use client';

// Workbench context — how a surface reaches the app around it.
//
// A surface gets exactly one handle (SurfaceContext) and it comes from here.
// There is no escape hatch to the dock, the window manager, or a sibling pane,
// because the moment one exists surfaces start arranging each other and the
// operator stops being in charge of their own screen.

import { createContext, useContext, useMemo, useRef, useSyncExternalStore } from 'react';
import type { ReactNode } from 'react';
import { SURFACE_DIRTY_SOURCE, WorkbenchController } from './controller';
import type { OpenOptions, SurfaceContext } from '../surfaces/registry';
import type { PaneDescriptor, SurfaceParams } from '../surfaces/descriptor';

interface WorkbenchValue {
  controller: WorkbenchController;
  /** This window's id — panes render differently in a detached window (no launcher rail). */
  windowId: string;
  role: 'main' | 'detached';
}

const WorkbenchCtx = createContext<WorkbenchValue | null>(null);

export function WorkbenchProvider({
  windowId,
  role,
  children,
}: {
  windowId: string;
  role: 'main' | 'detached';
  children: ReactNode;
}) {
  // One controller per window, stable for the window's life.
  const controllerRef = useRef<WorkbenchController | null>(null);
  controllerRef.current ??= new WorkbenchController();

  const value = useMemo<WorkbenchValue>(
    // Non-null: the ??= above guarantees it, but the ref's type stays nullable
    // because useRef can't express "initialised on first render".
    () => ({ controller: controllerRef.current!, windowId, role }),
    [windowId, role]
  );

  return <WorkbenchCtx.Provider value={value}>{children}</WorkbenchCtx.Provider>;
}

export function useWorkbench(): WorkbenchValue {
  const value = useContext(WorkbenchCtx);
  if (!value) {
    throw new Error('useWorkbench must be used inside <WorkbenchProvider>.');
  }
  return value;
}

/** Live view of every open pane in this window — drives the pane switcher and overview. */
export function useOpenPanes(): PaneDescriptor[] {
  const { controller } = useWorkbench();
  const snapshot = useSyncExternalStore(
    controller.subscribe,
    () => controller.snapshotDescriptors(),
    // Server snapshot: no panes exist until the dock mounts in the browser.
    () => ({})
  );
  return useMemo(() => Object.values(snapshot), [snapshot]);
}

/**
 * Builds the handle handed to one surface. Memoised on the pane id so a surface
 * doesn't re-render every time an unrelated pane opens.
 */
export function useSurfaceContext(descriptor: PaneDescriptor): SurfaceContext {
  const { controller } = useWorkbench();

  return useMemo<SurfaceContext>(
    () => ({
      descriptor,
      params: descriptor.params ?? {},
      open: (surface: string, params?: SurfaceParams, options?: OpenOptions) => {
        controller.open(surface, params, { ...options, fromPaneId: descriptor.id });
      },
      setTitle: (title: string) => {
        controller.setTitle(descriptor.id, title);
      },
      close: () => {
        controller.close(descriptor.id);
      },
      // The imperative form, kept for surfaces that need to register outside
      // React's render cycle. Registers under the fixed surface source id, so
      // it is ONE of a pane's dirty sources rather than the only one — a nested
      // editor adds its own via useDirtySource. Prefer that hook in a component.
      guard: (isDirty: () => boolean, message?: string) =>
        controller.registerGuard(descriptor.id, SURFACE_DIRTY_SOURCE, isDirty, message),
    }),
    [controller, descriptor]
  );
}
