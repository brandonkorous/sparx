// The two numbers that decide whether a finger drag feels right.
//
// Kept apart from the controller, and pure, for the same reason `drop.ts` is kept
// apart from `hit.ts`: "does a 6px wobble still count as holding still" is a
// question about arithmetic, and answering it by dragging a phone around is how a
// gesture bug survives for months.

import type { Point } from '../canvas/drop';

/** How far a finger may stray during the hold and still count as holding still. */
export const SLOP = 8;
/** How close to a scrolling edge starts pulling the list along. */
export const EDGE = 56;
/** Pixels per frame at the very edge, tapering to zero at the band's inner lip. */
export const EDGE_STEP = 14;

/**
 * Has the finger moved far enough to mean "scroll" rather than "hold"?
 *
 * Per axis rather than by distance, and deliberately: a list scrolls vertically,
 * so the movement that must cancel a hold is vertical, and measuring the
 * hypotenuse would let a diagonal drift of 7px in each direction — nearly 10px of
 * real travel down the page — still arm a drag the author was not asking for.
 */
export function strayed(from: Point, to: Point): boolean {
  return Math.abs(to.x - from.x) > SLOP || Math.abs(to.y - from.y) > SLOP;
}

/**
 * How hard to pull a list along, for a finger held near its edge.
 *
 * Negative pulls the content down (scrolling up), positive the other way, zero
 * anywhere in the middle. It TAPERS — full speed at the very edge, nothing at the
 * band's inner lip — because a fixed step makes the list bolt the instant the
 * finger crosses an invisible line, and the author overshoots what they were
 * aiming at.
 *
 * Without this a drag on a phone could only reach what was already on screen, and
 * a page is taller than a phone: "move this block to the top" would be a gesture
 * an author could begin and never finish.
 */
export function edgePull(y: number, top: number, bottom: number): number {
  const above = y - top;
  const below = bottom - y;
  if (above < EDGE) return -Math.ceil(((EDGE - Math.max(above, 0)) / EDGE) * EDGE_STEP);
  if (below < EDGE) return Math.ceil(((EDGE - Math.max(below, 0)) / EDGE) * EDGE_STEP);
  return 0;
}
