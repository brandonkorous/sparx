'use client';

// Pointing at ONE thing on screen — the ring, and where the card sits beside it.
//
// ── THE RING NEVER MOVES THE PAGE ───────────────────────────────────────────
//
// `outline`, not `border` or `box-shadow`: it draws outside the box, so nothing
// shifts by a pixel when a step arrives. A nav row that jumps as it is pointed at
// is the tour breaking the layout it is explaining. See ./guide.css.
//
// ── THE CARD FOLLOWS THE RING ───────────────────────────────────────────────
//
// This used to be split: the ring landed on a nav row on the left and the words
// stayed in the status strip, bottom right, ~900px away. You read a sentence,
// looked away to find the ring, looked back to press Next.
//
// The argument in ./use-guide.ts is against a SPOTLIGHT — dimming, cutting a hole,
// trapping the keyboard — and it still holds completely. That is a claim about
// MODALITY, and it got run together with position. A card beside the row it names
// dims nothing and disables nothing; it is just the words being where the eye
// already is.

import { useEffect, useState } from 'react';
import type { PopoverSide } from '@wizeworks/silicaui-react';
import { useWorkbench } from '../workbench/context';
import { guideSelector, type GuideStep } from './types';

/** Set on the element a step is about. `./guide.css` draws the ring. */
const HERE = 'data-guide-here';

/** Below this, an anchor is chrome in the top bar rather than content. */
const TOPBAR_DEPTH = 120;

export function clearRing(): void {
  if (typeof document === 'undefined') return;
  for (const element of document.querySelectorAll(`[${HERE}]`)) element.removeAttribute(HERE);
}

/**
 * Which side of the anchor the card sits on.
 *
 * Geometry, not a list of anchor names. A new `data-guide` should not have to be
 * registered in a second place to be positioned correctly, and where the card
 * belongs is a fact about where the thing IS — not about what it is called.
 */
export function guideSide(element: HTMLElement | null): PopoverSide {
  if (!element || typeof window === 'undefined') return 'top';
  const box = element.getBoundingClientRect();
  // The top bar is tested FIRST, and the order is the whole point: the logo is
  // in the top bar AND in the left third, and answering "left" for it puts the
  // card across the business and site switchers — the two controls the next step
  // is about. Anything up here gets the card underneath it.
  if (box.bottom < TOPBAR_DEPTH) return 'bottom';
  // The rail and the app panel own the left edge. A card there goes to their
  // right, over the workspace — never on top of the column it is explaining.
  if (box.right < window.innerWidth / 3) return 'right';
  return 'top';
}

/**
 * Wait for an element to appear, giving up rather than hanging.
 *
 * A step whose anchor never arrives simply has no ring and keeps the card on the
 * strip — which is why every step's words are written to stand on their own.
 */
function waitFor(selector: string, timeoutMs = 4000): Promise<Element | null> {
  return new Promise((resolve) => {
    const found = document.querySelector(selector);
    if (found) return resolve(found);
    const start = performance.now();
    const tick = () => {
      const element = document.querySelector(selector);
      if (element) return resolve(element);
      if (performance.now() - start > timeoutMs) return resolve(null);
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}

/**
 * Point at the current step: open the screen it is about, ring it, bring it into
 * view — and hand the element back so the card can be positioned against it.
 *
 * The screen is opened rather than assumed because an app's guide walks that
 * app's panel, and the panel is only there once the app is. The controller
 * re-focuses whatever is already open, so asking on every step costs nothing.
 *
 * Returns `null` for a step with no anchor (the openings and handoffs) and while
 * an anchor is still being waited for. Both cases mean the same thing to the
 * caller: nothing to sit beside, so stay on the strip.
 */
export function useGuideAnchor(step: GuideStep | null): HTMLElement | null {
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
    if (step.app) browseApp(step.app);
    if (step.open) controller.open(step.open.surface, step.open.params);

    const selector = guideSelector(step);
    if (!selector) return;

    void waitFor(selector).then((element) => {
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

/** "Open this app's panel." Which app the panel shows is shell state, and the
 *  chip that drives the guide lives in the status strip below it — so the request
 *  travels as an event rather than by lifting that state up through the shell for
 *  one caller. */
const BROWSE_EVENT = 'piggles:guide-browse';

export function browseApp(appId: string): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent<string>(BROWSE_EVENT, { detail: appId }));
}

/** The shell listens; nothing else may. */
export function useGuideBrowseRequests(onBrowse: (appId: string) => void): void {
  useEffect(() => {
    const handle = (event: Event) => {
      onBrowse((event as CustomEvent<string>).detail);
    };
    window.addEventListener(BROWSE_EVENT, handle);
    return () => {
      window.removeEventListener(BROWSE_EVENT, handle);
    };
  }, [onBrowse]);
}
