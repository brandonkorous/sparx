// What to SAY when a write comes back refused.
//
// Eighty-two data modules had written this out by hand, one per app, and the
// wording it produced could be the schema layer describing itself.

import { ApiError } from '@wizeworks/api-client';

/**
 * The server's own sentence for a 4xx, or the caller's plain one.
 *
 * Prefer the server's: these routes explain the actual problem — "Cannot cancel
 * an order in status 'delivered'", "Not enough stock to reserve" — far better
 * than anything this side could infer from a status code. A 5xx carries no such
 * sentence, so the caller's wording wins there.
 *
 * Two cases where the server's message is NOT worth showing:
 *
 * `VALIDATION_ERROR` is the schema layer reporting on itself. The message is the
 * fixed string "Request validation failed." and the useful part is in `details`,
 * keyed by field path. Shown to a business owner it explains nothing and reads
 * like their fault, so the caller's fallback wins. Found by recording a payment
 * with a value the enum did not accept: the toast said "Could not write that
 * down · Request validation failed."
 *
 * An EMPTY message is worse than the fallback for the obvious reason — the toast
 * renders a title and no body. Two of the eighty-two already guarded this; the
 * other eighty did not.
 */
export function apiErrorMessage(error: unknown, fallback: string): string {
  if (!(error instanceof ApiError)) return fallback;
  if (error.status < 400 || error.status >= 500) return fallback;
  if (error.code === 'VALIDATION_ERROR') return fallback;
  return error.message || fallback;
}
