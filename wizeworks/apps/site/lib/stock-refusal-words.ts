// What the shop says when the basket is refused for stock.
//
// A refusal used to read "Sorry, this item just sold out." whatever the reason,
// because every 409 from the basket was taken to mean one thing. It is often not
// true. Add to cart holds a line's units at ONE location (the allocator is
// single-source), so asking for more than one location has is refused while
// units are still for sale, and the product page beside the message still says
// they are. MEASURED 2026-10-03 on Gillett Diesel: a CP4 kit with one on the
// shop's shelf was refused as "sold out" to a buyer asking for more.
//
// The server says how many one line could have (`details.available`, the richest
// single location, see `reserveOnTx`). Zero really is sold out; anything else
// is a quantity to lower, and saying so is what lets the buyer still buy.

/** The `OUT_OF_STOCK` refusal's details, as the API sends them. */
export interface StockRefusal {
  requested: number;
  available: number;
}

/** The refusal's numbers out of an API error body, or null when it is not one. */
export function stockRefusalOf(body: unknown): StockRefusal | null {
  const error = (body as { error?: { code?: unknown; details?: unknown } } | null)?.error;
  if (error?.code !== 'OUT_OF_STOCK') return null;
  const details = error.details as { requested?: unknown; available?: unknown } | undefined;
  const available = Number(details?.available);
  const requested = Number(details?.requested);
  if (!Number.isFinite(available) || available < 0) return null;
  return {
    requested: Number.isFinite(requested) ? requested : 0,
    available: Math.floor(available),
  };
}

/** The sentence for a refused add or quantity change. The count includes what
 *  is already in the basket, because the server judges the line's new total. */
export function stockRefusalSentence(refusal: StockRefusal | null): string {
  if (!refusal || refusal.available <= 0) return 'Sorry, this item just sold out.';
  const n = refusal.available;
  return `Sorry, only ${String(n)} ${n === 1 ? 'is' : 'are'} left to buy, counting any already in your basket. Lower the quantity and try again.`;
}
