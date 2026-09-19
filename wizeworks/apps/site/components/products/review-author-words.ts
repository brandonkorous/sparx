// WHOSE WORDS THESE ARE, ON A PRODUCT PAGE.
//
// Two cards sit side by side on the same page, written the same way, in this same
// folder. The question card handled a missing name — "A customer asked" — and the
// review card beside it rendered NOTHING, so a review published without a signed
// name showed as stars, a Verified purchase badge and a date, with nobody
// attached to it (issue 641).
//
// It is not rare. 85 of the 111 reviews published on live websites have no signed
// name, across 8 businesses: the storefront form requires one, but every other
// way a review arrives — an import from the platform a shop is leaving, the MCP
// tools, a staff-side entry — may leave it null.
//
// WHAT IT MUST NOT DO IS PUBLISH THE ACCOUNT HOLDER'S REAL NAME. Somebody who did
// not choose a name to sign with never agreed to their full name appearing under
// their words. So the fallback is a plain noun, and both cards now take it from
// here so they cannot drift apart again.

/** The name under a review. `null`/empty becomes the plain noun. */
export function reviewAuthorName(signedAs: string | null | undefined): string {
  const signed = signedAs?.trim();
  return signed && signed.length > 0 ? signed : 'A customer';
}

/** The name above a question. Reads as a sentence opener, which is why it differs. */
export function questionAuthorName(signedAs: string | null | undefined): string {
  const signed = signedAs?.trim();
  return signed && signed.length > 0 ? signed : 'A customer asked';
}
