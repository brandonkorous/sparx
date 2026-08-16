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
//   • WINDOWS MODE HAS NO GRID. dockview answers a tab dropped into empty space
//     with a new GRID group — a docked pane behind every window, which reads as
//     the drag having failed. `evictFromGrid` lifts it back out, at the point it
//     was released, so a dragged-out tab simply becomes a window.

import { useCallback, useEffect, useRef } from 'react';
import { DockviewReact, type DockviewApi, type DockviewReadyEvent } from 'dockview';
import { useWorkbench } from '@/lib/workbench/context';
import { saveLayout } from '@/lib/workbench/persistence';
import { saveModeLayout } from '../mode-layouts';
// Platform plumbing — the controller bridge and the pane renderer. Forking any
// of these would mean two consoles losing arrangements in two different ways.
import { DockPaneHost } from '@/lib/dock/dock-host';
import { Pane } from '@/lib/dock/pane';
// Piggles chrome — the title bar, its buttons, and what a fresh workspace opens
// with. All three are presentation or product decisions, and all three differ
// from sparx on purpose.
import { GroupActions } from './group-actions';
import { PaneTab } from './pane-tab';
import { configureDock, restoreOrDefault, subscribeDock } from './dock-wiring';
import { useDropAnchor } from './use-drop-anchor';
import { useUnloadGuard } from './use-unload-guard';
import { applyWindowMode, evictFromGrid, switchWindowMode, type WindowMode } from '../window-mode';
import { WindowModeProvider } from '../window-mode-context';
// dockview's own reset only. sparx's `lib/dock/dock-theme.css` is deliberately
// NOT imported: it maps every `--dv-*` onto sparx's surface ramp, and importing
// it just to override it would mean Piggles inherits sparx's defaults and paints
// over them. The Piggles skin lives in app/globals.css and starts from nothing.
import 'dockview/dist/styles/dockview.css';

const components = { surface: Pane };
const tabComponents = { surface: PaneTab };

/** Debounce layout writes — dragging a splitter fires continuously. */
const SAVE_DEBOUNCE_MS = 400;

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
  const disposables = useRef<ReturnType<typeof subscribeDock>>([]);
  const { rootRef, takeDropPoint } = useDropAnchor();

  const persist = useCallback(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      const api = apiRef.current;
      if (!api) return;
      const grid = api.toJSON();
      saveLayout(siteKey, grid, controller.snapshotDescriptors());

      // ── AND INTO THE PRESENTATION IT BELONGS TO ─────────────────────────
      //
      // A per-mode snapshot used to be written in ONE place: the moment you
      // left that mode. So nothing done INSIDE a presentation was recorded
      // until you left it, and that built a trap. Docked view came back as one
      // pile, you switched straight back to windows to get out of it — and the
      // way out saved that pile over the good arrangement. One bad restore
      // locked itself in permanently, and no amount of tidying could correct it
      // because tidying was never what got saved.
      //
      // `appliedMode`, not the prop: this is the arrangement ON SCREEN, and it
      // belongs to the presentation currently painting it.
      const showing = appliedMode.current;
      if (showing) saveModeLayout(siteKey, showing, grid);
    }, SAVE_DEBOUNCE_MS);
  }, [controller, siteKey]);

  const onReady = useCallback(
    (event: DockviewReadyEvent) => {
      const api = event.api;
      apiRef.current = api;
      controller.attach(new DockPaneHost(api));
      configureDock(api);
      restoreOrDefault(api, controller, siteKey);

      // Parked on a ref rather than returned: onReady is a callback, not an
      // effect, so dockview never calls anything we return.
      disposables.current = subscribeDock(api, {
        controller,
        persist,
        // A group settling into the grid while windows are on screen is the
        // drag-out case — put it where it was dropped.
        onGroupSettled: () => {
          if (modeRef.current !== 'windows') return;
          evictFromGrid(api, takeDropPoint());
        },
      });

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
    [controller, persist, siteKey, takeDropPoint]
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

  useUnloadGuard(controller);

  return (
    // The wrapper is what the drop anchor measures against — dockview reports
    // the group a drop created, never the pointer that created it.
    <div ref={rootRef} className="h-full">
      {/* Inside, so the title bars dockview mounts can read the presentation
          they are being asked to offer actions for. */}
      <WindowModeProvider mode={mode}>
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
          // nothing to scroll. The replacement is the arrows in the group header.
          disableTabsOverflowList
        />
      </WindowModeProvider>
    </div>
  );
}
