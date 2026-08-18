// Which onboarding front end an unfinished tenant lands in.
//
// The natural-language story flow is the PRIMARY front end; the classic step
// wizard stays fully supported, and the two are freely interchangeable — both
// carry a switch link, and this module is the one place that decides the default.
//
// In the workbench there are no routes, so this resolves to a FLOW to mount, not
// an href — the gate reads it once, then the switch links flip it (and record the
// explicit choice) from there.
//
// Precedence:
//   1. The tenant EXPLICITLY chose a front end (a switch link)        → that one
//   2. A story narrative exists (committed OR an in-progress draft)   → story
//   3. The classic wizard was advanced (step moved off the first, or
//      any step flagged complete) WITHOUT a story                     → classic
//   4. Otherwise — a fresh tenant                                     → story
//
// Rule 1 outranks rule 2 for a reason: the story composer debounce-saves a draft
// as you type, so `story` goes truthy within seconds of touching it. Derived from
// state alone that draft is a one-way latch that would bounce a tenant back to the
// story flow no matter how they left. An explicit choice is the only signal that
// says "I know there's a draft; I want the wizard."

import type { OnboardingFlow, OnboardingState } from './types';

export type { OnboardingFlow };

export function resolveOnboardingFlow(state: OnboardingState | null | undefined): OnboardingFlow {
  if (!state) return 'story';
  if (state.flow === 'classic' || state.flow === 'story') return state.flow;
  if (state.story) return 'story';
  const advancedClassic =
    (!!state.currentStep && state.currentStep !== 'modules') ||
    Object.values(state.completed ?? {}).some(Boolean);
  return advancedClassic ? 'classic' : 'story';
}

/** Onboarding is finished when a finish/skip has stamped `finishedAt`. That is the
 *  single signal the shell gates on — everything else is progress, not completion. */
export function isOnboardingFinished(state: OnboardingState | null | undefined): boolean {
  return Boolean(state?.finishedAt);
}
