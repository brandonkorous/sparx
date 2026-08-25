// How a product reads in the operator console.
//
// WizeWorks runs more than one product on one platform, and this console
// administers all of them — so "which product?" is a column on several surfaces.
// It was answered twice, in two places, with a labels map here and an inline
// ternary for the color there. One place now, because the moment a third product
// exists the version somebody forgets to update is the one that keeps rendering
// and looks fine.
//
// Values, not existence: this is the console's own presentation of a brand, not
// the brand's identity. A product's real name, marks and palette live in its own
// package, which this app deliberately cannot import.

export type BrandTone = 'primary' | 'info';

const BRAND_LABELS_BY_KEY: Record<string, string> = {
  piggles: 'Piggles',
  sparx: 'sparx',
};

/** Kept as a named export because the announcements surface already reads it
 *  under this name; the map itself now lives here. */
export const BRAND_LABELS = BRAND_LABELS_BY_KEY;

/** A product's name as an operator knows it, falling back to the raw key — an
 *  unregistered brand should still be legible rather than blank. */
export function brandLabel(brand: string): string {
  return BRAND_LABELS_BY_KEY[brand] ?? brand;
}

/**
 * The color that tells one product from another.
 *
 * This badge exists ONLY to distinguish, so the color has to carry the
 * distinction — two products rendering the same chip would leave the badge
 * doing no work at all. On the users roster that is not cosmetic: two rows can
 * now differ by nothing except this column, because one person may hold an
 * account on each product under the same address.
 *
 * `undefined` for a product with no registered tone — a colorless badge, which
 * is a legible "no color assigned" rather than a color that means something
 * else.
 */
export function brandTone(brand: string): BrandTone | undefined {
  if (brand === 'piggles') return 'primary';
  if (brand === 'sparx') return 'info';
  return undefined;
}
