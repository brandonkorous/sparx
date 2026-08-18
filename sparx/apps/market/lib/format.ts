// Formatting helpers. Money is integer cents everywhere on the wire; format
// only at the render boundary. Currency comes from the listing (each seller's
// store has its own default currency), so a EUR/GBP listing renders natively.

/** Format integer cents as a localized currency string. */
export function formatCents(cents: number, currency = 'USD', locale = 'en-US'): string {
  return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(cents / 100);
}

/** Render a min–max price range, collapsing to a single value when equal/absent
 *  (a product with one variant, or whose variants are all the same price). */
export function formatPriceRange(
  minCents: number | null,
  maxCents: number | null,
  currency = 'USD',
  locale = 'en-US'
): string | null {
  if (minCents === null) return null;
  if (maxCents === null || maxCents === minCents) {
    return formatCents(minCents, currency, locale);
  }
  return `${formatCents(minCents, currency, locale)} – ${formatCents(maxCents, currency, locale)}`;
}
