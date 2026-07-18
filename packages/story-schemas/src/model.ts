// The story's state model — the shape every surface agrees on. The editable
// composer holds one `StoryState`; the marketing hero renders one read-only. The
// reducers, module resolution, and blueprint matching that only the composer needs
// stay in the dashboard (they reach for `lib/modules.ts`); this is the shared spine.

import type { AudienceKey, TenseKey } from './clauses';

export interface StoryState {
  tense: TenseKey | null;
  /** Industry slug (one of INDUSTRIES). The load-bearing spine. */
  industry: string | null;
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
