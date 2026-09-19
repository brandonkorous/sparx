// WHAT AN OFFER HAS DONE, in words a shop owner uses.
//
// The Discounts screens counted redemptions and stopped there. "Used 4 times"
// is a true sentence that answers a question nobody asks: an owner runs an offer
// to make a TRADE, so the number they need is the size of it. Devi's Spring sale
// was used 4 times and took $91.20 off her prices, and only the second figure
// tells her whether to run it again.
//
// The money was already there. `commerce_discount_usages` records `applied_cents`
// on every redemption, and `reporting-service.discountPerformance` has summed it
// since 2026-06-15, behind a live route that no console has ever called. The
// report is not the fix: the screen she is already standing on is (issue 536).
//
// A leaf module, importing nothing, because a rule shaped like a sentence rots
// the moment it lives inside a component. Same move as `broadcast-stats-words`.

/** Money in cents, as a shop owner reads it. Local copy rather than an import:
 *  this file stays a leaf so the rules below can be tested on their own. */
function money(cents: number, currency = 'USD'): string {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(cents / 100);
}

/**
 * The line beside a discount's state badge, or `null` when there is nothing to
 * say yet.
 *
 * Three cases, not two. An offer nobody has used says nothing at all, because a
 * "$0.00 given away" on a brand new offer reads as a failure rather than as an
 * absence. An offer that HAS been used but took nothing off is real too (a free
 * delivery on an order with no delivery charge, a percentage of a basket that
 * came to nothing), and it says the count alone rather than inventing a figure.
 */
export function discountUsageLine(
  usageCount: number,
  givenAwayCents: number,
  currency = 'USD'
): string | null {
  if (usageCount <= 0) return null;
  const used = usageCount === 1 ? 'Used once' : `Used ${String(usageCount)} times`;
  if (givenAwayCents <= 0) return used;
  return `${used} · ${money(givenAwayCents, currency)} given away`;
}

/**
 * The same figure as a list cell. An em-dash for an offer nobody has used, so a
 * column of them does not read as a column of zeroes: nothing was given away
 * because nothing happened, which is not the same as a zero somebody measured.
 * See the platform's rule on never presenting absence as a measurement.
 */
export function givenAwayCell(
  usageCount: number,
  givenAwayCents: number,
  currency = 'USD'
): string {
  if (usageCount <= 0) return '—';
  return money(givenAwayCents, currency);
}
