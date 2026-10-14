'use client';

// What the canvas tools do: tidy the windows up, and change how much of the
// workspace fits on screen. Both act on every window at once, and both go
// through `addFloatingGroup` — dockview's only public reposition.

import { useCallback, useEffect, useRef, type RefObject } from 'react';
import type { DockviewApi, DockviewGroupPanel } from 'dockview';
import { arrangeWindows, type ArrangeStyle } from '../window-arrange';
import { rescaleWindows, type ZoomLevel } from '../window-zoom';
import {
  boxOf,
  cascadeBox,
  fillBox,
  floatingGroups,
  sameBox,
  snapBox,
  type FloatBox,
  type FloatViewport,
  windowsToRefill,
} from '../window-placement';

export interface CanvasCommandOptions {
  api: RefObject<DockviewApi | null>;
  canvas: RefObject<HTMLElement | null>;
  readViewport: () => FloatViewport;
  zoom: ZoomLevel;
  /** Re-floor the scroll extent once the windows have moved. */
  fit: () => void;
  /** Each window's box at 100%, so zooming out and back is exact. */
  bases: RefObject<Map<string, FloatBox>>;
  /** Drop those memos — anything that moves a window makes them stale. */
  forget: () => void;
}

export interface CanvasCommands {
  arrange: (style: ArrangeStyle) => void;
  /** Runs when a window drag finishes — see `WindowCanvasOptions.onDragEnd`. */
  dragEnded: (moved: HTMLElement | null) => void;
  /** Make one window fill what you can see, or put it back where it was. Returns
   *  whether it now fills. dockview's own maximize only knows the tiled grid, so in
   *  windows mode the title bar's maximize did nothing while its icon flipped
   *  (sparx persona issue 030). */
  toggleFill: (group: DockviewGroupPanel) => boolean;
  isFilled: (groupId: string) => boolean;
  /** Fit every filled window to the screen as it is NOW. Run whenever the screen
   *  changes size and once a saved layout is on screen (sparx persona issue 167). */
  refill: () => void;
}

export function useCanvasCommands({
  api,
  canvas,
  readViewport,
  zoom,
  fit,
  bases,
  forget,
}: CanvasCommandOptions): CanvasCommands {
  // The zoom ON SCREEN. The FIRST value is deliberately not applied: the layout
  // was saved at that zoom, so the boxes it restored are already the right size.
  const applied = useRef<ZoomLevel>(zoom);
  // Each filled window's box from before it filled, by group id. Kept here, not in the
  // title bar: re-placing a window rebuilds its frame, and the bar remounts with it.
  const unfilled = useRef(new Map<string, FloatBox>());
  // `refill`, for the zoom effect below, which comes before it is defined.
  const refillRef = useRef<() => void>(() => undefined);
  useEffect(() => {
    const dock = api.current;
    if (!dock || applied.current === zoom) return;
    const previous = applied.current;
    applied.current = zoom;
    rescaleWindows(dock, previous, zoom, canvas.current, bases.current);
    // A filled window is as big as what you can see, whatever the zoom (see
    // fillBox), so the rescale must not shrink it.
    refillRef.current();
    fit();
  }, [api, bases, canvas, fit, zoom]);

  const arrange = useCallback(
    (style: ArrangeStyle) => {
      const dock = api.current;
      if (!dock) return;
      arrangeWindows(dock, style, readViewport(), canvas.current);
      forget();
    },
    [api, canvas, forget, readViewport]
  );

  const dragEnded = useCallback(
    (moved: HTMLElement | null) => {
      // Somebody has had a say about where a window goes, so the zoom's memo of
      // its 100% box is out of date whatever else happens here.
      forget();

      const dock = api.current;
      const ground = canvas.current;
      if (!moved || !dock || !ground) return;

      const groups = floatingGroups(dock);
      const dragged = groups.find((group) => moved.contains(group.element));
      if (!dragged) return;
      // Moved by hand, so no longer filling the screen: a resize must not snap it
      // back.
      unfilled.current.delete(dragged.id);

      const box = boxOf(dragged, ground);
      const snapped = snapBox(
        box,
        groups.filter((group) => group !== dragged).map((group) => boxOf(group, ground)),
        readViewport()
      );
      if (sameBox(box, snapped)) return;
      dock.addFloatingGroup(dragged, snapped);
      fit();
    },
    [api, canvas, fit, forget, readViewport]
  );

  const toggleFill = useCallback(
    (group: DockviewGroupPanel): boolean => {
      const dock = api.current;
      const ground = canvas.current;
      if (!dock || !ground) return false;
      const before = unfilled.current.get(group.id);
      if (before) {
        unfilled.current.delete(group.id);
        dock.addFloatingGroup(group, before);
      } else {
        unfilled.current.set(group.id, boxOf(group, ground));
        dock.addFloatingGroup(group, fillBox(readViewport()));
      }
      forget();
      fit();
      return !before;
    },
    [api, canvas, fit, forget, readViewport]
  );

  const isFilled = useCallback((groupId: string) => unfilled.current.has(groupId), []);

  const refill = useCallback(() => {
    const dock = api.current;
    const ground = canvas.current;
    if (!dock || !ground) return;
    const view = readViewport();
    const groups = floatingGroups(dock);
    const plan = windowsToRefill(
      groups.map((group) => ({ id: group.id, box: boxOf(group, ground) })),
      new Set(unfilled.current.keys()),
      view
    );
    const ids = new Set(plan.ids);
    if (ids.size === 0) return;
    for (const group of groups) {
      if (!ids.has(group.id)) continue;
      // A filled window restored from a saved layout has no box of its own to go
      // back to (which ones were filled is not saved), so its title bar's restore
      // puts it where a new window would open.
      if (!unfilled.current.has(group.id)) unfilled.current.set(group.id, cascadeBox(view, 0));
      dock.addFloatingGroup(group, plan.box);
    }
    forget();
    fit();
  }, [api, canvas, fit, forget, readViewport]);
  refillRef.current = refill;

  return { arrange, dragEnded, toggleFill, isFilled, refill };
}
