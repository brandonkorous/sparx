// WHO WROTE THIS, ON THE SCREEN WHERE SHE DECIDES ABOUT IT.
//
// A review or a question carries TWO names, and they are not interchangeable:
//
//   • the ACCOUNT it was written from — who to look an order up against
//   • the name it was SIGNED with — the only one the shopper and her website
//     ever see
//
// The console led with the account, so a question signed "Tomas Villalobos" on
// her website read "Marguerite Adeyemi" in her console. If that shopper writes
// in, she searches her console for the name they used and finds nothing
// (issue 641). sparx went further and carried no signed name at all, so every
// guest review read "A guest" and two different signed reviews were
// indistinguishable.
//
// Both names, in the order that matches the website, with the account named
// underneath only when it differs. Pure, so it can be tested without a renderer.

/** The customer's account, as the moderation lists return it. */
export interface NamedCustomer {
  firstName: string | null;
  lastName: string | null;
  email: string | null;
}

function accountName(customer: NamedCustomer | null): string {
  return customer ? [customer.firstName, customer.lastName].filter(Boolean).join(' ').trim() : '';
}

/** The label under "Asked by" / "By". The website's name first. */
export function customerLabel(customer: NamedCustomer | null, signedAs?: string | null): string {
  const signed = signedAs?.trim();
  if (signed) return signed;
  const account = accountName(customer);
  if (account) return account;
  return customer?.email ?? 'A guest';
}

/**
 * Whose account it came from, when that is a DIFFERENT name from the signed one.
 *
 * `null` the rest of the time — a guest, or a shopper who signed with their own
 * name, gains no second line saying what the first already said.
 */
export function customerAccountNote(
  customer: NamedCustomer | null,
  signedAs?: string | null
): string | null {
  const signed = signedAs?.trim();
  if (!signed) return null;
  const account = accountName(customer);
  if (!account || account === signed) return null;
  return `from ${account}'s account`;
}
