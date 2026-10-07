// Whether this shop can take an order on its website at all, said before the
// shopper types anything.
//
// MEASURED 2026-10-06 on Gillett Diesel: card payments were not set up yet. The
// cart offered "Checkout", the stranger typed his name, email, phone and street
// address and chose UPS Ground, and only on the payment step did the site say
// "This shop cannot take card payments online just yet, so the order cannot be
// finished here" (sparx persona issue 131). The server already knew; the cart,
// the drawer and the first step of checkout now say it first.

import { canBillToAccount } from './account-terms-words';
import type { StorefrontPaymentMode } from './made-to-order-copy';

export const ORDERS_CLOSED_MESSAGE =
  'This shop is not taking payments on its website just yet, so an order cannot be placed here. ' +
  'Nothing will be charged. Get in touch with the shop to order: their details are on this site.';

/** The sentence that closes checkout, or null when this shop can be paid here
 *  (by card, or in person when the order is handed over), or when this buyer is
 *  billed: a trade account on day terms pays by invoice, no card involved. The
 *  first version closed checkout to them too, and Wasatch Front's buyer, who had
 *  ordered on account in act 5, was told the shop could not take her order
 *  (sparx persona issue 136). */
export function ordersClosed(
  mode: StorefrontPaymentMode | null | undefined,
  accountTerms?: string | null
): string | null {
  if (mode !== 'unavailable') return null;
  return canBillToAccount(accountTerms) ? null : ORDERS_CLOSED_MESSAGE;
}
