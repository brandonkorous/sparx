// Finding one of the things you sell, at the counter or on the phone.
//
// Every row the picker draws has three parts: the product, the version under it,
// and the code on the box.
//
//     Rebuilt fuel injector     <- the product
//     6.7L · Stage 1            <- the version
//     INJ-67-S1                 <- the code on the box
//
// A picker that searched only the product name made the version disappear the
// moment it was typed: "injector 6.7" found nothing while six injectors sat on the
// screen, and the code read off the box in someone's hand found nothing either.
// Piggles measured it as its issue 749: 85% of the sellable versions on its
// machine share their product's name, so for most of what a business sells the
// version IS the identity.
//
// The dangerous half is the empty result. "Write it in by hand" invites typing
// in, as a one-off at a made-up price, something already sold at an agreed one.
//
// WORDS, NOT A SUBSTRING. "injector 6.7" and "6.7 injector" both have to work:
// nobody at a counter types a catalog string in catalog order. Every word has to
// land somewhere, the same rule the server's own contact search uses
// (`nameSearchClauses` in @wizeworks/db).

export interface SearchableSellable {
  name: string;
  /** The version: "6.7L · Stage 1", "45 minutes". Half the identity of most rows. */
  detail?: string | null;
  /** What is written on the box. */
  sku?: string | null;
  /**
   * Anything else the server's search matches that the row does not draw: a
   * version's own name, when its option values are what the row shows. The
   * server is asked first now (issue 069), and a row it found for a word must
   * not then be dropped here for the same word.
   */
  keywords?: string | null;
}

/** Everything about a row a person might type, as one lowercase haystack. */
function haystack(item: SearchableSellable): string {
  return [item.name, item.detail ?? '', item.sku ?? '', item.keywords ?? '']
    .join(' ')
    .toLowerCase();
}

/**
 * Whether a row answers what was typed.
 *
 * An empty query matches everything, which is what makes the list a LIST before
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
