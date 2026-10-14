// Whose cart this is, as the storefront's cart routes see it (sparx persona issue
// 192). A cart's token lives in the browser and used to outlive the session, so
// the next person to sign in on that computer opened the last one's cart, at the
// last one's trade price.

/**
 * True when the signed-in buyer may use this cart. A cart nobody owns yet is a
 * guest's, and anyone holding its token may use it; an anonymous caller holding
 * the token is let through too, since a guest checkout fills in a customer
 * before anyone signs in. A cart that belongs to one buyer is never another
 * signed-in buyer's.
 */
export function cartUsableBy(
  cartCustomerId: string | null,
  signedInCustomerId: string | null
): boolean {
  if (cartCustomerId === null || signedInCustomerId === null) return true;
  return cartCustomerId === signedInCustomerId;
}
