import { ApiError } from '@wizeworks/api-client';
import { apiErrorMessage } from '../../../lib/api-error';

/* ── Errors ─────────────────────────────────────────────────────────────── */

/** The server's own sentence for a 4xx, shown verbatim: these routes name the real
 *  problem (a slot clash, an expired offer) better than a status code could. A 5xx
 *  carries no such sentence, so it falls back to the caller's wording. */
export function schedulingErrorMessage(error: unknown, fallback: string): string {
  return apiErrorMessage(error, fallback);
}

/** True when the thing behind this pane no longer exists. */
export function isNotFound(error: unknown): boolean {
  return error instanceof ApiError && error.status === 404;
}
