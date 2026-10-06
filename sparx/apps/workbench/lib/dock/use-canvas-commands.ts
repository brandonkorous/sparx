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
  fillBox,
  floatingGroups,
  sameBox,
  snapBox,
  type FloatBox,
  type FloatViewport,
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
  useEffect(() => {
    const dock = api.current;
    if (!dock || applied.current === zoom) return;
    const previous = applied.current;
    applied.current = zoom;
    rescaleWindows(dock, previous, zoom, canvas.current, bases.current);
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

  // Each filled window's box from before it filled, by group id. Kept here, not in the
  // title bar: re-placing a window rebuilds its frame, and the bar remounts with it.
  const unfilled = useRef(new Map<string, FloatBox>());

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

  return { arrange, dragEnded, toggleFill, isFilled };
}
