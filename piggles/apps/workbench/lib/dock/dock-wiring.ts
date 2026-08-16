'use client';

// What mounting the dock actually involves: configure it, restore what was open,
// subscribe to it. Three calls in console-dock, three functions here — each one
// carrying the reasoning for a decision that has already been got wrong once.

import type { DockviewApi } from 'dockview';
import { loadLayout } from '@/lib/workbench/persistence';
import type { WorkbenchController } from '@/lib/workbench/controller';
import type { PaneDescriptor } from '@/lib/surfaces/descriptor';
import { DEFAULT_LAYOUT } from './default-layout';
import { PIGGLES_DOCK_THEME } from '../dock-theme';

/**
 * The theme and the bounds, through the api rather than props — `<DockviewReact
 * theme={…}>` typechecks and is silently discarded (see console-dock's header).
 * Called BEFORE any restore so groups are built with both already in force.
 */
export function configureDock(api: DockviewApi): void {
  api.updateOptions({
    theme: PIGGLES_DOCK_THEME,
    // A window stays in the workspace. dockview's default only guarantees a
    // sliver stays inside, so a window dragged left buries the app rail — this
    // product's navigation, which then cannot be used to get out from under it.
    floatingGroupBounds: 'boundedWithinViewport',
  });
}

/** The saved arrangement, or a fresh workspace when there is not one. */
export function restoreOrDefault(
  api: DockviewApi,
  controller: WorkbenchController,
  siteKey: string
): void {
  const stored = loadLayout(siteKey);
  if (!stored) {
    openDefaultLayout(controller);
    return;
  }

  // Descriptors FIRST — dockview mounts every pane synchronously while
  // deserializing, and each one resolves its descriptor on mount.
  controller.hydrate(stored.panes);
  try {
    api.fromJSON(stored.grid as Parameters<DockviewApi['fromJSON']>[0]);
    adoptPanesMissingFromGrid(api, controller, stored.panes);
  } catch (error) {
    // A layout saved by an older build can fail to deserialize. Falling back to
    // the default beats a blank screen nobody can escape.
    console.warn('[piggles] could not restore layout; starting fresh', error);
    openDefaultLayout(controller);
  }
}

function openDefaultLayout(controller: WorkbenchController): void {
  controller.hydrate({});
  DEFAULT_LAYOUT.forEach((entry) => controller.open(entry.surface, entry.params));
}

/**
 * Re-opens panes that exist in the saved SET but not in the saved GRID.
 *
 * The compact shell has no grid to write, so a pane opened on a phone has a
 * descriptor and no slot. Replaying only the grid would drop it silently.
 */
function adoptPanesMissingFromGrid(
  api: DockviewApi,
  controller: WorkbenchController,
  panes: Record<string, PaneDescriptor>
): void {
  for (const descriptor of Object.values(panes)) {
    if (api.getPanel(descriptor.id)) continue;
    controller.open(descriptor.surface, descriptor.params, { focus: false });
  }
}

export interface DockSubscriptionOptions {
  controller: WorkbenchController;
  persist: () => void;
  /** Runs one tick after a group is added, once dockview has settled it. */
  onGroupSettled: () => void;
}

/** dockview doesn't export IDisposable, so derive it from a subscription. */
type DockDisposable = ReturnType<DockviewApi['onDidLayoutChange']>;

export function subscribeDock(
  api: DockviewApi,
  { controller, persist, onGroupSettled }: DockSubscriptionOptions
): DockDisposable[] {
  return [
    // A pane closed by the tab's × bypasses controller.close(), so reconcile
    // here rather than leaking descriptors and guards for dead panes.
    api.onDidRemovePanel((panel) => {
      controller.forget(panel.id);
      persist();
    }),
    api.onDidLayoutChange(persist),
    api.onDidActivePanelChange((panel) => {
      controller.setActivePane(panel?.id ?? null);
    }),
    // Tearing a pane off (or dismissing a popout) adds/removes a GROUP, not a
    // panel — so the status bar's detached-windows chip needs these two.
    api.onDidAddGroup(() => {
      controller.hostChanged();
      // dockview fires this while still CREATING the group, so its location can
      // read 'grid' at this instant. One deferred pass settles on the real one.
      setTimeout(() => {
        controller.hostChanged();
        onGroupSettled();
      }, 0);
    }),
    api.onDidRemoveGroup(() => {
      controller.hostChanged();
    }),
  ];
}
