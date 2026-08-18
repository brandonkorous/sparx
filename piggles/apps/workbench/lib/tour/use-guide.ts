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
// So this one stands in the status strip, the same shelf the "how's it going?"
// chip already uses for exactly this reason. It rings ONE thing at a time, says
// what it is for, and waits. Nothing is dimmed, nothing is disabled, and every
// control on screen still works — including the one being pointed at. Wandering
// off mid-guide is not an escape from it; the strip is still there when you come
// back, on the step you left.
//
// ── WHY A MODULE STORE AND NOT CONTEXT ──────────────────────────────────────
//
// Three unrelated places read this: the chip in the status strip, the effect
// that offers the shell guide, and the effect that offers an app's. A context
// would have to wrap all three, which means wrapping the shell, which means the
// guide re-renders the entire console on every step.

import { useCallback, useEffect, useSyncExternalStore } from 'react';
import { useWorkbench } from '../workbench/context';
import { guideSelector, type Guide, type GuideStep } from './types';

/** Set on the element a step is about. `lib/tour/guide.css` draws the ring. */
const HERE = 'data-guide-here';

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

function clearRing(): void {
  if (typeof document === 'undefined') return;
  for (const element of document.querySelectorAll(`[${HERE}]`)) element.removeAttribute(HERE);
}

/** Wait for an element to appear, giving up rather than hanging. A step whose
 *  anchor never arrives simply has no ring — the words still stand on their own,
 *  which is why every one of them is written to. */
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
 * view. Called once, from the chip.
 *
 * The screen is opened rather than merely assumed because an app's guide walks
 * that app's panel, and the panel is only there once the app is. The controller
 * re-focuses whatever is already open, so asking on every step costs nothing.
 */
export function useGuideAnchor(step: GuideStep | null): void {
  const { controller } = useWorkbench();

  useEffect(() => {
    clearRing();
    if (!step) return;

    let cancelled = false;
    if (step.app) browseApp(step.app);
    if (step.open) controller.open(step.open.surface, step.open.params);

    const selector = guideSelector(step);
    if (!selector) return;

    void waitFor(selector).then((element) => {
      if (cancelled || !element) return;
      element.setAttribute(HERE, '');
      element.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    });

    return () => {
      cancelled = true;
      clearRing();
    };
  }, [step, controller]);
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
