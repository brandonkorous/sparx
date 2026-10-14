// A cart ends with the session of the buyer it belonged to (sparx persona issue
// 192). Renée signed out and Brynn, on the same browser, opened Renée's cart at
// Wasatch's fleet price.

/**
 * True when the stored cart must be dropped because the person it was kept for
 * has gone: they signed out, or somebody else signed in. A guest who signs in
 * keeps their cart: the server hands it to the account (the cart handoff).
 */
export function cartEndsWithSession(before: string | null, after: string | null): boolean {
  return before !== null && after !== before;
}
