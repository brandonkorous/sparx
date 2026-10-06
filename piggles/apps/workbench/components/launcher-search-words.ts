// What the search box may honestly say when it finds nothing.
//
// ── The defect this exists for ───────────────────────────────────────────
//
// The box answered `Nothing in your records matches “Marlow”` about a product
// Juniper Row sells in ten sizes. It was not wrong about its own index; it was
// wrong about her records, and it is her records the sentence names.
//
// MEASURED on 2026-09-18, Juniper Row: 34 products, 36 customers and 16 orders
// in the database. In the search index: 3 products, 0 customers, 0 orders — and
// the 3 were only there because they had been edited that morning. Indexing
// rides on `search.entity.changed`, so anything seeded, imported or written
// while the indexer was down never enters and never will on its own.
//
// So the box could reach 3 of her 86 records, and told her the other 83 did not
// exist. [[feedback_never_present_absence_as_measurement]]
//
// The products LIST has said this since issue 318 — "Searching your shop won't
// find 31 of your products", with a button to put them back. It says it on a
// screen she is not looking at. The screen doing the lying carried nothing.

import { plural } from '../surfaces/inventory/data';

/** What `/v1/search/status` reports about each thing the box promises to find.
 *  `null` is "we could not look" — the collection is absent — and must never be
 *  read as "none missing" OR as "all missing". */
export interface SearchGaps {
  productsMissing: number | null;
  customersMissing: number | null;
  ordersMissing: number | null;
}

/** How many records the box cannot reach, and how to name them. `null` means
 *  nothing could be measured, which is silence rather than a number. */
export function blindSpot(gaps: SearchGaps | undefined): { total: number; label: string } | null {
  if (!gaps) return null;
  const parts: { count: number; one: string; many: string }[] = [
    { count: gaps.productsMissing ?? 0, one: 'product', many: 'products' },
    { count: gaps.customersMissing ?? 0, one: 'customer', many: 'customers' },
    { count: gaps.ordersMissing ?? 0, one: 'order', many: 'orders' },
  ];
  const named = parts.filter((p) => p.count > 0);
  if (named.length === 0) return null;

  const total = named.reduce((sum, p) => sum + p.count, 0);
  const words = named.map((p) => plural(p.count, p.one, p.many));
  // "31 products, 36 customers and 16 orders" — checkable against what she
  // knows she has, which "some of your records" is not.
  // `slice` rather than an index: under noUncheckedIndexedAccess `words[0]` is
  // possibly undefined, and a fallback there would be an empty sentence.
  const label =
    words.length === 1
      ? words.join('')
      : `${words.slice(0, -1).join(', ')} and ${words.slice(-1).join('')}`;
  return { total, label };
}

/**
 * The record half's own line, which is shown the moment anything is typed.
 *
 * Three readings, and the third is the new one: the box found nothing AND is
 * known to be missing records, so it may not say her records do not match. It
 * says what it can see and what it cannot.
 *
 * ── Why it has to be told how many SCREENS matched ───────────────────────
 *
 * Both endings point at the list: "The rest are screens" and "Everything below
 * is a screen". Neither had any way of knowing whether a screen was down there,
 * and both were printed regardless.
 *
 * SEEN ON SCREEN 2026-09-25, Juniper Row. Typing a customer's name, "Tamsin",
 * returned her, two of her invoices, a quote and two of her orders — six rows,
 * all of them records, not a screen among them — under "6 records matched. The
 * rest are screens." Typing something the shop has never heard of emptied the
 * list altogether and still finished "Everything below is a screen", directly
 * above nothing at all.
 *
 * So the count of matching screens is an argument now, and each ending is
 * printed only when the rows it describes exist. It is the same failure this
 * whole file was written to stop: a sentence that describes the list without
 * having read it. [[feedback_never_present_absence_as_measurement]]
 */
/**
 * The longest search the box sends. Past this it says the words are too long
 * rather than asking: a 24,000-character paste made a request the server
 * refused every time, and the box then said "try again in a moment", which
 * could never work. Far longer than any name, number or phrase anybody types.
 */
export const SEARCH_MOST_CHARS = 1000;

export function recordSearchLine(input: {
  searching: boolean;
  found: number;
  /** How many SCREENS matched. The two endings describe these rows, so without
   *  it the sentence is guessing at what the owner can see. */
  screens: number;
  query: string;
  gaps: SearchGaps | undefined;
  /** How many records matched and were NOT sent, because each search backend
   *  caps what it returns. Null or absent is "nothing said", never "none". */
  more?: number | null;
  /** Whether "Show more" can bring any of them back. */
  canShowMore?: boolean;
  /** The record search did not answer, so its silence is not a result. */
  failed?: boolean;
}): string {
  const typed = input.query.trim();
  if (typed.length > SEARCH_MOST_CHARS) {
    return 'That is too long to search. Try a few words from it.';
  }
  if (input.searching) return 'Looking through your records…';
  // Checked before any count: a search that did not answer has not looked, and
  // "Nothing in your records matches" is a claim only a search that looked may
  // make. A part that did answer is still shown, with what it cannot promise.
  if (input.failed) {
    return input.found > 0
      ? `${plural(input.found, 'record', 'records')} came back, but part of the search did not answer, so there may be more. Try again in a moment.`
      : 'The search could not reach your records just now, so this is not an answer. Try again in a moment.';
  }

  const blind = blindSpot(input.gaps);
  // `blindSpot` has always named a single record in the singular. This sentence
  // did not, so the box told Devi "1 customer are not in this box yet, so it
  // cannot look at them." The noun agreed and nothing around it did: the verb
  // and the pronoun were both written for a crowd.
  // [[feedback_a_fix_leaves_its_neighbour_behind]]
  const cannotSee = blind
    ? blind.total === 1
      ? ` ${blind.label} is not in this box yet, so it cannot look at that one.`
      : ` ${blind.label} are not in this box yet, so it cannot look at them.`
    : '';

  if (input.found > 0) {
    const rest = input.screens > 0 ? ' The rest are screens.' : '';
    return `${plural(input.found, 'record', 'records')} matched.${heldBackWords(input)}${rest}${cannotSee}`;
  }
  // "Nothing in your records matches" is a claim about her business. Only make
  // it when the box has actually looked at her business.
  // When no screen matched either, the list is empty and its own empty state is
  // already saying so. Adding "Everything below is a screen" points at nothing.
  const below = input.screens > 0 ? ' Everything below is a screen.' : '';
  if (blind) {
    return `Nothing the box can see matches “${typed}”.${cannotSee}${below}`;
  }
  return `Nothing in your records matches “${typed}”.${below}`;
}

/**
 * The records that matched and were not sent.
 *
 * The count above is of the rows the box was HANDED, and both search backends
 * cap what they hand over. So "12 records matched" was a true count of the
 * rows on screen and a false one of the records that matched, with nothing to
 * say the two differed. That is the case this sentence is for: it says how many
 * more there are, and the button beside it fetches them.
 * [[feedback_never_present_absence_as_measurement]]
 */
function heldBackWords(input: { more?: number | null; canShowMore?: boolean }): string {
  const more = input.more ?? 0;
  if (more <= 0) return '';
  const said = more === 1 ? '1 more matches' : `${String(more)} more match`;
  if (input.canShowMore) {
    return more === 1 ? ` ${said} and is not shown yet.` : ` ${said} and are not shown yet.`;
  }
  // At the most either backend will send: the only way to reach the rest is
  // fewer of them.
  return ` ${said}. Add another word to narrow it down.`;
}
