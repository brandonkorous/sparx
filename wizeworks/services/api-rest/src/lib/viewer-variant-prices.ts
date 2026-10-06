// The signed-in trade buyer's own price on each version of a product, for the
// builder's product feed (sparx persona issue 086).
//
// The feed (`/v1/public/commerce/products/full`) printed the list price to every
// visitor, so a trade buyer saw their agreed price on the shop pages and the list
// price on a builder page beside them. It now answers per buyer, like the product
// listing does: their own price per version, by the rule the product page and
// cart use (issue 086: a tier price was missing from every list).

/** The versions whose agreed price differs from the list price, mapped to it. A
 *  version priced the same is left out, so nothing is struck through for nothing. */
export function viewerVariantPrices(
  variants: readonly { id: string; priceCents: number }[],
  agreed: ReadonlyMap<string, number>
): Map<string, number> {
  const out = new Map<string, number>();
  for (const v of variants) {
    const cents = agreed.get(v.id);
    if (cents !== undefined && cents !== v.priceCents) out.set(v.id, cents);
  }
  return out;
}

/** One version as the price rule needs it. */
export interface PricedVersion {
  id: string;
  currency: string;
  priceCents: number;
}

/**
 * What the buyer pays for each version, asked of `priceOne` (the product page's
 * own rule), kept only where it differs from the version's own price. Asked one
 * at a time, like the cart, so a page of cards does not take the whole
 * connection pool at once.
 *
 * Cards used to read the buyer's contract price alone. A business priced by its
 * tier has no contract row, so Wasatch Front (Fleet, 12% off) saw a kit at
 * $400.00 in search and $352.00 on its page one click later (issue 086).
 */
export async function viewerUnitPrices(
  versions: readonly PricedVersion[],
  priceOne: (version: PricedVersion) => Promise<number>
): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  for (const v of versions) {
    const cents = await priceOne(v);
    if (cents !== v.priceCents) out.set(v.id, cents);
  }
  return out;
}

/** The buyer's price for a card, or null when there is none to show: no own
 *  price, or the same figure the card already prints (a set's card shows what
 *  its parts come to, and striking that through for itself says nothing). */
export function cardYourPrice(
  theirs: number | undefined,
  cardPriceCents: number | null
): number | null {
  return theirs === undefined || theirs === cardPriceCents ? null : theirs;
}
