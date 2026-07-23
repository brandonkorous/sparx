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
