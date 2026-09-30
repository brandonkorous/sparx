import type { PigglesGroup } from '@piggles/brand';
import type { PigglesAppId } from '@piggles/config';
import type { MascotPoseId } from '@piggles/mascot';

// The shape of one /for/<trade> page. One file per trade; `./index.ts` assembles them.
// Every claim must match what content/apps/*.ts already says the app does today.

/** A thing that goes wrong for this trade today, before Piggles. */
export interface TradeProblem {
  title: string;
  body: string;
}

/** One moment in the trade's week, and the app that handles it. */
export interface TradeMoment {
  /** When it happens, in the owner's words: "Monday, 6am". */
  when: string;
  /** What happens, and what Piggles does about it. */
  body: string;
  app: PigglesAppId;
}

export interface TradeQuestion {
  q: string;
  a: string;
}

/** Something this trade uses today, and the app that takes its place. */
export interface TradeTool {
  /** Generic, never a company name: "a paper appointment book", "a booking app". */
  today: string;
  instead: PigglesAppId;
  /** Why the swap is better for THIS trade. One or two sentences. */
  why: string;
}

/** One leaned-on app, told for this trade specifically. */
export interface TradeAppDetail {
  app: PigglesAppId;
  /** A claim in the owner's words, not the app name. */
  heading: string;
  body: string;
  /** What it does for this trade. Four to six, each a full sentence. */
  points: string[];
}

export interface TradeCost {
  heading: string;
  body: string;
  /** What the price covers for this trade, and what could add to it. Four to six. */
  points: string[];
}

export interface TradePage {
  /** URL slug: /for/<slug>. */
  slug: string;
  pose: MascotPoseId;
  group: PigglesGroup;
  /** As on /who-its-for: "A bakery". */
  name: string;
  /** Plural, for nav and titles: "Bakeries". */
  plural: string;
  /** The short card paragraph on /who-its-for. */
  shape: string;
  /** The apps this trade leans on hardest. Three or four. */
  leans: PigglesAppId[];
  /** Page h1. A claim in the owner's words. */
  heading: string;
  lede: string;
  /** What the owner would type into a search box ("bakery software"). */
  searchTerms: string[];
  /** What goes wrong today. Three or four. */
  problems: TradeProblem[];
  /** The one sentence that turns the page from the problem to the answer. */
  turn: string;
  /** A real week, run on Piggles. Five to seven moments. */
  week: TradeMoment[];
  /** What this trade pays for or juggles today. Four to six. */
  replaces: TradeTool[];
  /** One entry per app in `leans`, same order. */
  inDepth: TradeAppDetail[];
  /** Moving over from what they use now. Three steps, each title + body. */
  switching: TradeProblem[];
  cost: TradeCost;
  /** What to set up in the first hour. Three to five steps. */
  firstHour: string[];
  /** The questions this owner actually asks before buying. Four to six. */
  questions: TradeQuestion[];
}
