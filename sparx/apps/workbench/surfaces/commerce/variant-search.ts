// Finding one version of one product, in a catalog of any size.
//
// The pickers over the variant catalog (the till, bundles, price lists, pricing
// tiers, returns, repeat orders) used to load the first 500 versions by product
// title and filter them here. A parts counter with 693 versions could then never
// find anything after roughly the 500th alphabetically: the part was on the
// shelf and the till said nothing matched (sparx persona P01, issue 069).
//
// The server searches now (`q` on `GET /v1/commerce/variants`). What stays here
// is the SAME rule, run on rows already in hand, for the quarter second between
// a keystroke and the server's answer: the list narrows as somebody types
// instead of sitting still and then jumping. It has to be the same rule, word
// for word and column for column, or the list would show one answer while
// typing and a different one a moment later. The server's half is
// `variantSearchClauses` in api-rest.

/** What of a version a person might type. */
export interface SearchableVariant {
  productTitle: string;
  sku: string;
  title: string | null;
  options: readonly { value: string }[];
}

/** The words typed, lowercased, in order, empties dropped. */
function wordsOf(query: string): string[] {
  return query.trim().toLowerCase().split(/\s+/).filter(Boolean);
}

/**
 * Whether a version answers what was typed.
 *
 * Every word has to land on the product's name, the version's code, the
 * version's own name or one of its option values ("6.7L", "Moss"). An empty
 * search matches everything, which is what makes the list a list before anybody
 * types.
 */
export function variantMatches(variant: SearchableVariant, query: string): boolean {
  const words = wordsOf(query);
  if (words.length === 0) return true;
  const fields = [
    variant.productTitle,
    variant.sku,
    variant.title ?? '',
    ...variant.options.map((option) => option.value),
  ].map((field) => field.toLowerCase());
  return words.every((word) => fields.some((field) => field.includes(word)));
}

/**
 * The rows a picker shows: one product's versions first when the pick is about
 * that product, then everything else the search found.
 *
 * The preferred product's versions are fetched on their own, because in a big
 * catalog they may sit nowhere near the first window: a returned part whose
 * name starts with "W" would otherwise open the swap list on parts starting
 * with "A" (persona issue 450, which only held while the catalog was small).
 * Both lists may hold the same version, so it is drawn once.
 */
export function pickerRows<T extends SearchableVariant & { id: string; productId: string }>(
  input: {
    found: readonly T[];
    preferred?: readonly T[];
    preferProductId?: string;
    query: string;
    excluded: ReadonlySet<string>;
  },
  limit = 40
): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  const consider = (rows: readonly T[]) => {
    for (const row of rows) {
      if (seen.has(row.id) || input.excluded.has(row.id)) continue;
      if (!variantMatches(row, input.query)) continue;
      seen.add(row.id);
      out.push(row);
    }
  };
  if (input.preferProductId) consider(input.preferred ?? []);
  consider(input.found);
  // Stable, so the shop's own option order survives within each group.
  if (input.preferProductId) {
    const mine = input.preferProductId;
    out.sort((a, b) => (a.productId === mine ? 0 : 1) - (b.productId === mine ? 0 : 1));
  }
  return out.slice(0, limit);
}
