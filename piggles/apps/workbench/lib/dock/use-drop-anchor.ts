'use client';

import { useCallback, useEffect, useRef, type RefObject } from 'react';
import type { FloatPoint } from '../window-placement';

/** Older than this and the release belongs to some earlier gesture. */
const FRESH_MS = 1000;

/**
 * Where the last drag inside the dock was released, in dock-relative pixels.
 *
 * A tab dropped into empty space becomes a window, and it should appear where it
 * was let go rather than at the top of a cascade. dockview reports the new group
 * but not the pointer that made it, so the DOM is where that has to come from.
 */
export function useDropAnchor(): {
  rootRef: RefObject<HTMLDivElement | null>;
  takeDropPoint: () => FloatPoint | null;
} {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const released = useRef<{ point: FloatPoint; at: number } | null>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const record = (event: DragEvent) => {
      const bounds = root.getBoundingClientRect();
      released.current = {
        point: { x: event.clientX - bounds.left, y: event.clientY - bounds.top },
        at: Date.now(),
      };
    };

    // Capture, because dockview's own drop targets handle the event on the way
    // back up. `dragend` is the fallback for a release it never claimed.
    root.addEventListener('drop', record, true);
    root.addEventListener('dragend', record, true);
    return () => {
      root.removeEventListener('drop', record, true);
      root.removeEventListener('dragend', record, true);
    };
  }, []);

  // Read once and cleared: a point that has already placed a window must not
  // place the next one somewhere the pointer has long since left.
  const takeDropPoint = useCallback((): FloatPoint | null => {
    const last = released.current;
    released.current = null;
    if (!last || Date.now() - last.at > FRESH_MS) return null;
    return last.point;
  }, []);

  return { rootRef, takeDropPoint };
}
