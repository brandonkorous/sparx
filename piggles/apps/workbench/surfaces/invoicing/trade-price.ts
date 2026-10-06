// What a business on account pays for a part, asked of the server.
//
// A quote for a wholesale customer used to seed every line at the LIST price:
// Wasatch Front is on the Fleet group at 12% off, and their quote for a $600.00
// injector said $600.00 (sparx persona issue 077). The answer comes from
// `GET /v1/b2b/resolve-price`, which prices through the same engine checkout
// charges with, a signed agreement first, and says why in a sentence the line
// can carry ("Fleet price: 12% off $600.00").

import { api } from '../../lib/api/client';

/** The wholesale account a document bills, when trade prices apply to it. */
export interface TradeAccount {
  id: string;
  name: string;
}

/** What `/v1/b2b/resolve-price` answers. */
export interface TradePrice {
  variantId: string;
  accountId: string;
  currency: string;
  quantity: number;
  listPriceCents: number;
  effectivePriceCents: number;
  /** Which kind of rule set it; `list` when none did. */
  rule: string;
  /** The sentence for the line, or null when the list price applies. */
  words: string | null;
}

/** What one account pays for one version at this quantity. */
export function fetchTradePrice(input: {
  variantId: string;
  accountId: string;
  quantity: number;
}): Promise<TradePrice> {
  return api.get<TradePrice>('/v1/b2b/resolve-price', {
    variant_id: input.variantId,
    account_id: input.accountId,
    quantity: Math.max(1, Math.round(input.quantity)),
  });
}

/**
 * The line's note when the trade price could not be read, naming the account,
 * so nobody sends a wholesale customer the list price believing it is theirs.
 */
export function tradePriceMissing(account: TradeAccount): string {
  return `${account.name}'s own price could not be looked up just now, so this is the list price. Check it before you send.`;
}
