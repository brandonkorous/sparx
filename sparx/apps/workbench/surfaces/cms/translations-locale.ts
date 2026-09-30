'use client';

// Languages, and how far a product's wording has got in each of them.
//
// Its own file because none of this talks to the server. `translations-data.ts`
// owns the queries, the writes and the cache; everything here is a pure function
// over a language tag or a set of already-loaded rows — canonicalizing a tag the
// way the server will, naming it in the owner's words, and answering "is this
// language finished, and when was it last written".
//
// That second question is why the file exists at all. The coverage badge used to
// be built from a locale tag alone, which says a language EXISTS and nothing more
// — and a language exists the moment its NAME is saved, the one field a
// translation cannot be saved without. A barely-started translation and a
// finished one were the same green pill (issue 420).

import type { ProductTranslation } from './translations-data';

// The three tag helpers live in `lib/languages.ts` with the named shortlist the
// pickers offer, because three of the four panes that ask for a language could
// not see them here and kept a raw code box (issue 793). Re-exported so the
// screens that read this module keep reading this module.
import { canonicalLocale, isValidLocale, localeName } from '../../lib/languages';

export { canonicalLocale, isValidLocale, localeName };

/** A product's coverage as one readable phrase: "Not translated", "Spanish", or
 *  "Spanish, French +2". Names the first two languages and counts the rest so a
 *  row stays one line on a narrow pane. */
export function coverageSummary(rows: readonly ProductTranslation[]): string {
  if (rows.length === 0) return 'Not translated';
  const names = rows.map((row) => localeName(row.locale));
  if (names.length <= 2) return names.join(', ');
  return `${names.slice(0, 2).join(', ')} +${String(names.length - 2)}`;
}

/**
 * A language whose BODY TEXT is still the shop's own.
 *
 * The name is the only field a translation cannot be saved without, so "this
 * product has Spanish" and "this product has a Spanish name and an English
 * description" were the same green badge. A shopper reading the site in Spanish
 * sees the difference immediately; the owner never did.
 *
 * The two search fields are deliberately NOT counted. They fall back too, but to
 * words a shopper only meets on a results page, and flagging them would mark
 * almost every row unfinished — which would make the mark mean nothing.
 */
export function unfinishedLanguages(rows: readonly ProductTranslation[]): string[] {
  return rows.filter((row) => !row.description?.trim()).map((row) => localeName(row.locale));
}

/** What is unfinished, in a sentence a row can carry. Empty when nothing is. */
export function unfinishedNote(names: readonly string[]): string | null {
  if (names.length === 0) return null;
  if (names.length === 1) return `${names[0] ?? ''} has no description yet`;
  return `${String(names.length)} languages have no description yet`;
}

/** When this product's wording was last written in another language — the date a
 *  TRANSLATION screen means by "changed". Null when there is none. */
export function lastTranslatedAt(rows: readonly ProductTranslation[]): string | null {
  let latest: string | null = null;
  for (const row of rows) if (latest === null || row.updatedAt > latest) latest = row.updatedAt;
  return latest;
}
