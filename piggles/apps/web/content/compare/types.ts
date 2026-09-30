import type { PigglesAppId } from '@piggles/config';

// The shape of one /compare/<slug> page. One file per competitor; `./index.ts`
// assembles them. Every fact about the competitor comes from
// piggles/docs/marketing/COMPETITORS-2026-09-30.md, which names the page it was
// read from. Every fact about Piggles comes from ./areas.ts, which is checked
// against the code.
//
// No competitor prices, ever (piggles/DESIGN.md §10). How their bill is SHAPED
// (per seat, sold separately, a fee on each sale) is a fact a buyer needs; the
// number is theirs to publish and changes without telling us.

/**
 * How a thing is offered.
 *
 * `unconfirmed` exists so a row we could not check on the competitor's own site
 * never shows as "no". Saying a rival lacks something they have is the fastest
 * way to lose the reader who knows better.
 */
export type Offer = 'built-in' | 'partly' | 'add-on' | 'other-app' | 'no' | 'unconfirmed';

/** The things a small business looks for, in the order the table shows them. */
export type AreaId =
  | 'website'
  | 'store'
  | 'in-person'
  | 'bookings'
  | 'invoices'
  | 'customers'
  | 'help-desk'
  | 'email'
  | 'texts'
  | 'social'
  | 'stock'
  | 'purchase-orders'
  | 'team'
  | 'payroll'
  | 'automations'
  | 'ai'
  | 'accounting';

/** One cell: how it is offered, and one short line on what that means. */
export interface AreaCell {
  offer: Offer;
  note: string;
}

export interface CompareQuestion {
  q: string;
  a: string;
}

/** A point in one side's favor. */
export interface ComparePoint {
  title: string;
  body: string;
}

export interface ComparePage {
  /** URL slug: /compare/<slug>. */
  slug: string;
  /** Their name, as they write it. */
  name: string;
  /** What they are, in one plain line: "a payments and till company". */
  isA: string;
  /** The page h1. */
  heading: string;
  lede: string;
  /** Searches this page answers: "Square alternative", "Piggles vs Square". */
  searchTerms: string[];
  /** Where they are the better choice. Always first on the page, always true. */
  theyWin: ComparePoint[];
  /** The sentence that turns the page: what each one is built around. */
  turn: string;
  /** Where Piggles fits better, for the business this page is written for. */
  weWin: ComparePoint[];
  /** Their side of the table. Every area is required, so none is quietly skipped. */
  areas: Record<AreaId, AreaCell>;
  /** How their bill is shaped. Structure only, never a figure. */
  billShape: string[];
  /** What happens when you move from them to Piggles. */
  moving: {
    body: string;
    /** What Move in reads from their exports, by their own names for it. */
    comesAcross: string[];
    /** What does not, said plainly. */
    staysBehind: string[];
  };
  /** Pick them if... */
  pickThem: string[];
  /** Pick Piggles if... */
  pickUs: string[];
  questions: CompareQuestion[];
  /** Their own pages the facts were read from. */
  sources: { label: string; href: string }[];
  /** The apps this comparison leans on, for links. */
  leans: PigglesAppId[];
}
