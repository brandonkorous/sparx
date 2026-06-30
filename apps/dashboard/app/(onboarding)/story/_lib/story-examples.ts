import type { StoryState } from './story-state';

// Default example stories the composer flips through on first load — proof of what
// the story can become, and a launchpad ("Start from this one" seeds the composer).
// Deliberately varied across verticals + module counts so the breadth reads at a
// glance: a 4-module salon, a 7-module local grocer, a services consultancy, a B2B
// distributor.
export interface StoryExample {
  /** Short label for the carousel, e.g. "a salon". */
  label: string;
  story: StoryState;
}

export const STORY_EXAMPLES: StoryExample[] = [
  {
    label: 'a salon',
    story: {
      tense: 'future',
      industry: 'salon',
      audience: 'people',
      cust: ['book', 'shop'],
      lines: [['blog'], ['crm']],
      slots: {},
      name: 'bella-salon',
    },
  },
  {
    label: 'a local grocer',
    story: {
      tense: 'current',
      industry: 'food',
      audience: 'people',
      cust: ['shop', 'pickup', 'ship'],
      lines: [['blog'], ['wholesale', 'dropship']],
      slots: { dropship: 'branded tote bags' },
      name: 'green-grocer',
    },
  },
  {
    label: 'a consultancy',
    story: {
      tense: 'current',
      industry: 'professional',
      audience: 'businesses',
      cust: ['book'],
      lines: [['invoicing', 'crm'], ['email']],
      slots: {},
      name: 'finch-advisory',
    },
  },
  {
    label: 'a distributor',
    story: {
      tense: 'current',
      industry: 'wholesale',
      audience: 'businesses',
      cust: ['shop'],
      lines: [['wholesale', 'invoicing'], ['crm']],
      slots: {},
      name: 'midwest-supply',
    },
  },
];
