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
import { telHref } from './tel-href';
import type { StorefrontPaymentMode } from './made-to-order-copy';

export const ORDERS_CLOSED_MESSAGE =
  'This shop is not taking payments on its website just yet, so an order cannot be placed here. ' +
  'Nothing will be charged.';

/** How a shopper reaches the shop to order instead, from its contact details in
 *  Site settings.
 *
 *  MEASURED 2026-10-17 on Gillett Diesel: the closed cart said "Get in touch with
 *  the shop to order: their details are on this site" and gave neither the phone
 *  number nor the email the site already held, so a stranger ready to buy had to
 *  go and find them (sparx persona issue 324). A shop with neither filled in gets
 *  the plain sentence, without the promise that its details are somewhere here. */
export interface ShopReach {
  phone: { label: string; href: string } | null;
  email: { label: string; href: string } | null;
}

/** The text with its spaces off, or null when nothing is left. */
function filled(value: string | null | undefined): string | null {
  const text = value?.trim();
  return text?.length ? text : null;
}

export function shopReach(
  contact: { phone?: string | null; email?: string | null } | null | undefined
): ShopReach {
  const phoneLabel = filled(contact?.phone);
  const phoneLink = telHref(phoneLabel);
  const emailLabel = filled(contact?.email);
  return {
    phone: phoneLabel && phoneLink ? { label: phoneLabel, href: phoneLink } : null,
    email: emailLabel ? { label: emailLabel, href: `mailto:${emailLabel}` } : null,
  };
}

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
