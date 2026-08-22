import { LEXICON } from '@piggles/config';
import type { OnboardingStep } from './types';

// api-rest speaks sparx. This turns what it says into Piggles.
//
// The first-run checklist is DERIVED SERVER-SIDE — api-rest composes the titles,
// the descriptions and the CTA labels and hands them over as strings
// (`/v1/tenant/onboarding/progress`). That service is shared platform code with
// two brands behind it, so its copy is sparx's copy, and Piggles rendered it
// verbatim. On the very first screen a new Piggles customer is offered, that read:
//
//     Add your first page      →  [ Open CMS ]
//     Choose a template — "or design your own in the Builder."
//
// "CMS" is in `BANNED_IN_PRODUCT_COPY`, which is the enforceable half of
// piggles/CLAUDE.md RULE #3, and "the Builder" is a product name this console does
// not use — it calls that screen My Site. Marisol has never heard either word.
// Issue #008.
//
// WHY TRANSLATE RATHER THAN CHANGE THE SOURCE. Editing api-rest's strings would
// re-word sparx's checklist too, and sparx's customers DO say CMS and Builder —
// those are its real product names. One service, two vocabularies, so the
// translation belongs on the Piggles side of the wire. This file is that side.
//
// It sits beside `surfaceForHref`, which already translates the other half of the
// same payload (an href into a surface key) for exactly the same reason.
//
// WHAT THIS IS NOT. It is not a general string filter and must not become one.
// Copy that Piggles OWNS is written in Piggles' words in the first place; this
// only exists for text arriving from a shared service at runtime. If a phrase
// here has to get clever to be right, the honest answer is a Piggles-specific
// field on the API, not a longer regex.

/** sparx's word → Piggles' word. Ordered longest-first at use, so
 *  "the Builder" wins over "Builder" and the article does not survive. */
const WORDS: [RegExp, string][] = [
  [/\bthe Builder\b/g, LEXICON.site],
  [/\bBuilder\b/g, LEXICON.site],
  [/\bthe CMS\b/g, LEXICON.cms],
  [/\bCMS\b/g, LEXICON.cms],
  [/\bthe CRM\b/g, LEXICON.crm],
  [/\bCRM\b/g, LEXICON.crm],
  [/\bstorefront\b/g, 'shop'],
  [/\bStorefront\b/g, 'Shop'],
  // "Purchase a domain or connect one you already own" reads as though an address
  // is something she still has to buy. Every Piggles business is given one at
  // signup and the account app says so, so the sentence has to start from the
  // address she already has. The console must not talk about price at all
  // (piggles/CLAUDE.md RULE #2), which "purchase" edges towards.
  [
    /Purchase a domain or connect one you already own\./g,
    'You already have one. Use your own web address instead whenever you are ready.',
  ],
  [/\bPurchase a domain\b/g, 'Use your own web address'],
];

function say(text: string): string {
  return WORDS.reduce((out, [pattern, word]) => out.replace(pattern, word), text);
}

/** One checklist step, in Piggles' words. */
export function pigglesStep<T extends OnboardingStep>(step: T): T {
  return {
    ...step,
    title: say(step.title),
    description: step.description ? say(step.description) : step.description,
    cta: step.cta ? { ...step.cta, label: say(step.cta.label) } : step.cta,
  };
}
