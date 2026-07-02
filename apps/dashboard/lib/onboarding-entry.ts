// Where an unfinished tenant should (re)enter onboarding. The natural-language story
// flow (`/story`) is the PRIMARY front end as of 2026-06-30; the classic step wizard
// (`/onboarding`) stays fully supported and is the entry for anyone already mid-way
// through it or arriving with a pre-picked blueprint (the marketplace/template funnel,
// which the wizard's template step honors).
//
// Routing rule, in precedence order:
//   1. A story narrative exists (a committed story OR an in-progress draft) → /story
//   2. The classic wizard was advanced (step moved off the first one, or any
//      step flagged complete) WITHOUT a story                               → /onboarding
//   3. Otherwise — a fresh tenant                                           → /story (primary)
//
// This never yanks a tenant out of the flow they actually started: a story narrative
// always resumes at /story, classic progress always resumes at /onboarding, and only a
// blank slate defaults to the primary flow.

export interface OnboardingEntryState {
  story?: Record<string, unknown> | null;
  currentStep?: string | null;
  completed?: Record<string, boolean> | null;
}

export function onboardingEntryHref(state: OnboardingEntryState): '/story' | '/onboarding' {
  if (state.story) return '/story';
  const advancedClassic =
    (!!state.currentStep && state.currentStep !== 'modules') ||
    Object.values(state.completed ?? {}).some(Boolean);
  return advancedClassic ? '/onboarding' : '/story';
}
