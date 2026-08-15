'use client';

// The Piggles console's dock — its own, not sparx's.
//
// ── WHY THIS FILE EXISTS ────────────────────────────────────────────────────
//
// The PANELS are shared and must never be forked (piggles/CLAUDE.md RULE #0):
// every surface, the controller that resolves them, the descriptor format and
// the layout persistence all come from the platform, imported below untouched.
//
// The CHROME is not shared and is not related to sparx at all. How panes are
// presented — tiled or floating, gapped or flush, what a title bar looks like,
// what its buttons do — is a product decision Piggles makes for its own
// audience, and sparx makes differently for a different one. Reaching into
// sparx's dock for a prop every time the two disagree is how one component
// slowly becomes a switch statement over two products.
//
// So the split is presentation vs plumbing, and the line is drawn here:
//
//   PLATFORM, imported untouched — a Piggles copy would be a real fork, and the
//   failure mode is two consoles losing people's arrangements in two different
//   ways:
//     • `Pane`                      — the pane renderer (how a surface mounts)
//     • `DockPaneHost`              — the controller ⇄ dockview bridge
//     • `loadLayout` / `saveLayout` — the persistence format
//     • the controller + descriptor types
//
//   PIGGLES, in this directory — presentation and product decisions, all of
//   which sparx answers differently for a different audience:
//     • `PaneTab`        — what a window's title bar looks like
//     • `GroupActions`   — what its buttons do
//     • `DEFAULT_LAYOUT` — what a fresh workspace opens with
//     • the theme + skin — gap, radius, surfaces
//
// ── WHAT IS DIFFERENT HERE ──────────────────────────────────────────────────
//
//   • A THEME with a real `gap`, so groups read as separate windows. `gap` is
//     read by dockview's layout engine — it positions every group and derives
//     drop targets, sash hit-areas and drag previews from those rectangles — so
//     it cannot be done in CSS. Three attempts proved that the hard way.
//   • The theme is applied through `api.updateOptions({ theme })` rather than
//     the `theme` prop. `<DockviewReact theme={…}>` TYPECHECKS (the props
//     interface extends DockviewOptions) and the React wrapper never reads it:
//     its compiled source contains no reference to `theme` at all. A prop that
//     compiles, lints and is silently discarded.
//   • Windows-vs-tabs lives HERE rather than in the shell. The shell owns the
//     CHOICE (a button, a stored preference); acting on it needs the api, the
//     controller and the site key, all three of which are already in this file.
//     Handing the api outward instead meant the shell reached back in.

import { useCallback, useEffect, useRef } from 'react';
import { DockviewReact, type DockviewApi, type DockviewReadyEvent } from 'dockview';
import { useWorkbench } from '@/lib/workbench/context';
import { loadLayout, saveLayout } from '@/lib/workbench/persistence';
import type { WorkbenchController } from '@/lib/workbench/controller';
import type { PaneDescriptor } from '@/lib/surfaces/descriptor';
// Platform plumbing — the controller bridge and the pane renderer. Forking any
// of these would mean two consoles losing arrangements in two different ways.
import { DockPaneHost } from '@/lib/dock/dock-host';
import { Pane } from '@/lib/dock/pane';
// Piggles chrome — the title bar, its buttons, and what a fresh workspace opens
// with. All three are presentation or product decisions, and all three differ
// from sparx on purpose.
import { GroupActions } from './group-actions';
import { PaneTab } from './pane-tab';
import { DEFAULT_LAYOUT } from './default-layout';
import { PIGGLES_DOCK_THEME } from '../dock-theme';
import { applyWindowMode, switchWindowMode, type WindowMode } from '../window-mode';
// dockview's own reset only. sparx's `lib/dock/dock-theme.css` is deliberately
// NOT imported: it maps every `--dv-*` onto sparx's surface ramp, and importing
// it just to override it would mean Piggles inherits sparx's defaults and paints
// over them. The Piggles skin lives in app/globals.css and starts from nothing.
import 'dockview/dist/styles/dockview.css';

const components = { surface: Pane };
const tabComponents = { surface: PaneTab };

/** Debounce layout writes — dragging a splitter fires continuously. */
const SAVE_DEBOUNCE_MS = 400;

/**
 * Re-opens panes that exist in the saved SET but not in the saved GRID.
 *
 * The two halves can legitimately disagree: the compact shell has no grid to
 * write, so it persists the pane set and leaves the arrangement as the desktop
 * left it — meaning a pane opened on a phone has a descriptor and no slot.
 * Replaying only the grid would silently drop it, so "open it on my phone,
 * finish it at my desk" would lose the thing you opened.
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

export function ConsoleDock({
  siteKey,
  mode,
}: {
  siteKey: string;
  /**
   * Windows or tabs — NULL until the shell has read the stored preference.
   *
   * The null state is load-bearing, not defensive. Defaulting to 'tabs' for the
   * one render before localStorage is read meant a returning windows user had
   * their restored floating layout tiled and then re-floated — and the tiled
   * intermediate got saved over their real tabs arrangement on the way past.
   * A presentation nobody has chosen yet is not 'tabs'; it is unknown.
   */
  mode: WindowMode | null;
}) {
  const { controller } = useWorkbench();
  const apiRef = useRef<DockviewApi | null>(null);
  /** The presentation currently ON SCREEN, which is not the same as the prop
   *  until both the dock and the stored preference have arrived. */
  const appliedMode = useRef<WindowMode | null>(null);
  // Read inside onReady, which dockview calls exactly once — a dependency would
  // rebuild the callback for a value it only ever samples.
  const modeRef = useRef<WindowMode | null>(mode);
  modeRef.current = mode;
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

      // The theme, through the api — see this file's header for why the prop
      // cannot be used. Applied BEFORE the layout is restored so groups are
      // positioned with the gap already in the layout engine's arithmetic.
      api.updateOptions({
        theme: PIGGLES_DOCK_THEME,

        // ── A WINDOW STAYS IN THE WORKSPACE ────────────────────────────────
        //
        // dockview positions a floating group against its own container (the
        // dock, not the browser), but its DEFAULT only guarantees that a small
        // sliver stays inside — `DEFAULT_FLOATING_GROUP_OVERFLOW_SIZE`. Drag a
        // window left and most of it leaves the dock and sits on top of the app
        // rail, covering the navigation with something the navigation cannot be
        // used to get out from under.
        //
        // That is wrong here in a way it might not be in a code editor. The rail
        // is this product's primary navigation and it is always meant to be
        // reachable; a window that can bury it makes the workspace feel like it
        // has escaped its frame rather than like a desk with things on it.
        //
        // `boundedWithinViewport` clears both minimums, which is dockview's way
        // of saying "fully inside" — the window can be moved anywhere in the
        // workspace and nowhere outside it. Set here rather than as a prop for
        // the same reason as the theme, and BEFORE the layout is restored so
        // that groups created by the restore are built with the constraint
        // already in force (dockview reads this option when it constructs each
        // overlay, and re-applies it to existing ones on update).
        floatingGroupBounds: 'boundedWithinViewport',
      });

      const stored = loadLayout(siteKey);
      if (stored) {
        // Descriptors FIRST — dockview mounts every pane synchronously while
        // deserializing, and each resolves its descriptor on mount.
        controller.hydrate(stored.panes);
        try {
          api.fromJSON(stored.grid as Parameters<DockviewApi['fromJSON']>[0]);
          adoptPanesMissingFromGrid(api, controller, stored.panes);
        } catch (error) {
          // A layout saved by an older build can fail to deserialize. Falling
          // back to the default beats a blank screen nobody can escape.
          console.warn('[piggles] could not restore layout; starting fresh', error);
          controller.hydrate({});
          DEFAULT_LAYOUT.forEach((entry) => controller.open(entry.surface, entry.params));
        }
      } else {
        controller.hydrate({});
        DEFAULT_LAYOUT.forEach((entry) => controller.open(entry.surface, entry.params));
      }

      // A pane closed by the tab's × bypasses controller.close(), so reconcile
      // here rather than leaking descriptors and guards for dead panes.
      //
      // Parked on a ref rather than returned: onReady is a callback, not an
      // effect, so dockview never calls anything we return.
      disposables.current = [
        api.onDidRemovePanel((panel) => {
          controller.forget(panel.id);
          persist();
        }),
        api.onDidLayoutChange(persist),
        api.onDidActivePanelChange((panel) => {
          controller.setActivePane(panel?.id ?? null);
        }),
        // Tearing a pane off (or dismissing a popout) adds/removes a GROUP, not
        // a panel — so the status bar's detached-windows chip would never learn
        // about it without these two.
        api.onDidAddGroup(() => {
          controller.hostChanged();
          // dockview fires this while CREATING the popout's group, so the
          // location may still read 'grid' at this instant. One deferred
          // re-notify settles on the final value.
          setTimeout(() => {
            controller.hostChanged();
          }, 0);
        }),
        api.onDidRemoveGroup(() => {
          controller.hostChanged();
        }),
      ];

      controller.setActivePane(api.activePanel?.id ?? null);

      // If the preference is already known, dress the restored arrangement in
      // it now. If it is not, the effect below does it the moment it arrives —
      // and doing nothing here is what keeps a half-known mode from being
      // applied and then saved.
      const known = modeRef.current;
      if (known) {
        applyWindowMode(api, known);
        appliedMode.current = known;
      }
    },
    [controller, persist, siteKey]
  );

  // The presentation, applied and re-applied.
  //
  // First arrival (null ⇒ X) only DRESSES what the layout already restored:
  // that layout was saved in mode X, so it is already arranged correctly and
  // there is no other arrangement to fetch. Switching (X ⇒ Y) is the real move
  // and goes through switchWindowMode, which photographs X on the way out and
  // restores Y's own arrangement.
  useEffect(() => {
    const api = apiRef.current;
    if (!api || !mode || appliedMode.current === mode) return;
    const previous = appliedMode.current;
    appliedMode.current = mode;
    if (!previous) {
      applyWindowMode(api, mode);
      return;
    }
    switchWindowMode(api, controller, siteKey, previous, mode);
  }, [mode, controller, siteKey]);

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
      // A site or business switch reloads on purpose after its own consent
      // dialog — don't prompt again, or the native dialog cancels the reload and
      // the switch half-applies. See controller.markIntentionalUnload.
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
      // Tearing a tab out detaches it into its own OS window; dockview loads
      // /popout there and portals the group across.
      popoutUrl="/popout"
      // Floating groups are what "windows mode" is built on — see
      // lib/window-mode.ts. They are also why a gap matters: dockview floats a
      // group when a tab is dragged into empty space, and a flush grid has none.
      disableFloatingGroups={false}
      // dockview's own overflow dropdown cannot be made good from out here: it
      // re-renders the TAB component per row and sizes the popup a frame before
      // React fills it, so a long list renders past both ends of the screen with
      // nothing to scroll. The replacement is a real menu in the group header.
      disableTabsOverflowList
    />
  );
}
