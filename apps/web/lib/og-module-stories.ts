import type { ImageResponse } from 'next/og';
import type { ModuleKey } from '@sparx/brand';
import type { StoryState } from '@sparx/story-schemas';
import { moduleHeadlineHue, renderStoryOg } from './og-story';

// Per-module social cards, built on the same story-card system as the homepage
// (lib/og-story.tsx). Each module page tells a COMPLETE story that features its
// own clause — the Commerce card shows someone selling, the Scheduling card shows
// someone taking bookings — so the module's value is demonstrated, not asserted.
//
// Each is a DIFFERENT vertical from its neighbours (so the set reads as a spectrum,
// not one story recoloured), the headline is a per-module riff on the motto
// ("Your sales," / "Your bookings," → "multiplied."), and the headline's payoff
// word wears the MODULE's own hue via `moduleHeadlineHue` for instant identity.
// Handles are fictional and unique — none reuse a homepage/example name.

interface ModuleStoryCard {
  /** Headline line 1; line 2 is always "multiplied." */
  lead: string;
  /** The module whose hue the headline wears + whose clause the story features. */
  module: ModuleKey;
  story: StoryState;
}

const CARDS: Record<string, ModuleStoryCard> = {
  builder: {
    lead: 'Your site,',
    module: 'builder',
    story: {
      tense: 'future',
      industry: 'apparel',
      audience: 'people',
      cust: ['shop', 'ship'],
      lines: [['blog'], ['email']],
      slots: {},
      name: 'wildthread',
    },
  },
  commerce: {
    lead: 'Your sales,',
    module: 'commerce',
    story: {
      tense: 'future',
      industry: 'electronics',
      audience: 'people',
      cust: ['shop', 'ship'],
      lines: [['crm']],
      slots: {},
      name: 'volt-and-bolt',
    },
  },
  cms: {
    lead: 'Your words,',
    module: 'cms',
    story: {
      tense: 'current',
      industry: 'food',
      audience: 'people',
      cust: ['shop', 'pickup'],
      lines: [['blog'], ['email']],
      slots: {},
      name: 'daily-crumb',
    },
  },
  crm: {
    lead: 'Your customers,',
    module: 'crm',
    story: {
      tense: 'current',
      industry: 'salon',
      audience: 'people',
      cust: ['book', 'shop'],
      lines: [['crm'], ['email']],
      slots: {},
      name: 'glow-house',
    },
  },
  email: {
    lead: 'Your message,',
    module: 'email',
    story: {
      tense: 'future',
      industry: 'fitness',
      audience: 'people',
      cust: ['classes'],
      lines: [['email'], ['crm']],
      slots: {},
      name: 'peak-athletics',
    },
  },
  scheduling: {
    lead: 'Your bookings,',
    module: 'scheduling',
    story: {
      tense: 'current',
      industry: 'professional',
      audience: 'businesses',
      cust: ['book'],
      lines: [['invoicing'], ['crm']],
      slots: {},
      name: 'harbor-consulting',
    },
  },
  b2b: {
    lead: 'Your accounts,',
    module: 'b2b',
    story: {
      tense: 'current',
      industry: 'wholesale',
      audience: 'businesses',
      cust: ['shop'],
      lines: [['wholesale', 'invoicing'], ['crm']],
      slots: {},
      name: 'ironwood-supply',
    },
  },
  dropship: {
    lead: 'Your catalog,',
    module: 'dropship',
    story: {
      tense: 'future',
      industry: 'apparel',
      audience: 'people',
      cust: ['shop', 'ship'],
      lines: [['dropship']],
      slots: { dropship: 'branded gear' },
      name: 'trailhead-goods',
    },
  },
  ai: {
    lead: 'Your team,',
    module: 'ai',
    story: {
      tense: 'current',
      industry: 'food',
      audience: 'people',
      cust: ['shop', 'pickup'],
      lines: [['ai'], ['crm']],
      slots: {},
      name: 'corner-market',
    },
  },
  social: {
    lead: 'Your reach,',
    module: 'social',
    story: {
      tense: 'future',
      industry: 'apparel',
      audience: 'people',
      cust: ['shop', 'ship'],
      lines: [['email'], ['crm']],
      slots: {},
      name: 'field-day-supply',
    },
  },
  // "Your margins" rather than "Your money": the card has to say the module is
  // about what is LEFT, not about takings — every other module on this page
  // already moves money. The story is a services business that both sells and
  // invoices, because that is the shape where a job can quietly lose money.
  //
  // There is no `finance` CLAUSE in the story grammar (clauses.ts) and this does
  // not need one — the clause list is the onboarding composer's vocabulary, and
  // adding a term there is an onboarding change, not a marketing one.
  finance: {
    lead: 'Your margins,',
    module: 'finance',
    story: {
      tense: 'current',
      industry: 'professional',
      audience: 'businesses',
      cust: ['book', 'shop'],
      lines: [['invoicing'], ['inventory']],
      slots: {},
      name: 'northline-studio',
    },
  },
  // "Your stock" — the only honest lead word for this module, because the whole
  // pitch is that the figure is trustworthy rather than that there is more of
  // it. The vertical is food and drink: it is the shape where a batch has a date
  // on it and running out is visible to a customer the same morning, and it puts
  // the `inventory` clause in the owner's voice ("always know what's in stock")
  // as the story's own first line rather than as a supporting one.
  inventory: {
    lead: 'Your stock,',
    module: 'inventory',
    story: {
      tense: 'current',
      industry: 'food',
      audience: 'both',
      cust: ['shop', 'pickup'],
      lines: [['inventory'], ['wholesale']],
      slots: {},
      name: 'kestrel-roasters',
    },
  },
  // "Your hours" — the unit this module turns into money, and the one word that
  // says what it is without saying "payroll" (it is not). The vertical is the
  // last one the set had not used, and it is also the honest one: a shop with
  // technicians on the floor is exactly where an hour has a cost and a licence
  // has an expiry date.
  staff: {
    lead: 'Your hours,',
    module: 'staff',
    story: {
      tense: 'current',
      industry: 'auto-parts',
      audience: 'businesses',
      cust: ['book', 'shop'],
      lines: [['invoicing'], ['crm']],
      slots: {},
      name: 'ridgeline-service',
    },
  },
};

/** Render the story OG card for a built module page (its route slug). Throws on an
 *  unknown slug so a missing card fails the build rather than shipping blank. */
export function renderModuleStoryCard(slug: string): ImageResponse {
  const card = CARDS[slug];
  if (!card) throw new Error(`No module story OG card is defined for "${slug}".`);
  return renderStoryOg({
    story: card.story,
    headline: { lead: card.lead, accent: 'multiplied.' },
    accentColor: moduleHeadlineHue(card.module),
    footerRight: `sparx.works/${slug}`,
  });
}
