// The classic wizard's fixed vocabulary: the step order, what each step is called
// on the rail, and the heading it opens with.

import type { OnboardingStepKey } from '../../../lib/onboarding/types';
import { productCopy } from '../../../lib/product';
import { PRODUCT } from '@piggles/config';

export const FULL_ORDER: OnboardingStepKey[] = [
  'modules',
  'template',
  'workspace',
  'domain',
  'payments',
  'launch',
];

// The rail's words, in the reader's. "Modules" is the platform's own vocabulary and
// is banned in this product's copy; the rest follow it rather than being left as the
// only technical words on the screen.
export const STEP_LABEL: Record<OnboardingStepKey, string> = {
  modules: 'What you use',
  template: 'Starting point',
  workspace: 'Your name',
  domain: 'Web address',
  payments: 'Getting paid',
  launch: 'Go live',
};

export const HEAD: Partial<Record<OnboardingStepKey, { title: string; supporting: string }>> = {
  modules: {
    title: 'Switch on what you use',
    // NO PRICING SENTENCE. This read "your plan updates the instant you do" and "this
    // is just what you would pay after", which is another product's model: there is
    // one flat plan here and turning something on never changes it. Saying otherwise
    // on the first screen contradicts the marketing site on the same account.
    supporting:
      'Each one is a switch. Turn on what you want, leave the rest, and change your mind whenever you like. It never changes what you pay. What you pick decides which starting points you are shown next.',
  },
  template: {
    title: 'Pick a starting point',
    supporting:
      'Whole sites, finished: pages, design, things to sell and words already written. Narrowed to what you just switched on. Pick one and it is loaded in for you to change.',
  },
  workspace: {
    title: 'Name your workspace',
    supporting:
      'Your company and its first site. We pre-filled what you told us at signup — change anything. Your free web address goes live the moment you launch.',
  },
  domain: {
    title: 'Make it yours',
    supporting: productCopy(
      'onboarding.domain.pitch',
      `A web address of your own builds trust — and it is yours to keep. Set one up now, or start free on your ${PRODUCT.tenantSites.suffix} address and add your own anytime.`
    ),
  },
  payments: {
    title: 'Get paid',
    supporting:
      'Connect Stripe so your site can take customer payments. You can go live now and connect this whenever you are ready — checkout simply stays off until then.',
  },
};

// The steps where the "tell your story instead" switch is offered — always in the
// summary card, never the heading, so BOTH flows carry the flow-switch in the same
// place (the summary). Excludes payments/launch: by then the setup is committed and
// the story flow's own tail IS these same steps.
export const ALT_SWITCH_STEPS: OnboardingStepKey[] = ['modules', 'template', 'workspace', 'domain'];

/** The persisted state the wizard resumes from. */
export interface Initial {
  step: OnboardingStepKey;
  blueprintKey: string | null;
  /** This BRAND's starting point, from the server. Never a literal here — a
   *  console that names a blueprint key names some brand's (issue 091). */
  goldenKey: string | null;
  installId: string | null;
  /** Whether the last template choice took the design's examples (issue 098). */
  sampleData: boolean;
  templateDone: boolean;
  paymentsDone: boolean;
  companyName: string;
  slug: string;
  siteName: string;
}

/** What the one primary CTA says at each step. Depends only on the step and the
 *  three facts that change its wording, so it lives here with the vocabulary. */
export function ctaLabelFor(
  step: OnboardingStepKey,
  state: {
    startingFromScratch: boolean;
    paymentsConnected: boolean;
    buyingDomain: boolean;
    hasInstall: boolean;
  }
): string {
  switch (step) {
    case 'template':
      return state.startingFromScratch ? 'Start from scratch' : 'Use this starting point';
    case 'payments':
      return state.paymentsConnected ? 'Continue' : 'Skip for now';
    case 'launch':
      if (state.buyingDomain) return state.hasInstall ? 'Pay & publish' : 'Pay & finish';
      return state.hasInstall ? 'Publish my site' : 'Finish setup';
    default:
      return 'Continue';
  }
}

/** The step sequence for this tenant. Payments only appears when something is
 *  being sold — a business with nothing to charge for has nothing to connect. */
export function stepOrder(selling: boolean): OnboardingStepKey[] {
  return selling ? FULL_ORDER : FULL_ORDER.filter((s) => s !== 'payments');
}
