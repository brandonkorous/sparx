// What to SAY when a write comes back refused, and what a failed READ means.
// One home for both, so no data module words them by hand.

import { ApiError } from '@wizeworks/api-client';

import { refusedWhat } from './refused-fields';

/** "There is no such record here", as opposed to "something went wrong". */
export function isNotFound(error: unknown): boolean {
  return error instanceof ApiError && error.status === 404;
}

/** WHY a pane has nothing to show, read from the error rather than assumed. */
export type PaneLoadReason = 'missing' | 'unreachable' | 'failed' | 'refused';

// 404, 400 and 422 mean nothing is at that address (persona issue 286). A 5xx and
// any other answered 4xx are a failure the server reported (issue 467). Only an
// error with no status at all is the server not being reached (issue 260).
export function paneLoadReason(error: unknown): PaneLoadReason {
  if (isNotFound(error)) return 'missing';
  if (!(error instanceof ApiError)) return 'unreachable';
  if (error.status >= 500) return 'failed';
  if (error.status === 400 || error.status === 422) return 'missing';
  // The thing is THERE and this account cannot open it; "deleted" would be a lie.
  if (error.status === 401 || error.status === 403) return 'refused';
  if (error.status >= 400) return 'failed';
  return 'unreachable';
}

/** The record is not this business's to see. Never confirms it exists elsewhere. */
export const LOAD_GONE =
  'It has been deleted, or the address points at something that is not in this business. Nothing of yours has been lost.';

/** The server answered, and its answer was that it had failed. */
export const LOAD_OUR_FAULT =
  'Something went wrong at our end, not yours. Nothing you have recorded has changed. Trying again may work, and if it keeps failing the fault is ours to fix.';

/** The server answered, and the answer was that this account may not open it. */
export const LOAD_REFUSED =
  'Your account is not allowed to open this. Nothing has been changed. The business owner can change what you can open in Team, under Your business.';

// What to say about a failed load. A screen's own sentence is about the server not
// being reached, so it is kept for that case only; every other cause gets the words
// above. Any alert or empty state that reports a failed read uses this (issue 260).
export function loadFailureWords(error: unknown, unreachableWords: string): string {
  switch (paneLoadReason(error)) {
    case 'missing':
      return LOAD_GONE;
    case 'failed':
      return LOAD_OUR_FAULT;
    case 'refused':
      return LOAD_REFUSED;
    case 'unreachable':
      return unreachableWords;
  }
}

// The server's own sentence for a 4xx, or the caller's plain one. A 5xx, an empty
// message and the schema describing itself fall back; a schema refusal still names
// the box it refused (`refusedWhat`), [[feedback_fetched_but_never_rendered]].
export function apiErrorMessage(error: unknown, fallback: string): string {
  if (!(error instanceof ApiError)) return fallback;
  if (error.status < 400 || error.status >= 500) return fallback;
  if (schemaReportingOnItself(error)) {
    const which = refusedWhat(error.details);
    return which === null ? fallback : `${fallback} ${which}`;
  }
  return error.message || fallback;
}

// Zod says "Request validation failed."; Fastify's schema sends ajv entries with a
// `keyword`. Anything else is a SERVICE explaining a rule, even when it names a
// field, and its sentence is the one to show (persona issues 224 and 245).
function schemaReportingOnItself(error: ApiError): boolean {
  if (error.code !== 'VALIDATION_ERROR') return false;
  if (error.message === 'Request validation failed.') return true;
  return (
    Array.isArray(error.details) &&
    error.details.length > 0 &&
    error.details.every((d: unknown) => typeof d === 'object' && d !== null && 'keyword' in d)
  );
}

/** The server answered a calculation by refusing what it was sent. */
export const WORK_REFUSED =
  'The server could not work this out from what is entered here. Nothing has been changed. Check the details above, then try again.';

/** For a calculation (a tax quote, a price preview), not a read: an answered 400,
 *  404 or 422 is about what was sent, never a deleted record (issue 260). */
export function workFailureWords(error: unknown, unreachableWords: string): string {
  return paneLoadReason(error) === 'missing'
    ? WORK_REFUSED
    : loadFailureWords(error, unreachableWords);
}
