'use client';

// The browser Back button, taught to mean something inside a single-route app.
//
// The workbench is one URL. Every act of navigation — focusing a different pane,
// opening the module panel, opening the launcher, drilling from a list into a
// record — is React and dockview state that never touches browser history. So
// the browser's back button only ever sees the ONE entry that loaded the app,
// and a single click (a thumb button, pressed without thinking) walks straight
// off it to the previous site or a blank tab, no matter how much work is open.
//
// This bridge makes back mean "undo my last navigation, staying in the app":
//   • an open overlay closes first (launcher, module panel, the mobile nav);
//   • otherwise focus returns to the pane you were looking at before;
//   • only once there is nothing left in-app to undo does back leave the app —
//     and the per-site persisted layout means leaving-at-the-base is cheap,
//     because everything is restored the moment you come back.
//
// It NEVER closes a pane or discards work. Back is navigation here, never
// destruction — which is exactly what makes it safe to press reflexively.
//
// How: mirror our own logical navigation depth into browser-history depth. Each
// forward step is one `pushState`; each browser back is one `popstate` that we
// answer by re-applying the view at that depth. Views are held in a module-free
// in-memory map keyed by a sequence number, and only that number rides in
// `history.state` (`__wb`) — the view itself carries pane ids and overlay flags
// that mean nothing after a reload, where the layout restore rebuilds the world
// from scratch regardless.

import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react';
import { useWorkbench } from './context';

/** The overlays a shell can have open on top of its panes. `module` is the
 *  module-panel's browsed key (null = closed); the two booleans are the
 *  launcher and the compact nav drawer. */
export interface OverlayState {
  launcher: boolean;
  module: string | null;
  nav: boolean;
}

/** A full navigation location: which pane is focused, plus every overlay. */
interface View extends OverlayState {
  focus: string | null;
}

/** Overlays that a back press should be able to simply dismiss — a modal-shaped
 *  layer, as opposed to the module panel which behaves as ordinary navigation.
 *  Used only to recognise a "closed it myself" delta so the redundant forward
 *  entry can be collapsed rather than left for back to re-open. */
const EPHEMERAL_FIELDS = ['launcher', 'nav'] as const;

function viewsEqual(a: View, b: View): boolean {
  return (
    a.focus === b.focus && a.launcher === b.launcher && a.module === b.module && a.nav === b.nav
  );
}

/**
 * True when `live` differs from `current` ONLY by one or more ephemeral overlays
 * going true→false — i.e. the operator dismissed a modal-shaped layer (Escape,
 * outside-click, selecting nothing) rather than navigating.
 *
 * That case wants collapsing, not a new entry: without it, Escaping the command
 * palette and then reflexively pressing back would RE-OPEN the palette, which
 * reads as a bug. Any other delta (an overlay opening, focus or the module panel
 * changing) is genuine navigation and gets a real entry.
 */
function isEphemeralDismissal(current: View, live: View): boolean {
  if (current.focus !== live.focus || current.module !== live.module) return false;
  let dismissed = false;
  for (const field of EPHEMERAL_FIELDS) {
    if (current[field] === live[field]) continue;
    // An ephemeral turning ON is navigation, not a dismissal.
    if (!(current[field] === true && live[field] === false)) return false;
    dismissed = true;
  }
  return dismissed;
}

function mergeHistoryState(seq: number): Record<string, unknown> {
  const existing = (window.history.state as Record<string, unknown> | null) ?? {};
  return { ...existing, __wb: { seq } };
}

/**
 * Wires the browser Back/Forward buttons to in-app navigation for the shell that
 * calls it. Reads the focused pane from the controller itself; the overlays and
 * the setter that applies them come from the shell, because they are ordinary
 * React state the shell already owns.
 *
 * `apply` is held in a ref so the shell can pass a fresh closure every render
 * without churning the popstate subscription.
 */
export function useBackNavigation(
  overlays: OverlayState,
  apply: (overlays: OverlayState) => void
): void {
  const { controller, role } = useWorkbench();

  // The focused pane, live. Stable object between emits (controller caches its
  // descriptors), which is what useSyncExternalStore needs.
  const focus = useSyncExternalStore(
    controller.subscribe,
    () => controller.getActiveDescriptor()?.id ?? null,
    () => null
  );

  const live: View = {
    focus,
    launcher: overlays.launcher,
    module: overlays.module,
    nav: overlays.nav,
  };

  const liveRef = useRef(live);
  liveRef.current = live;
  const applyRef = useRef(apply);
  applyRef.current = apply;

  // seq → view. `current` is where we sit in that history; `counter` mints the
  // next id. `applying` suppresses the change effect while WE drive the state
  // from a popstate (or a collapse), so answering back can't look like a new
  // forward nav. `hasBase`/`booting` fence off the layout-restore burst so it
  // collapses into the base entry instead of a stack of spurious steps.
  const views = useRef<Map<number, View>>(new Map());
  const counter = useRef(0);
  const current = useRef(0);
  const applying = useRef(false);
  const hasBase = useRef(false);
  const booting = useRef(true);

  const applyView = useCallback(
    (view: View) => {
      applying.current = true;
      applyRef.current({ launcher: view.launcher, module: view.module, nav: view.nav });
      // A pane that has since been closed simply can't be refocused — host.focus
      // no-ops on a missing id, so no guard is needed; the panes stay put.
      if (view.focus) controller.focusPane(view.focus);
      // Release on the next task, once React has flushed the state above and the
      // focus change has round-tripped through the controller. The re-applied
      // view already equals the current entry, so a mistimed release is a no-op
      // regardless — this only spares the effect a wasted pass.
      window.setTimeout(() => {
        applying.current = false;
      }, 0);
    },
    [controller]
  );

  // ── Base entry + the boot window ─────────────────────────────────────────
  // Tag the entry that loaded the document as our seq 0 so a later back lands on
  // it (and one more leaves the app). The boot window keeps the restore burst —
  // dockview focuses every pane it deserializes — from each becoming a history
  // step; it ends at the first genuine user input, which is the first thing that
  // could not possibly be part of an automatic restore.
  useEffect(() => {
    if (role === 'detached' || typeof window === 'undefined') return;
    if (!hasBase.current) {
      views.current.set(0, liveRef.current);
      window.history.replaceState(mergeHistoryState(0), '', window.location.href);
      hasBase.current = true;
    }

    const endBoot = () => {
      booting.current = false;
    };
    // Capture phase so we win before a click's own handler mutates state.
    window.addEventListener('pointerdown', endBoot, true);
    window.addEventListener('keydown', endBoot, true);
    // Fallback: no input in the first few seconds still ends the window, so an
    // untouched session doesn't sit permanently in "collapse into base" mode.
    const timer = window.setTimeout(endBoot, 3000);
    return () => {
      window.removeEventListener('pointerdown', endBoot, true);
      window.removeEventListener('keydown', endBoot, true);
      window.clearTimeout(timer);
    };
  }, [role]);

  // ── Browser back / forward ───────────────────────────────────────────────
  useEffect(() => {
    if (role === 'detached' || typeof window === 'undefined') return;
    const onPopState = (event: PopStateEvent) => {
      const seq = (event.state as { __wb?: { seq: number } } | null)?.__wb?.seq;
      // No marker means we've popped past our base to a foreign entry — the app
      // is being left. Nothing to do; the unload (and its unsaved-work guard)
      // takes it from here.
      if (seq === undefined) return;
      current.current = seq;
      const view = views.current.get(seq);
      if (view) applyView(view);
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [applyView, role]);

  // ── Record forward navigation ────────────────────────────────────────────
  // Debounced to a frame so a compound transition (select a launcher item: the
  // palette closes AND a pane opens) and the restore burst both settle to a
  // single view before we decide what to record.
  useEffect(() => {
    if (role === 'detached' || typeof window === 'undefined') return;
    const raf = window.requestAnimationFrame(() => {
      if (applying.current || !hasBase.current) return;
      const next = liveRef.current;

      // Still booting: fold everything into the base entry rather than stacking
      // steps for a restore the operator never performed.
      if (booting.current) {
        views.current.set(0, next);
        counter.current = 0;
        current.current = 0;
        window.history.replaceState(mergeHistoryState(0), '', window.location.href);
        return;
      }

      const here = views.current.get(current.current);
      if (here && viewsEqual(here, next)) return;

      // The operator dismissed a modal-shaped overlay they had opened: collapse
      // the pair to nothing by popping the entry that opened it, but ONLY when
      // popping actually yields the view we're now in — otherwise an interleaved
      // navigation sits between, and a plain new entry is the honest record.
      if (here && isEphemeralDismissal(here, next)) {
        const previous = views.current.get(current.current - 1);
        if (previous && viewsEqual(previous, next)) {
          applying.current = true;
          window.history.back();
          return;
        }
      }

      const seq = ++counter.current;
      views.current.set(seq, next);
      // We've branched: drop any forward entries a prior back had left ahead.
      for (const key of [...views.current.keys()]) if (key > seq) views.current.delete(key);
      current.current = seq;
      window.history.pushState(mergeHistoryState(seq), '', window.location.href);
    });
    return () => window.cancelAnimationFrame(raf);
  }, [focus, overlays.launcher, overlays.module, overlays.nav, role]);
}

/**
 * Null-rendering mount point for {@link useBackNavigation}. Lives INSIDE
 * <WorkbenchProvider> (the hook needs the controller), while the overlay state
 * it reflects is owned by the shell above the provider — so the shell passes
 * that state and the setter down as props.
 */
export function BackNavigation({
  launcher,
  module,
  nav,
  onApply,
}: {
  launcher: boolean;
  module: string | null;
  nav: boolean;
  onApply: (overlays: OverlayState) => void;
}) {
  useBackNavigation({ launcher, module, nav }, onApply);
  return null;
}
