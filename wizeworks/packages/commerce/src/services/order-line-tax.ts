// Each order line's own sales tax, from the tax the checkout quoted.
//
// The checkout quotes tax line by line and kept it on the session, but the order
// was written with the tax as one total and every item at $0.00. An invoice for a
// fleet's order on account lists the order's items only when they come to the
// order total, so every taxed order fell back to one line, "Order O-000029,
// non-taxable", with the part, the shipping and the tax folded together (sparx
// persona issue 226).
//
// A quoted line names the basket line it taxes (`cartItemId`, stamped by
// `quoteTaxForSession`). The lines are used only when they and the shipping's
// tax come to the session's tax to the cent; otherwise nothing is handed out and
// the order keeps its one tax total, as before. An older quote with no
// `cartItemId` hands out nothing either.

export interface QuotedTax {
  shippingTaxCents?: unknown;
  lines?: unknown;
}

/** Tax in cents per basket line id, or an empty map when the quote cannot be trusted. */
export function taxByCartItem(
  breakdown: unknown,
  sessionTaxCents: number
): ReadonlyMap<string, number> {
  const none = new Map<string, number>();
  if (!breakdown || typeof breakdown !== 'object') return none;
  const quoted = breakdown as QuotedTax;
  if (!Array.isArray(quoted.lines)) return none;
  const byLine = new Map<string, number>();
  for (const raw of quoted.lines as unknown[]) {
    if (!raw || typeof raw !== 'object') return none;
    const line = raw as { cartItemId?: unknown; taxAmountCents?: unknown };
    if (typeof line.cartItemId !== 'string' || typeof line.taxAmountCents !== 'number') {
      return none;
    }
    byLine.set(line.cartItemId, (byLine.get(line.cartItemId) ?? 0) + line.taxAmountCents);
  }
  const shipping = typeof quoted.shippingTaxCents === 'number' ? quoted.shippingTaxCents : 0;
  let sum = shipping;
  for (const cents of byLine.values()) sum += cents;
  return sum === sessionTaxCents ? byLine : none;
}

/**
 * The one sales tax rate the checkout charged, in basis points (725 = 7.25%), or
 * null when it charged none or more than one.
 *
 * The order kept its tax in cents and not the rate, so the invoice worked a rate
 * out backwards: $1.81 on $25.00 printed as "Tax (7.24%)" on an order Utah taxed
 * at 7.25% (sparx persona issue 228). Each taxed line's rate is the sum of its
 * places (a state and a city); an exempt line is left out.
 */
export function quotedRateBasisPoints(breakdown: unknown): number | null {
  if (!breakdown || typeof breakdown !== 'object') return null;
  const lines = (breakdown as QuotedTax).lines;
  if (!Array.isArray(lines)) return null;
  let rate: number | null = null;
  for (const raw of lines as unknown[]) {
    const line = (raw ?? {}) as { taxAmountCents?: unknown; jurisdictions?: unknown };
    if (line.taxAmountCents === 0) continue;
    if (!Array.isArray(line.jurisdictions)) return null;
    let sum = 0;
    for (const place of line.jurisdictions as { rateBasisPoints?: unknown }[]) {
      if (typeof place.rateBasisPoints !== 'number') return null;
      sum += place.rateBasisPoints;
    }
    if (rate !== null && rate !== sum) return null;
    rate = sum;
  }
  return rate !== null && rate > 0 ? rate : null;
}
