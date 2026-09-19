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
 */
export function recordSearchLine(input: {
  searching: boolean;
  found: number;
  query: string;
  gaps: SearchGaps | undefined;
}): string {
  const typed = input.query.trim();
  if (input.searching) return 'Looking through your records…';

  const blind = blindSpot(input.gaps);
  const cannotSee = blind
    ? ` ${blind.label} are not in this box yet, so it cannot look at them.`
    : '';

  if (input.found > 0) {
    return `${plural(input.found, 'record', 'records')} matched. The rest are screens.${cannotSee}`;
  }
  // "Nothing in your records matches" is a claim about her business. Only make
  // it when the box has actually looked at her business.
  if (blind) {
    return `Nothing the box can see matches “${typed}”.${cannotSee} Everything below is a screen.`;
  }
  return `Nothing in your records matches “${typed}”. Everything below is a screen.`;
}
