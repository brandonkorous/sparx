'use client';

// The dock — dockview wired to the workbench controller.
//
// dockview owns LAYOUT (the grid, tab strips, splitters, drag, popout windows).
// The controller owns MEANING (which surface a pane shows). Keeping that split
// clean is why the persisted payload has two halves: dockview's opaque `grid`
// blob and our `panes` map. Neither side needs to understand the other.

import { useCallback, useEffect, useRef } from 'react';
import { DockviewReact, type DockviewApi, type DockviewReadyEvent } from 'dockview';
import { useWorkbench } from '../workbench/context';
import { loadLayout, saveLayout } from '../workbench/persistence';
import type { WorkbenchController } from '../workbench/controller';
import { decodeDescriptor, type PaneDescriptor } from '../surfaces/descriptor';
import { DockPaneHost } from './dock-host';
import { GroupActions } from './group-actions';
import { Pane } from './pane';
import { PaneTab } from './pane-tab';
import { DEFAULT_LAYOUT } from './default-layout';
import 'dockview/dist/styles/dockview.css';
import './dock-theme.css';

const components = { surface: Pane };
const tabComponents = { surface: PaneTab };

/** Debounce layout writes — dragging a splitter fires continuously. */
const SAVE_DEBOUNCE_MS = 400;

/**
 * Re-opens panes that exist in the saved SET but not in the saved GRID.
 *
 * The two halves can legitimately disagree now that a phone can open a pane.
 * The stack has no grid to write, so it persists the pane set and leaves the
 * arrangement exactly as the desktop last left it — which means a pane opened
 * on a phone has a descriptor and no slot. Replaying only the grid would
 * silently drop it, so "open it on my phone, finish it at my desk" would lose
 * the thing you opened. They land as ordinary tabs, which is the honest answer:
 * the desktop never decided where they go, so it puts them somewhere sensible.
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

// A `?open=<surface>` deep link, captured once for this page load.
//
// The workbench is a single route with no per-surface URLs, so this is the only
// way a notification, an email reply link, or a shared "look at this" URL can
// land the operator on a specific pane (see descriptor.ts `encodeDescriptor`).
//
// It lives at module scope, not in a ref, because it must survive React
// strict-mode's mount→unmount→mount of the dock: `hydrate()` clears the
// controller's descriptors, so the pane the first `onReady` opened is gone by
// the second, and a ref would be reset with the remounted component. Captured
// once and re-applied on EACH `onReady` — exactly how DEFAULT_LAYOUT survives
// the same remount — then retired so a later site switch can't resurrect it.
// `null` = not captured yet; `[]` = captured (empty, or already retired).
let capturedDeepLinks: string[] | null = null;

/**
 * Open (or focus) the panes a `?open=` deep link asked for, after the layout is
 * restored. Opens rather than replaces, so the pane joins the restored layout
 * instead of wiping it; `controller.open` focuses an already-open match rather
 * than duplicating, and ignores an unknown key — so a stale link degrades to
 * "your layout, nothing added" instead of an error.
 */
function consumeDeepLink(controller: WorkbenchController): void {
  if (typeof window === 'undefined') return;

  if (capturedDeepLinks === null) {
    const url = new URL(window.location.href);
    capturedDeepLinks = url.searchParams.getAll('open');
    if (capturedDeepLinks.length > 0) {
      // Strip immediately so the URL stops advertising a one-shot intent as
      // durable state — but keep re-applying from the captured copy.
      url.searchParams.delete('open');
      window.history.replaceState(
        window.history.state,
        '',
        `${url.pathname}${url.search}${url.hash}`
      );
      // Retire the intent once the initial mount (and its strict-mode twin, a
      // few hundred ms apart at most) have settled, so switching sites later
      // doesn't reopen the deep-linked pane.
      const links = capturedDeepLinks;
      window.setTimeout(() => {
        if (capturedDeepLinks === links) capturedDeepLinks = [];
      }, 5000);
    }
  }

  for (const encoded of capturedDeepLinks) {
    const descriptor = decodeDescriptor(encoded);
    if (descriptor) controller.open(descriptor.surface, descriptor.params, { focus: true });
  }
}

export function Dock({ siteKey }: { siteKey: string }) {
  const { controller } = useWorkbench();
  const apiRef = useRef<DockviewApi | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // dockview doesn't export its IDisposable type, so derive it from an event
  // subscription's return rather than hand-rolling a structural duplicate.
  const disposables = useRef<ReturnType<DockviewApi['onDidLayoutChange']>[]>([]);

  const persist = useCallback(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      const api = apiRef.current;
      if (!api) return;
      saveLayout(siteKey, api.toJSON(), controller.snapshotDescriptors());
    }, SAVE_DEBOUNCE_MS);
  }, [controller, siteKey]);

  const onReady = useCallback(
    (event: DockviewReadyEvent) => {
      const api = event.api;
      apiRef.current = api;
      controller.attach(new DockPaneHost(api));

      const stored = loadLayout(siteKey);
      if (stored) {
        // Descriptors FIRST — dockview will synchronously mount every pane while
        // deserializing, and each one resolves its descriptor on mount.
        controller.hydrate(stored.panes);
        try {
          api.fromJSON(stored.grid as Parameters<DockviewApi['fromJSON']>[0]);
          adoptPanesMissingFromGrid(api, controller, stored.panes);
        } catch (error) {
          // A layout saved by an older build can fail to deserialize. Falling
          // back to the default beats a blank screen the operator can't escape.
          console.warn('[workbench] could not restore layout; starting fresh', error);
          controller.hydrate({});
          DEFAULT_LAYOUT.forEach((entry) => controller.open(entry.surface, entry.params));
        }
      } else {
        // Fresh boot: clear any descriptors surviving from a previous dockview
        // instance (strict-mode remount) so the defaults open cleanly instead
        // of deduping against panes that no longer exist.
        controller.hydrate({});
        DEFAULT_LAYOUT.forEach((entry) => controller.open(entry.surface, entry.params));
      }

      // Now that the layout is restored, honour a `?open=` deep link by adding
      // (or focusing) the requested pane on top of it.
      consumeDeepLink(controller);

      // A pane closed by the tab's × bypasses controller.close(), so reconcile
      // here rather than leaking descriptors and guards for dead panes.
      //
      // Disposables are parked on a ref rather than returned: onReady is a
      // callback, not an effect, so dockview never calls anything we return.
      disposables.current = [
        api.onDidRemovePanel((panel) => {
          controller.forget(panel.id);
          persist();
        }),
        api.onDidLayoutChange(persist),
        // Chrome outside the dock (the toolbar's star, feedback context) needs
        // to know which pane the operator is looking at.
        api.onDidActivePanelChange((panel) => {
          controller.setActivePane(panel?.id ?? null);
        }),
        // Tearing a pane off (or dismissing the popout from its own title bar)
        // adds/removes a GROUP, not a panel — so the status bar's detached-
        // windows chip would never learn about it without these two.
        api.onDidAddGroup(() => {
          controller.hostChanged();
          // dockview fires this while CREATING the popout's group, so the
          // group's location may still read 'grid' at this instant. One
          // deferred re-notify settles on the final value — the second read is
          // a no-op when the first was already right.
          setTimeout(() => {
            controller.hostChanged();
          }, 0);
        }),
        api.onDidRemoveGroup(() => {
          controller.hostChanged();
        }),
      ];

      // The initial active panel exists before the event ever fires.
      controller.setActivePane(api.activePanel?.id ?? null);
    },
    [controller, persist, siteKey]
  );

  useEffect(() => {
    const timer = saveTimer;
    const subs = disposables;
    return () => {
      if (timer.current) clearTimeout(timer.current);
      for (const sub of subs.current) sub.dispose();
      subs.current = [];
      controller.detach();
    };
  }, [controller]);

  // Last line of defence for a hard browser nav (tab close, refresh, popout
  // dismissed). The in-app guards cover every path we control; this covers the
  // one we don't. Browsers ignore the custom string and show their own wording.
  useEffect(() => {
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      // A site switch reloads on purpose after its own consent dialog — don't
      // prompt again, or the native dialog cancels the reload and the switch
      // half-applies (cookie moved, page didn't). See controller.markIntentionalUnload.
      if (controller.isUnloadIntentional()) return;
      if (!controller.hasUnsavedWork()) return;
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload);
    };
  }, [controller]);

  return (
    <DockviewReact
      className="h-full"
      components={components}
      tabComponents={tabComponents}
      rightHeaderActionsComponent={GroupActions}
      onReady={onReady}
      // Tearing a tab into open space detaches it into its own window — the
      // gesture that makes this a workbench rather than a tab strip. dockview
      // loads /popout into the new window and portals the group across.
      popoutUrl="/popout"
      disableFloatingGroups={false}
    />
  );
}
