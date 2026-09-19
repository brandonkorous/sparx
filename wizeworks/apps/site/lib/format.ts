// Formatting helpers. Money is integer cents everywhere on the wire; format
// only at the render boundary. Currency/locale come from the tenant's
// storefront settings so a EUR/de-DE merchant renders natively.

export function formatMoney(cents: number, currency = 'USD', locale = 'en-US'): string {
  return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(cents / 100);
}

// Unit suffixes for fitment ranges. Years and shoe sizes read bare; weights /
// dimensions / ages carry a suffix.
const RANGE_SUFFIX: Record<string, string> = {
  lb: ' lb',
  kg: ' kg',
  mm: ' mm',
  in: ' in',
  month: ' mo',
};

/** Format a fitment range value/span by unit: "2011–2016", "40–80 lb", "9.5". */
export function formatFitmentRange(
  min: number | null,
  max: number | null,
  unit: string | null
): string | null {
  if (min == null && max == null) return null;
  const suffix = unit ? (RANGE_SUFFIX[unit] ?? '') : '';
  // Years are whole numbers; everything else may carry decimals.
  const fmt = (n: number) => (unit === 'year' ? String(Math.round(n)) : String(n));
  if (min != null && max != null && min !== max) return `${fmt(min)}–${fmt(max)}${suffix}`;
  const single = min ?? max!;
  return `${fmt(single)}${suffix}`;
}

/** Render a min–max range, collapsing to a single value when equal/absent. */
export function formatPriceRange(
  minCents: number | null,
  maxCents: number | null,
  currency = 'USD',
  locale = 'en-US'
): string | null {
  if (minCents === null) return null;
  if (maxCents === null || maxCents === minCents) {
    return formatMoney(minCents, currency, locale);
  }
  return `${formatMoney(minCents, currency, locale)} – ${formatMoney(maxCents, currency, locale)}`;
}

/**
 * A promised DAY, printed as the day it actually is.
 *
 * `timeZone: 'UTC'`, deliberately, and this is the customer-facing half of a
 * mistake the console made first. Both dates that reach here are calendar days
 * stored at UTC midnight — a preorder's `availableAt` comes from a date box in
 * the preorder screen, `expectedBackAt` from a purchase order's expected arrival
 * or from a measured lead time counted in whole UTC days. Handing UTC midnight
 * to `toLocaleDateString` renders it on the SHOPPER's clock, which is the
 * previous day for everyone west of Greenwich: a merchant who typed 10 March got
 * a page promising 9 March to most of the United States. Issue 679; the same
 * rule as `formatDay` in the console.
 *
 * It lives here rather than beside one of its two callers because there ARE two,
 * on the two different paths a product page can render through, and the day this
 * rule holds in one and not the other is the day the bug comes back.
 */
export function formatArrival(iso: string, locale = 'en-US'): string {
  return new Date(iso).toLocaleDateString(locale, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

/**
 * The one sentence that tells a shopper this thing is not made yet.
 *
 * Here for the same reason `formatArrival` is: a product page renders through
 * EITHER the silica template or the legacy `<ProductDetail>`, and both have to
 * say this. They did not. The template said `Preorder — ships 1 July 2027` and
 * the component said `Preorder: ships 1 July 2027`, which is two shops' worth of
 * voice for one fact, and it is how the wording drifts until only one of them is
 * the one anybody proofread. Issue 682.
 *
 * Both branches are a whole sentence, and neither invents a day. A preorder
 * with no confirmed date says exactly that, because a guess printed on a shop
 * is a promise the moment somebody reads it.
 */
export function preorderShipsLine(availableAt: string | null, locale = 'en-US'): string {
  if (!availableAt) return 'Preorder: shipping date to be confirmed';
  return `Preorder: ships ${formatArrival(availableAt, locale)}`;
}

/**
 * The day a sold-out thing comes back.
 *
 * Kept beside `preorderShipsLine` for the same reason and used by the same two
 * renderers. The two sentences are siblings and a shopper reads one or the
 * other, never both: a preorder is something you may buy now, this is something
 * you may not.
 */
export function backInStockLine(expectedBackAt: string, locale = 'en-US'): string {
  return `Back in stock ${formatArrival(expectedBackAt, locale)}`;
}
