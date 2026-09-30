// Finding one of the things you sell, at the counter or on the phone.
//
// The picker searched the PRODUCT NAME and nothing else, while every row it
// draws has three parts: the product, the version underneath it, and a code on
// the box in the workroom.
//
//     Marlow Knit          <- the only part that was searched
//     XL · Moss            <- drawn on the row, invisible to the box
//     MARLOW-KNIT-XL-MOSS  <- on the label, invisible to the box
//
// **MEASURED 2026-09-20: 2,030 of the 2,384 sellable versions on this machine
// share their product's name** — 85%, and 87 of 109 for the business being
// walked. So for most of what a maker sells, the version IS the identity, and
// typing it made the whole product disappear:
//
//     "Marlow"             8 rows to read through
//     "Marlow Knit XL"     nothing you sell is called that
//     "MARLOW-KNIT-XL-MOSS" nothing you sell is called that
//
// The second sentence is the dangerous half. "Add it by hand below" invites her
// to type in, as a one-off with a price she makes up, something she already
// sells at a price a shop has AGREED — which is issue 737 walking back in
// through the search box.
//
// WORDS, NOT A SUBSTRING. "Marlow XL" and "XL Marlow" both have to work: at a
// counter nobody types a catalog string in catalog order. Every word has to
// land somewhere, which is the same rule the server's own contact search uses
// (`nameSearchClauses` in @wizeworks/crm), so "Marlow Knit XL" narrows rather
// than failing.

export interface SearchableSellable {
  name: string;
  /** The version: "XL · Moss", "45 minutes". Half the identity of most rows. */
  detail?: string | null;
  /** What is written on the box. */
  sku?: string | null;
}

/** Everything about a row that a person might type, as one lowercase haystack. */
function haystack(item: SearchableSellable): string {
  return [item.name, item.detail ?? '', item.sku ?? ''].join(' ').toLowerCase();
}

/**
 * Whether a row answers what was typed.
 *
 * Empty query matches everything, which is what makes the list a LIST before
 * anybody types. Otherwise every word must appear somewhere in the row.
 */
export function sellableMatches(item: SearchableSellable, query: string): boolean {
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return true;
  const hay = haystack(item);
  return words.every((word) => hay.includes(word));
}

/** The rows to show, capped so the box stays a box rather than a catalog. */
export function matchingSellables<T extends SearchableSellable>(
  items: readonly T[],
  query: string,
  limit = 12
): T[] {
  const out: T[] = [];
  for (const item of items) {
    if (!sellableMatches(item, query)) continue;
    out.push(item);
    if (out.length === limit) break;
  }
  return out;
}
