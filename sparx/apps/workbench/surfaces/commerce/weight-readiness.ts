// What happens to a delivery price when nobody has said what the thing weighs
// (issue 873).
//
// `resolvePackageForItems` prices a line at `DEFAULT_ITEM_WEIGHT_GRAMS` when
// there is no weight on the version and none on the product. That is the right
// call on its own terms: a shopper must always be able to get a quote, and
// refusing one would break checkout over a field the shop never filled in.
//
// It was silent, though, and two things are priced off it:
//
//   1. A rate whose type is **Priced by weight**. Its bands are entered in
//      kilograms, and every line lands in the band the guess puts it in, so a
//      coat and a scarf cost the same to post and the bands are really counting
//      items.
//   2. Every LIVE carrier quote. The carrier prices the real parcel, so the
//      difference between the guess and the box is money the shop pays and the
//      shopper was never charged.
//
// Measured when this was written: **1,280 of 2,369 sellable, postable things had
// no weight at either level, across 40 tenants, and 36 of those had not one
// weight recorded at all.** Devi's own shop was 106 of 106.
//
// This is the same silence `shipFromIssue` already answers on this surface: a
// carrier connected, live rates quietly not happening, and nothing on screen
// saying why. Both sentences now come from the server's readiness read.
//
// Logic lives here rather than in the pane so it can be tested: a `.tsx` cannot
// be imported by vitest in this app (`jsx: preserve`).

/** Just the part of the readiness read this module needs, so a test does not
 *  have to build a carrier list to ask about a weight. */
export interface WeightFacts {
  shippableItems: number;
  itemsMissingWeight: number;
  assumedWeightGrams: number;
}

export interface WeightGap {
  /** How many sellable, postable things have no weight. Always at least 1. */
  missing: number;
  /** How many could be posted at all, so the count above has a denominator. */
  total: number;
  /** True when NOT ONE of them has a weight. A different sentence, not a
   *  stronger one: "every" removes the denominator, which otherwise reads as
   *  though some are fine. */
  everyItem: boolean;
  /** The weight each of them is priced at instead, in the unit the bands use. */
  assumed: string;
}

/** Grams as the bands are typed: kilograms, with the decimals it actually has
 *  and no trailing zeroes. 500 → `0.5 kg`, 1000 → `1 kg`. */
function kilos(grams: number): string {
  const kg = grams / 1000;
  return `${String(Math.round(kg * 1000) / 1000)} kg`;
}

/**
 * The gap worth telling someone about, or null when there is nothing to say.
 *
 * Null on zero missing (the ordinary case once weights are filled in) and null
 * when there is nothing postable at all: a shop that posts nothing cannot be
 * quoted wrong, and a warning there would be a chore invented for somebody who
 * does not owe it.
 */
export function weightGap(facts: WeightFacts): WeightGap | null {
  if (facts.itemsMissingWeight <= 0) return null;
  if (facts.shippableItems <= 0) return null;
  return {
    missing: facts.itemsMissingWeight,
    total: facts.shippableItems,
    everyItem: facts.itemsMissingWeight >= facts.shippableItems,
    assumed: kilos(facts.assumedWeightGrams),
  };
}

/** How many, in words an owner would use about their own shop. */
export function gapCount(gap: WeightGap): string {
  if (gap.everyItem) {
    return gap.total === 1
      ? 'The one thing you sell has no weight recorded'
      : `Not one of the ${String(gap.total)} things you sell has a weight recorded`;
  }
  return gap.missing === 1
    ? `1 of the ${String(gap.total)} things you sell has no weight recorded`
    : `${String(gap.missing)} of the ${String(gap.total)} things you sell have no weight recorded`;
}

/** Where the weight is typed. One sentence, because a warning that does not say
 *  where to go is a chore with no handle on it. */
export const WHERE_TO_SET =
  'Open a product, go to its Versions tab, and fill in Weight under "For working out postage".';

/**
 * What to say when someone picks **Priced by weight**.
 *
 * At the moment of the choice, not afterwards. The bands are about to be typed
 * in kilograms, and this is the last point before that work is done for nothing.
 */
export function bandsWarning(gap: WeightGap): string {
  const each = gap.everyItem ? 'each one' : 'each of those';
  return `${gapCount(gap)}, so ${each} counts as ${gap.assumed} when a delivery price is worked out. Two very different orders can land in the same band that way. ${WHERE_TO_SET}`;
}

/**
 * What to say when a carrier is connected.
 *
 * Different harm from the bands, so a different sentence: the carrier bills the
 * real parcel, and the shop pays whatever the guess left out.
 */
export function carrierWarning(gap: WeightGap): string {
  const each = gap.everyItem ? 'each one' : 'each of those';
  return `${gapCount(gap)}, so your carrier is asked to price ${each} as ${gap.assumed}. A shopper can then be quoted less than the carrier bills you, and you pay the difference. ${WHERE_TO_SET}`;
}
