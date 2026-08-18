'use client';

// The tour runtime — and the one design decision the whole feature turns on.
//
// ── IT NEVER COVERS THE WORK ────────────────────────────────────────────────
//
// This was a wrapper over driver.js, which teaches by spotlight: dim the screen,
// cut a hole over one control, float a card next to it, trap the keyboard until
// somebody presses Next. It teaches well and it is the wrong shape here, because
// this app's whole premise is that the OPERATOR decides what occupies the screen —
// panes they placed, windows they tore off, a rail they arranged. A tour that
// blacks all of that out to explain it is arguing with the product it explains.
//
// It also cost more than it looked. driver.js paints its own popover — white card,
// drop shadow, blue buttons — so `tour.css` grew to 249 lines whose stated job was
// "driver.js dressed as a native silica surface": a third-party control being
// re-skinned at higher specificity, which is precisely what RULE #1 exists to stop.
// The replacement composes silica's own Popover and Button, so a token change
// reaches it with no edit here at all.
//
// So this one rings ONE thing at a time (./anchor.ts), says what it is for, and
// waits. Nothing is dimmed, nothing is disabled, and every control on screen still
// works — including the one being pointed at. Wandering off mid-tour is not an
// escape from it; the chip is still on the status bar when you come back, on the
// step you left.
//
// ── WHY A MODULE STORE AND NOT CONTEXT ──────────────────────────────────────
//
// Three unrelated places read this: the chip on the status bar, the first-run
// driver in the shell, and the module-tour offers. A context would have to wrap
// all three, which means wrapping the shell, which means the tour re-renders the
// entire workbench on every step.

import { useCallback, useSyncExternalStore } from 'react';
import { clearRing } from './anchor';
import type { TourStep } from './types';

export interface TourHandlers {
  /** A step is now showing — used to persist the resume point. */
  onStepShown?: (step: TourStep, index: number) => void;
  /** Reached the end (pressed Got it on the last step). */
  onCompleted?: () => void;
  /** Left partway through, before the last step. */
  onSkipped?: (step: TourStep, index: number) => void;
}

export interface RunTourOptions extends TourHandlers {
  steps: TourStep[];
  /** Resume position; defaults to 0. */
  startIndex?: number;
}

export type TourState = { phase: 'idle' } | { phase: 'running'; steps: TourStep[]; index: number };

const IDLE: TourState = { phase: 'idle' };

let state: TourState = IDLE;
let handlers: TourHandlers = {};
const listeners = new Set<() => void>();

function set(next: TourState): void {
  state = next;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Start a tour. Replaces whatever was running, which is what both callers want —
 * "Take the tour" from the account menu and a module tour replayed from its panel
 * are each an explicit request for THIS tour now.
 */
export function runTour(opts: RunTourOptions): void {
  const { steps } = opts;
  handlers = {
    onStepShown: opts.onStepShown,
    onCompleted: opts.onCompleted,
    onSkipped: opts.onSkipped,
  };
  const index = Math.min(Math.max(opts.startIndex ?? 0, 0), Math.max(steps.length - 1, 0));
  // Guarded rather than asserted: an empty tour would be a content mistake, and it
  // should show nothing rather than crash the bar somebody is working under.
  if (steps.length === 0) {
    set(IDLE);
    return;
  }
  set({ phase: 'running', steps, index });
  const step = steps[index];
  if (step) handlers.onStepShown?.(step, index);
}

/** Advance. Past the last step this ENDS the tour as finished, which is the
 *  difference between "they have seen this" and "they got partway and left". */
export function nextStep(): void {
  if (state.phase !== 'running') return;
  const index = state.index + 1;
  if (index >= state.steps.length) {
    handlers.onCompleted?.();
    stopTour();
    return;
  }
  const step = state.steps[index];
  set({ phase: 'running', steps: state.steps, index });
  if (step) handlers.onStepShown?.(step, index);
}

export function previousStep(): void {
  if (state.phase !== 'running' || state.index === 0) return;
  const index = state.index - 1;
  const step = state.steps[index];
  set({ phase: 'running', steps: state.steps, index });
  if (step) handlers.onStepShown?.(step, index);
}

/** Leave partway through. The step reached is reported, so coming back later
 *  starts where they stopped rather than at the beginning again. */
export function leaveTour(): void {
  if (state.phase === 'running') {
    const step = state.steps[state.index];
    if (step) handlers.onSkipped?.(step, state.index);
  }
  stopTour();
}

/**
 * Tear down without reporting anything — the shell unmounting, or a caller
 * replacing one tour with another. Distinct from `leaveTour` on purpose: a
 * navigation away is not somebody deciding to stop, and recording it as a skip
 * would mark a tour they never chose to leave as abandoned.
 */
export function stopTour(): void {
  clearRing();
  handlers = {};
  set(IDLE);
}

export function useTourState(): TourState {
  return useSyncExternalStore(
    subscribe,
    () => state,
    () => IDLE
  );
}

/** The step showing right now, or null. */
export function currentStep(value: TourState): TourStep | null {
  return value.phase === 'running' ? (value.steps[value.index] ?? null) : null;
}

/** The three things the card can do, bound once so its buttons stay cheap. */
export function useTourActions() {
  return {
    next: useCallback(nextStep, []),
    back: useCallback(previousStep, []),
    leave: useCallback(leaveTour, []),
  };
}
