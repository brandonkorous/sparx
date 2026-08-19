'use client';

// Drag, for fingers.
//
// The canvas, the Insert palette and the Layers rail all drag with the browser's
// own HTML5 drag-and-drop. That is the right choice for a mouse, and it is not
// delivered by touch AT ALL — no `dragstart`, no `dragover`, no `drop`. So on a
// phone or a tablet those three gestures were simply absent, and the order of a
// page was whatever the order of adding had happened to be.
//
// This is the same three gestures over pointer events, which every input speaks.
// It runs BESIDE the native path rather than replacing it: a mouse keeps using
// the browser's, because that is the one already proven, and only touch and pen
// come through here. Both ends feed the same `dropPosition` rule, so where a
// block lands cannot depend on what you dragged it with.
//
// A finger cannot hover, so the gesture needs a way to say "I mean to move this"
// that a scroll does not also say. That is the press-and-hold: hold still for a
// moment and the block lifts; move first and the list scrolls, as it should.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react';
import type { Point } from '../canvas/drop';
import { edgePull as pullFor, strayed } from './gesture';

/** How long a finger stays still before the thing under it lifts. */
const HOLD_MS = 280;

/**
 * What is being dragged.
 *
 * `surface` is load-bearing rather than decorative: a site block and an email
 * block are different node languages, and two builders are routinely open at
 * once, so a zone accepts only cargo of its own kind.
 */
export interface DragCargo {
  surface: string;
  /** The id being moved, when the drag started on the document itself. */
  moveId?: string;
  /** The node being added, when it started in a palette. */
  node?: unknown;
}

export interface DropZone {
  surface: string;
  onOver: (point: Point, cargo: DragCargo) => void;
  onLeave: () => void;
  onDrop: (point: Point, cargo: DragCargo) => void;
}

interface DragApi {
  /** What is in the air, or null. Drives the lifted look on the source. */
  cargo: DragCargo | null;
  start: (cargo: DragCargo, point: Point) => void;
  move: (point: Point) => void;
  finish: () => void;
  cancel: () => void;
  register: (element: HTMLElement, zone: DropZone) => () => void;
}

const DragContext = createContext<DragApi | null>(null);

/** The nearest ancestor that actually scrolls, so the edge pull moves something. */
function scrollerOf(element: HTMLElement): HTMLElement | null {
  let node: HTMLElement | null = element;
  while (node) {
    if (node.scrollHeight > node.clientHeight + 1) return node;
    node = node.parentElement;
  }
  return null;
}

export function PointerDragProvider({ children }: { children: ReactNode }) {
  const zones = useRef(new Map<HTMLElement, DropZone>());
  const hit = useRef<{ element: HTMLElement; zone: DropZone } | null>(null);
  const cargoRef = useRef<DragCargo | null>(null);
  const pull = useRef(0);
  const frame = useRef<number | null>(null);
  const [cargo, setCargo] = useState<DragCargo | null>(null);

  const register = useCallback((element: HTMLElement, zone: DropZone) => {
    zones.current.set(element, zone);
    return () => {
      zones.current.delete(element);
      if (hit.current?.element === element) hit.current = null;
    };
  }, []);

  /** The registered zone under a point, or null. */
  const zoneAt = useCallback((point: Point, surface: string) => {
    let element = document.elementFromPoint(point.x, point.y);
    while (element instanceof HTMLElement) {
      const zone = zones.current.get(element);
      if (zone) return zone.surface === surface ? { element, zone } : null;
      element = element.parentElement;
    }
    return null;
  }, []);

  const stopPull = useCallback(() => {
    pull.current = 0;
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = null;
  }, []);

  /**
   * Pull the list along near its edges.
   *
   * Without it a drag on a phone can only reach what is already on screen, and a
   * page is taller than a phone — so "move this block to the top" would be a
   * gesture the author could begin and not finish.
   */
  const edgePull = useCallback(
    (point: Point, element: HTMLElement) => {
      const scroller = scrollerOf(element);
      if (!scroller) return stopPull();
      const box = scroller.getBoundingClientRect();
      pull.current = pullFor(point.y, box.top, box.bottom);
      if (!pull.current) return stopPull();

      if (frame.current !== null) return;
      const step = () => {
        if (!pull.current) return stopPull();
        scroller.scrollTop += pull.current;
        frame.current = requestAnimationFrame(step);
      };
      frame.current = requestAnimationFrame(step);
    },
    [stopPull]
  );

  // The drop needs the point the finger left from, and `pointerup` arrives on the
  // SOURCE rather than on the zone — so the last seen position is kept rather than
  // asked for. It also makes a drop that ends on an edge-pulled list land where the
  // author is looking rather than where they first pressed.
  const lastPoint = useRef<Point>({ x: 0, y: 0 });

  const start = useCallback((next: DragCargo, point: Point) => {
    cargoRef.current = next;
    lastPoint.current = point;
    setCargo(next);
  }, []);

  const move = useCallback(
    (point: Point) => {
      const current = cargoRef.current;
      if (!current) return;
      const found = zoneAt(point, current.surface);
      if (hit.current && hit.current.zone !== found?.zone) hit.current.zone.onLeave();
      hit.current = found;
      if (!found) return stopPull();
      found.zone.onOver(point, current);
      edgePull(point, found.element);
    },
    [edgePull, stopPull, zoneAt]
  );

  const clear = useCallback(() => {
    cargoRef.current = null;
    setCargo(null);
    hit.current?.zone.onLeave();
    hit.current = null;
    stopPull();
  }, [stopPull]);

  const finish = useCallback(() => {
    const current = cargoRef.current;
    const found = hit.current;
    if (current && found) found.zone.onDrop(lastPoint.current, current);
    clear();
  }, [clear]);

  const trackedMove = useCallback(
    (point: Point) => {
      lastPoint.current = point;
      move(point);
    },
    [move]
  );

  // While something is in the air the page must not scroll under it. The listener
  // has to be non-passive to be allowed to say so, which is why it is attached
  // here rather than written as a prop.
  useEffect(() => {
    if (!cargo) return;
    const block = (event: TouchEvent) => event.preventDefault();
    document.addEventListener('touchmove', block, { passive: false });
    return () => document.removeEventListener('touchmove', block);
  }, [cargo]);

  useEffect(() => stopPull, [stopPull]);

  const api = useMemo<DragApi>(
    () => ({ cargo, start, move: trackedMove, finish, cancel: clear, register }),
    [cargo, start, trackedMove, finish, clear, register]
  );

  return <DragContext.Provider value={api}>{children}</DragContext.Provider>;
}

/**
 * The api, or a dormant stand-in where no provider is above.
 *
 * Never throws: the canvas and the palette are used in tests and in apps that
 * mount them bare, and a builder that refuses to render without a drag provider
 * would be a worse trade than a drag that quietly does not start.
 */
function useDragApi(): DragApi | null {
  return useContext(DragContext);
}

/** What is in the air right now, for anything that wants to look lifted. */
export function useDragCargo(): DragCargo | null {
  return useDragApi()?.cargo ?? null;
}

/**
 * Make an element a place things can be dropped.
 *
 * `zone` is read through a ref, so a canvas whose handlers change on every edit
 * does not re-register — and a registration that churned mid-drag would drop the
 * gesture the author was halfway through.
 */
export function useDropZone(element: HTMLElement | null, zone: DropZone): void {
  const api = useDragApi();
  const latest = useRef(zone);
  latest.current = zone;

  useEffect(() => {
    if (!api || !element) return;
    return api.register(element, {
      surface: latest.current.surface,
      onOver: (point, cargo) => latest.current.onOver(point, cargo),
      onLeave: () => latest.current.onLeave(),
      onDrop: (point, cargo) => latest.current.onDrop(point, cargo),
    });
  }, [api, element, zone.surface]);
}

/** The props that make an element draggable by finger. */
export interface DragSourceProps {
  onPointerDown: (event: ReactPointerEvent<HTMLElement>) => void;
  onPointerMove: (event: ReactPointerEvent<HTMLElement>) => void;
  onPointerUp: (event: ReactPointerEvent<HTMLElement>) => void;
  onPointerCancel: (event: ReactPointerEvent<HTMLElement>) => void;
  onContextMenu: (event: { preventDefault: () => void }) => void;
}

/**
 * Press and hold to lift, then drag.
 *
 * `cargoFor` is asked at press time and may answer null — the canvas reads which
 * node is under the finger, and a locked one, or the page background, is not
 * something to lift.
 *
 * A mouse is deliberately ignored. It already has the browser's own drag, which
 * starts immediately and needs no hold, and running both would make a click-and-
 * think on a palette row lift the block out from under the pointer.
 */
export function useDragSource(
  cargoFor: (event: ReactPointerEvent<HTMLElement>) => DragCargo | null
): DragSourceProps {
  const api = useDragApi();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const origin = useRef<Point | null>(null);
  const lifted = useRef(false);
  // Whether this gesture began with a finger. Press-and-hold is ALSO the browser's
  // own "show me the context menu" gesture, so on touch that menu has to be
  // declined — and only on touch, or a right-click on the canvas would stop
  // working for everyone with a mouse.
  const byTouch = useRef(false);

  const clearHold = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    origin.current = null;
  }, []);

  useEffect(() => clearHold, [clearHold]);

  const onPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      byTouch.current = event.pointerType !== 'mouse';
      if (!api || event.pointerType === 'mouse' || !event.isPrimary) return;
      const cargo = cargoFor(event);
      if (!cargo) return;
      const point = { x: event.clientX, y: event.clientY };
      const element = event.currentTarget;
      const pointerId = event.pointerId;
      origin.current = point;
      timer.current = setTimeout(() => {
        // Capture so the gesture keeps reporting once the finger leaves the row it
        // started on — which it does immediately, because that is the whole point.
        //
        // It throws when the pointer is no longer live, which a finger lifted in
        // the same tick genuinely is. Nothing is lifted yet at that point, so the
        // honest answer is to not start rather than to start a drag with no way to
        // hear where it goes.
        try {
          element.setPointerCapture(pointerId);
        } catch {
          return;
        }
        lifted.current = true;
        api.start(cargo, point);
        api.move(point);
      }, HOLD_MS);
    },
    [api, cargoFor]
  );

  const onPointerMove = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      if (!api) return;
      const point = { x: event.clientX, y: event.clientY };
      if (lifted.current) {
        api.move(point);
        return;
      }
      // Moved before the hold elapsed: they are scrolling, not dragging.
      const from = origin.current;
      if (from && strayed(from, point)) clearHold();
    },
    [api, clearHold]
  );

  const settle = useCallback(
    (event: ReactPointerEvent<HTMLElement>, drop: boolean) => {
      clearHold();
      if (!lifted.current || !api) return;
      lifted.current = false;
      try {
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
          event.currentTarget.releasePointerCapture(event.pointerId);
        }
      } catch {
        // Already gone. The drop below is what matters, not the bookkeeping.
      }
      if (drop) {
        api.finish();
        // Touch synthesises a click after the gesture. On a palette row that click
        // is Add, so without swallowing it a dragged block would land twice — once
        // where it was dropped and once wherever a click decides.
        swallowNextClick();
      } else {
        api.cancel();
      }
    },
    [api, clearHold]
  );

  return {
    onPointerDown,
    onPointerMove,
    onPointerUp: (event) => settle(event, true),
    onPointerCancel: (event) => settle(event, false),
    onContextMenu: (event) => {
      if (byTouch.current) event.preventDefault();
    },
  };
}

/** Eat the compatibility click a touch gesture leaves behind — briefly. */
function swallowNextClick(): void {
  const swallow = (event: Event) => {
    event.stopPropagation();
    event.preventDefault();
    done();
  };
  const done = () => document.removeEventListener('click', swallow, true);
  document.addEventListener('click', swallow, true);
  setTimeout(done, 400);
}
