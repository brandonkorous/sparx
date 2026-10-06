// What the console calls each place a sale came from.
//
// ONE vocabulary, because a channel is a fact about an order and a fact may not
// have six names. It had six. A single till sale read "In person or by phone"
// on Money, "Added by your team" on the selling report, "Entered by your team"
// on its own order, "Orders you enter by hand" in the price-list picker, and
// "Entered by your team" again in Carts and Checkouts from two more private
// tables. Same order, same money, five answers.
//
// `storefront` and `b2b_portal` had disagreed too: "Your website" in four
// places and "Your online store" in one; "Wholesale portal", "Trade portal" and
// "Your wholesale portal" for the same portal.
//
// The console already learned this once for payment method: `methodLabel` in
// surfaces/finance/format.ts is shared for exactly this reason, after one pane
// spelled a cheque "Check" and called a cash sale "Recorded by hand". Channel
// never got the same treatment.

/** Marketplaces keep their own names — "Marketplace" alone tells a seller
 *  nothing they can act on. Keyed by the order's `source`. */
const MARKETPLACE_SOURCE: Record<string, string> = {
  tiktok_shop: 'TikTok Shop',
  etsy: 'Etsy',
  amazon: 'Amazon',
  walmart: 'Walmart',
  ebay: 'eBay',
  faire: 'Faire',
  meta: 'Facebook & Instagram',
  google_shopping: 'Google Shopping',
  pinterest: 'Pinterest',
  sparx_market: 'sparx.market',
};

const CHANNEL: Record<string, string> = {
  storefront: 'Your website',
  b2b_portal: 'Wholesale portal',
  // Says what HAPPENED, and assumes nothing. "Entered by your team" and "Added
  // by your team" both tell a sole trader about a team they do not have, and
  // "In person or by phone" claims to know how the order arrived when the
  // channel only knows it did not come through the website.
  admin: 'Added by hand',
  // A real till, as opposed to an order typed into the console afterwards.
  pos: 'At the till',
  subscription: 'Subscriptions',
  mcp: 'AI assistant',
  import: 'Imported',
  marketplace: 'Marketplace',
  // Reached when `sparx_market` arrives as the CHANNEL rather than as a
  // marketplace's source — the reports and price-list panes both treated it
  // that way. Same words either route. The product is spelled `sparx.market`
  // (docs/106, docs/107), which is the spelling four of the six tables used.
  sparx_market: 'sparx.market',
  unknown: 'Other',
};

/** The source the quote conversion stamps on an order: `document:<number>`
 *  (crm billing-document-conversion-service). */
const DOCUMENT_SOURCE = 'document:';

/**
 * Where a sale came from, in one phrase.
 *
 * `source` is optional because not every screen has it: a report grouped by
 * channel has no single source to pass, and a channel PICKER is choosing a
 * place rather than describing an order. Without it a marketplace order reads
 * "Marketplace", which is the honest answer when the caller does not know which.
 */
export function channelLabel(channel: string | null | undefined, source?: string | null): string {
  if (channel === 'marketplace' && source) {
    return MARKETPLACE_SOURCE[source] ?? source.replace(/_/g, ' ');
  }
  // An order made from a quote or estimate says which one. The conversion
  // writes `document:<number>` as the source; the channel alone said "Added by
  // hand" about an order nobody typed (sparx persona issue 085).
  if (source?.startsWith(DOCUMENT_SOURCE)) {
    const number = source.slice(DOCUMENT_SOURCE.length).trim();
    if (number) return `Made from ${number}`;
  }
  if (!channel) return 'Other';
  // An unknown channel prints readably rather than as a slug. Never invented
  // wording — `b2b_portal` reaching here would say "b2b portal", which is a
  // signal that a channel needs a real entry above, not a disguise for it.
  return CHANNEL[channel] ?? channel.replace(/_/g, ' ');
}
