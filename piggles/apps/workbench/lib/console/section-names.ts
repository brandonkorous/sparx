// What Piggles calls every GROUP HEADING in the shared console's nav panels.
//
// Keyed by the platform's own section string, which does a second job: the
// platform ships "Setup", "Set up", "Setting up" and "Settings" as four separate
// strings meaning one thing, and "Reports" / "Reporting" as two more. Mapping
// them onto one Piggles word each collapses them everywhere at once, so a person
// moving between apps meets the same heading rather than four spellings of it.
//
// Split from ./vocabulary.ts, which holds the ~220 SCREEN names — a different
// list, read in a different place, and long enough on its own.

/**
 * Group headings inside a nav panel, keyed by the platform's own section string.
 *
 * Keyed by the STRING, so this also does a second job: the platform ships
 * "Setup", "Set up", "Setting up" and "Settings" as four separate strings that
 * all mean the same thing in different modules, and "Reports" / "Reporting" as
 * two more. Mapping them onto one Piggles word each collapses them everywhere at
 * once, and a person moving between apps meets the same heading rather than four
 * spellings of it.
 */
export const PIGGLES_SECTIONS: Readonly<Record<string, string>> = {
  // The four spellings of one idea.
  Setup: 'Setting it up',
  'Set up': 'Setting it up',
  'Setting up': 'Setting it up',
  Settings: 'Setting it up',

  // ...and the two spellings of another. "How it is going" rather than
  // "Reports", because nobody opens their software wanting a report; they want
  // to know how it is going.
  Reports: 'How it is going',
  Reporting: 'How it is going',
  Results: 'How it is going',

  // Category nouns, replaced by the job.
  Catalog: 'What you sell',
  Pricing: 'What you charge',
  Selling: 'Where you sell',
  'Product panels': 'On a product',
  'In progress': 'Half-finished',
  Structure: 'How it is organized',
  Localization: 'Other languages',
  Library: 'Your library',
  Design: 'Your pages',
  Forms: 'What people send you',
  Sales: 'Winning work',
  Support: 'Helping people',
  Customers: 'Worth chasing',
  Planning: 'Looking ahead',
  Making: 'Making things',
  Counting: 'Counting it',
  Buying: 'Buying it in',
  'Going out': 'Going out the door',
  Scanning: 'Barcodes and scanning',
  Trade: 'Wholesale',
  Checks: 'Health checks',
  Compliance: 'Keeping it legal',
  Bookings: 'Your diary',
  'Connections & access': 'Who can get in',
  'Did we make money': 'Did you make money',

  // "What sparx does" named the other product in the navigation. It groups the
  // screens that decide what this software is set up to do for you, which is a
  // true and brand-free way to say it.
  'What sparx does': 'How Piggles is set up',

  // No entry for 'What you pay sparx'. Its one surface is hidden — what a
  // Piggles business pays WizeWorks lives on getpiggles.com and never in the
  // console (piggles/CLAUDE.md RULE #2), so the heading has nothing under it and
  // never renders. Renaming it would be inventing a screen.
};

/**
 * Sections that open FOLDED, by their Piggles name.
 *
 * Not a tidiness preference — these three are the sections a person configures
 * once and then never opens again, and leaving them expanded costs the rows
 * that daily work needs. Customers is the case that forced it: its seven
 * setup screens are declared first in the platform's catalog, so the app whose
 * name is Customers opened on mailboxes and phone systems rather than on
 * customers.
 *
 * Keyed by the RESOLVED name, so it collapses the same four spellings of
 * "Setup" that PIGGLES_SECTIONS above already collapsed — one entry, not four.
 *
 * A person who opens one gets that remembered (./panel-sections.ts); this only
 * decides what happens before anybody has said anything.
 */
export const PIGGLES_QUIET_SECTIONS: ReadonlySet<string> = new Set([
  'Setting it up',
  'How it is going',
  // Nine deep links into a product's own tabs. They are reachable from any
  // product and are not screens somebody opens cold, so they sit folded rather
  // than taking a quarter of the Sell panel.
  'On a product',
]);
