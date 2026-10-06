// A BASKET THAT HAS ALREADY BEEN BOUGHT (sparx persona issue 087).
//
// Renée's basket became an order at checkout, and minutes later the same basket
// took an edit, because the browser still held it and nothing on the server
// refused. Now the server refuses every change to a bought basket, and answers
// a read of one, with 410 and the code `CART_ALREADY_BOUGHT`. That is not
// something to show a buyer as an error: they did nothing wrong, the basket is
// simply spent. The cart provider forgets it and starts a fresh one, and these
// say when an answer means that.

/** The error code api-rest answers for a basket that has already been bought. */
export const CART_ALREADY_BOUGHT = 'CART_ALREADY_BOUGHT';

/** True when a refusal means "that basket was already bought". The status and
 *  the code together, so neither a stray 410 nor a borrowed code is read as it. */
export function isBoughtCart(status: number, code: unknown): boolean {
  return status === 410 && code === CART_ALREADY_BOUGHT;
}

/** The same question of a thrown error that carries the answer's `status` and
 *  `code` (`AccountError` from the account pages, for one). */
export function isBoughtCartError(err: unknown): boolean {
  if (typeof err !== 'object' || err === null) return false;
  const { status, code } = err as { status?: unknown; code?: unknown };
  return typeof status === 'number' && isBoughtCart(status, code);
}

/** The code out of an API error envelope, or null when there is none. */
export function errorCodeOf(body: unknown): string | null {
  if (typeof body !== 'object' || body === null) return null;
  const error = (body as { error?: unknown }).error;
  if (typeof error !== 'object' || error === null) return null;
  const code = (error as { code?: unknown }).code;
  return typeof code === 'string' ? code : null;
}
