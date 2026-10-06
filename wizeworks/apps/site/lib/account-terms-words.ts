// What a trade buyer is told about paying on account, from the terms the shop
// gave their account.
//
// The checkout used to ask the buyer to pick Net 15, 30, 60 or 90 (issue 082).
// The terms are the shop's to give, not the buyer's to choose: the invoice was
// always written on the account's own terms, so the list was a choice that did
// nothing, and a Net 45 account could not even find its own terms in it.

/** Days to pay, or null when the account is not on day-count terms. */
export function termsDays(terms: string | null | undefined): number | null {
  const match = /^net(\d+)$/i.exec(terms ?? '');
  return match?.[1] ? parseInt(match[1], 10) : null;
}

/** Whether this account can put an order on its account at all. */
export function canBillToAccount(terms: string | null | undefined): boolean {
  return termsDays(terms) !== null;
}

/** The sentence under "Bill to your account". `held` is an order over the
 *  account's spending limit: it is not added to the account until it is
 *  approved, so it says so rather than "We add this order to your account"
 *  (sparx persona issue 087). */
export function accountTermsSentence(terms: string | null | undefined, held = false): string {
  const days = termsDays(terms);
  if (days === null) return 'Nothing is charged now.';
  const span = days === 1 ? '1 day' : `${days} days`;
  return held
    ? `Nothing is charged now. Once it is approved, we add it to your account, and you pay within ${span} of the invoice date.`
    : `Nothing is charged now. We add this order to your account, and you pay within ${span} of the invoice date.`;
}
