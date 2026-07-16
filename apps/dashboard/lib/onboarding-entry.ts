// Where an unfinished tenant should (re)enter onboarding. The natural-language story
// flow (`/story`) is the PRIMARY front end as of 2026-06-30; the classic step wizard
// (`/onboarding`) stays fully supported, and the two are freely interchangeable — both
// front ends carry a switch link, and this module is the one place that decides which
// one an owner lands in.
//
// Routing rule, in precedence order:
//   1. The owner EXPLICITLY chose a front end (the switch links)              → that one
//   2. A story narrative exists (a committed story OR an in-progress draft)   → /story
//   3. The classic wizard was advanced (step moved off the first one, or any
//      step flagged complete) WITHOUT a story                                 → /onboarding
//   4. Otherwise — a fresh tenant                                             → /story (primary)
//
// Rule 1 is what makes the switch stick, and it has to outrank rule 2: the story
// composer debounce-saves a draft as you type, so `story` goes truthy within seconds of
// an owner touching it. Deriving from state alone, that draft is a one-way latch — it
// would bounce them back to /story on every visit no matter how they left. An explicit
// choice is the only signal that can say "I know there's a draft; I want the wizard."
//
// Below rule 1 this never yanks a tenant out of the flow they actually started: a story
// narrative resumes at /story, classic progress resumes at /onboarding, and only a blank
// slate defaults to the primary flow.

export type OnboardingFlow = 'story' | 'classic';

/** The route each front end lives at — the switch action and the entry rule share it. */
export const ONBOARDING_FLOW_HREF: Record<OnboardingFlow, '/story' | '/onboarding'> = {
  story: '/story',
  classic: '/onboarding',
};

export interface OnboardingEntryState {
  /** The owner's explicit front-end choice (`settings.onboarding.flow`), if any. */
  flow?: string | null;
  story?: Record<string, unknown> | null;
  currentStep?: string | null;
  completed?: Record<string, boolean> | null;
}

export function onboardingEntryHref(state: OnboardingEntryState): '/story' | '/onboarding' {
  if (state.flow === 'classic' || state.flow === 'story') return ONBOARDING_FLOW_HREF[state.flow];
  if (state.story) return '/story';
  const advancedClassic =
    (!!state.currentStep && state.currentStep !== 'modules') ||
    Object.values(state.completed ?? {}).some(Boolean);
  return advancedClassic ? '/onboarding' : '/story';
}

/** Where a tenant goes the moment they finish signing up. Arriving with a pre-picked
 *  blueprint (the marketplace/template funnel, docs/60 Ph5) enters the classic wizard,
 *  whose template step honors the pick; everyone else gets the blank-slate entry. Signup
 *  has no saved state yet, so this defers to the same rule as every other entry point
 *  rather than hardcoding a second copy of it. */
export function signupEntryHref(blueprintKey: string | null): string {
  if (blueprintKey) return `/onboarding?blueprint=${encodeURIComponent(blueprintKey)}`;
  return onboardingEntryHref({});
}
