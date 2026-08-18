'use client';

// The runtime — and the one design decision the whole feature turns on.
//
// ── IT NEVER COVERS THE WORK ────────────────────────────────────────────────
//
// The usual shape for this is a spotlight: dim the screen, cut a hole over one
// control, float a card next to it, trap the keyboard until somebody presses
// Next. It teaches well and it is the wrong shape here, because this console's
// whole premise is that the OPERATOR decides what occupies the screen — panes
// they placed, windows they tore off, a rail they chose. A guide that blacks all
// of that out to explain it is arguing with the product it is explaining.
//
// So this one rings ONE thing at a time, says what it is for, and waits. Nothing
// is dimmed, nothing is disabled, and every control on screen still works —
// including the one being pointed at. Wandering off mid-guide is not an escape
// from it; the chip is still on the strip when you come back, on the step you
// left.
//
// Note what that argument does NOT settle: WHERE the words go. It is a claim
// about modality, and for a while it was misread as "park the card in the corner
// with the chip" — which put the sentence about a nav row some 900px from the
// row. The card now sits beside whatever is ringed (./anchor.ts) and falls back
// to the strip only when a step has nothing to point at.
//
// ── WHY A MODULE STORE AND NOT CONTEXT ──────────────────────────────────────
//
// Three unrelated places read this: the chip in the status strip, the effect
// that offers the shell guide, and the effect that offers an app's. A context
// would have to wrap all three, which means wrapping the shell, which means the
// guide re-renders the entire console on every step.

import { useCallback, useSyncExternalStore } from 'react';
import { clearRing } from './anchor';
import type { Guide, GuideStep } from './types';

export interface GuideHandlers {
  /** A step is now showing — used to remember the resume point. */
  onStep?: (step: GuideStep) => void;
  /** Reached the end. */
  onDone?: () => void;
  /** Left partway through. */
  onLeft?: (step: GuideStep) => void;
  /** Said no to the offer; it never ran. */
  onDeclined?: () => void;
}

export type GuideState =
  | { phase: 'idle' }
  | { phase: 'offering'; guide: Guide }
  | { phase: 'running'; guide: Guide; index: number };

const IDLE: GuideState = { phase: 'idle' };

let state: GuideState = IDLE;
let handlers: GuideHandlers = {};
let resumeAt = 0;
const listeners = new Set<() => void>();

/**
 * Guides already put on the strip in this browsing session.
 *
 * ── WHY THE ONCE-ONLY GUARD LIVES HERE AND NOT IN A COMPONENT REF ───────────
 *
 * It was a ref. In development React mounts, runs effects, unmounts and remounts
 * every component — so the settle timer was cancelled by the simulated unmount
 * while the ref, which survives it, said "already offered". The guide was built,
 * mounted, correct, wired, and completely silent, in a way no type or test
 * could see. It took watching a real screen to find.
 *
 * The durable answer is that "already offered" is session state, and session
 * state belongs with the rest of it. A module-level set is not remounted, so it
 * cannot disagree with a timer, and both remounts and preference refetches
 * become harmless retries of an idempotent call.
 */
const offeredThisSession = new Set<string>();

function set(next: GuideState): void {
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
 * Put a guide on the strip as an offer. Idempotent per session.
 *
 * Ignored when something is already showing — two offers arriving together (the
 * shell guide and an app's, on a first visit that lands straight in an app) is a
 * real sequence, and the second must not shove the first aside mid-sentence.
 * Ignored again once this guide has been offered at all, so callers may retry
 * freely without needing a guard of their own.
 */
export function offerGuide(
  guide: Guide,
  options: GuideHandlers & { resumeFrom?: number } = {}
): void {
  if (state.phase !== 'idle') return;
  if (offeredThisSession.has(guide.id)) return;
  offeredThisSession.add(guide.id);
  handlers = options;
  resumeAt = options.resumeFrom ?? 0;
  set({ phase: 'offering', guide });
}

/** Start one straight away — what "Show me around" in an app's panel does. */
export function startGuide(guide: Guide, options: GuideHandlers = {}): void {
  handlers = options;
  resumeAt = 0;
  set({ phase: 'running', guide, index: 0 });
  // Guarded rather than asserted: an empty guide would be a content mistake, and
  // it should show nothing rather than crash the strip somebody is working under.
  const first = guide.steps[0];
  if (first) handlers.onStep?.(first);
}

export function acceptOffer(): void {
  if (state.phase !== 'offering') return;
  const index = Math.min(resumeAt, state.guide.steps.length - 1);
  const step = state.guide.steps[index];
  set({ phase: 'running', guide: state.guide, index });
  if (step) handlers.onStep?.(step);
}

export function declineOffer(): void {
  if (state.phase !== 'offering') return;
  handlers.onDeclined?.();
  clearRing();
  handlers = {};
  set(IDLE);
}

export function nextStep(): void {
  if (state.phase !== 'running') return;
  const index = state.index + 1;
  if (index >= state.guide.steps.length) {
    handlers.onDone?.();
    clearRing();
    handlers = {};
    set(IDLE);
    return;
  }
  const step = state.guide.steps[index];
  set({ phase: 'running', guide: state.guide, index });
  if (step) handlers.onStep?.(step);
}

export function previousStep(): void {
  if (state.phase !== 'running' || state.index === 0) return;
  const index = state.index - 1;
  const step = state.guide.steps[index];
  set({ phase: 'running', guide: state.guide, index });
  if (step) handlers.onStep?.(step);
}

/** Leave partway through. The step reached is reported, so coming back later
 *  starts where they stopped rather than at the beginning again. */
export function leaveGuide(): void {
  if (state.phase === 'running') {
    const step = state.guide.steps[state.index];
    if (step) handlers.onLeft?.(step);
  }
  clearRing();
  handlers = {};
  set(IDLE);
}

export function useGuideState(): GuideState {
  return useSyncExternalStore(
    subscribe,
    () => state,
    () => IDLE
  );
}

/** The step showing right now, or null. */
export function currentStep(value: GuideState): GuideStep | null {
  return value.phase === 'running' ? (value.guide.steps[value.index] ?? null) : null;
}

/** The four things the chip can do, bound once so its buttons stay cheap. */
export function useGuideActions() {
  return {
    accept: useCallback(acceptOffer, []),
    decline: useCallback(declineOffer, []),
    next: useCallback(nextStep, []),
    back: useCallback(previousStep, []),
    leave: useCallback(leaveGuide, []),
  };
}
