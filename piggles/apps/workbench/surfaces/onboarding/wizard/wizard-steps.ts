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

export const STEP_LABEL: Record<OnboardingStepKey, string> = {
  modules: 'Modules',
  template: 'Starting point',
  workspace: 'Workspace',
  domain: 'Domain',
  payments: 'Payments',
  launch: 'Launch',
};

export const HEAD: Partial<Record<OnboardingStepKey, { title: string; supporting: string }>> = {
  modules: {
    title: 'Switch on what you use',
    supporting:
      'Every module is one toggle — flip it and your plan updates the instant you do. You are free for 14 days with no card; this is just what you would pay after. Your picks narrow the starting points next.',
  },
  template: {
    title: 'Pick a starting point',
    supporting:
      'Complete, themed sites — pages, design, products, and copy in place from the first second. Filtered to the modules you chose; pick one to load it into your setup.',
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
