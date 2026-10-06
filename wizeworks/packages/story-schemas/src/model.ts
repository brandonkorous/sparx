// The story's state model — the shape every surface agrees on. The editable
// composer holds one `StoryState`; the marketing hero renders one read-only. The
// reducers, module resolution, and blueprint matching that only the composer needs
// stay in the dashboard (they reach for `lib/modules.ts`); this is the shared spine.

import { industryOf, type AudienceKey, type TenseKey } from './clauses';

export interface StoryState {
  tense: TenseKey | null;
  /** Industry slug (one of INDUSTRIES). The load-bearing spine. */
  industry: string | null;
  /**
   * The owner's OWN words for the business, when they typed it rather than picked a
   * starter ("diesel parts and repair"). Shown verbatim wherever the industry's noun
   * would be: the box offered "Use “diesel parts and repair”" and then printed "a
   * business", which threw away the one thing they told us (sparx persona issue 004).
   * Absent whenever a starter was picked; `industry` still decides the kit.
   */
  industryLabel?: string;
  audience: AudienceKey | null;
  /** Customer clauses → the opening's "…where they can A, B, and C". */
  cust: string[];
  /** Owner sentences, in order → "I'll …" then "I also …". Each is its own line. */
  lines: string[][];
  /** Inline object slots (e.g. dropship → "branded swag"), keyed by clause id. */
  slots: Record<string, string>;
  /** The chosen web handle → `<slug>.sparx.zone`. */
  name: string;
}

export const EMPTY_STORY: StoryState = {
  tense: null,
  industry: null,
  audience: null,
  cust: [],
  lines: [],
  slots: {},
  name: '',
};

/** The connector before item `i` of `n` when speaking a clause list — "", ", ",
 *  or an Oxford " and " / ", and ". Shared so the rendered sentence, the prose we
 *  persist, and the marketing hero all punctuate identically. */
export function connector(i: number, n: number): string {
  if (i === 0) return '';
  if (i === n - 1) return n > 2 ? ', and ' : ' and ';
  return ', ';
}

/** The words that open owner sentence `index`. A business you already RUN speaks in
 *  the present ("I share …. I also remember …"); one you want to START speaks in
 *  intent ("I’ll share …. I’ll also remember …"). The one source for the sentence on
 *  screen, the prose we persist and the marketing hero: the saved prose said "I’ll
 *  supply" under a screen that said "I supply" (sparx persona issue 010). */
export function lineLead(tense: TenseKey | null, index: number): string {
  const present = tense === 'current';
  if (index === 0) return present ? 'I' : 'I’ll';
  return present ? 'I also' : 'I’ll also';
}

/** What the story calls the business: the owner's own words when they typed them,
 *  else the starter's noun ("a salon"), else "a business". The ONE place every
 *  surface reads it from, so the sentence, the prose we persist and the build
 *  button can never name the business three different ways. */
export function storyNoun(s: Pick<StoryState, 'industry' | 'industryLabel'>): string {
  const own = s.industryLabel?.trim();
  if (own) return own;
  return s.industry ? industryOf(s.industry).noun : 'a business';
}

/** `storyNoun` without its leading article, for "Your salon" / "Build my salon". */
export function storySubject(s: Pick<StoryState, 'industry' | 'industryLabel'>): string {
  return storyNoun(s).replace(/^(an?|the) /i, '');
}
