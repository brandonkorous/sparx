'use client';

// Pointing at ONE thing on screen — the ring, and where the card sits beside it.
//
// ── THE RING NEVER MOVES THE PAGE ───────────────────────────────────────────
//
// `outline`, not `border` or `box-shadow`: it draws outside the box, so nothing
// shifts by a pixel when a step arrives. A rail item that jumps as it is pointed
// at is the tour breaking the layout it is explaining. See ./tour.css.
//
// ── THE CARD FOLLOWS THE RING ───────────────────────────────────────────────
//
// driver.js used to own both of these, and it owned them by dimming the whole
// screen and cutting a hole. That is the wrong shape for this app: the workbench's
// premise is that the OPERATOR decides what occupies the screen — panes they
// placed, windows they tore off, a rail they arranged. A tour that blacks all of
// that out to explain it is arguing with the product it is explaining.
//
// So this rings ONE thing, puts the words beside it, and dims nothing. Every
// control on screen still works, including the one being pointed at.

import { useEffect, useState } from 'react';
import type { PopoverSide } from '@wizeworks/silicaui-react';
import { useWorkbench } from '../workbench/context';
import { tourSelector, type TourStep } from './types';

/** Set on the element a step is about. `./tour.css` draws the ring. */
const HERE = 'data-tour-here';

/** Below this, an anchor is chrome in the toolbar rather than content. */
const TOOLBAR_DEPTH = 120;

export function clearRing(): void {
  if (typeof document === 'undefined') return;
  for (const element of document.querySelectorAll(`[${HERE}]`)) element.removeAttribute(HERE);
}

/**
 * Which side of the anchor the card sits on.
 *
 * Geometry, not a list of anchor names. A new `data-tour` should not have to be
 * registered in a second place to be positioned correctly, and where the card
 * belongs is a fact about where the thing IS — not about what it is called.
 */
export function tourSide(element: HTMLElement | null): PopoverSide {
  if (!element || typeof window === 'undefined') return 'top';
  const box = element.getBoundingClientRect();
  // The toolbar is tested FIRST, and the order is the whole point: the wordmark
  // is in the toolbar AND in the left third, and answering "left" for it puts the
  // card across the site and workspace switchers — the two controls the next step
  // is about. Anything up here gets the card underneath it.
  if (box.bottom < TOOLBAR_DEPTH) return 'bottom';
  // The rail and the module panel own the left edge. A card there goes to their
  // right, over the panes — never on top of the column it is explaining.
  if (box.right < window.innerWidth / 3) return 'right';
  return 'top';
}

/**
 * Wait for an element to appear, giving up rather than hanging.
 *
 * A step whose anchor never arrives simply has no ring and keeps the card on the
 * status bar — which is why every step's words are written to stand on their own.
 */
export function waitForAnchor(selector: string, timeoutMs = 4000): Promise<Element | null> {
  return new Promise((resolve) => {
    const found = document.querySelector(selector);
    if (found) {
      resolve(found);
      return;
    }
    const start = performance.now();
    const tick = () => {
      const element = document.querySelector(selector);
      if (element) {
        resolve(element);
        return;
      }
      if (performance.now() - start > timeoutMs) {
        resolve(null);
        return;
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}

/**
 * Point at the current step: open the surface it is about, ring it, bring it into
 * view — and hand the element back so the card can be positioned against it.
 *
 * The surface is opened rather than assumed because a module tour walks controls
 * across more than one screen, and a replayed tour can start with its landing
 * surface closed. The controller re-focuses whatever is already open, so asking on
 * every step costs nothing. This replaces driver.js's `ensureStep` orchestration —
 * the open-and-wait now lives with the ring rather than beside it.
 *
 * Returns `null` for a step with no anchor (the welcome and closing cards) and
 * while an anchor is still being waited for. Both mean the same thing to the
 * caller: nothing to sit beside, so stay on the status bar.
 */
export function useTourAnchor(step: TourStep | null): HTMLElement | null {
  const { controller } = useWorkbench();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);

  useEffect(() => {
    clearRing();
    // Dropped BEFORE the wait, not after it resolves: carrying the previous
    // step's element into this one would park the card next to the last thing
    // pointed at while the words describe the next.
    setAnchor(null);
    if (!step) return;

    let cancelled = false;
    if (step.open) {
      controller.open(step.open.surface, step.open.params, { target: step.open.target ?? 'tab' });
    }

    const selector = tourSelector(step);
    if (!selector) return;

    void waitForAnchor(selector).then((element) => {
      // `instanceof HTMLElement` rather than a cast: the positioner measures it,
      // and an SVG or a text node would resolve the selector and then fail to
      // measure in a way that reads as the card simply not appearing.
      if (cancelled || !(element instanceof HTMLElement)) return;
      element.setAttribute(HERE, '');
      element.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      setAnchor(element);
    });

    return () => {
      cancelled = true;
      clearRing();
    };
  }, [step, controller]);

  return anchor;
}
