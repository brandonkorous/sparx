// What to SAY when a write comes back refused, and what a failed READ means.
//
// Eighty-two data modules had written this out by hand, one per app, and the
// wording it produced could be the schema layer describing itself.

import { ApiError } from '@wizeworks/api-client';

import { refusedWhat } from './refused-fields';

/**
 * "There is no such record here" — as opposed to "something went wrong".
 *
 * Nine data modules had declared this identically, so nine surfaces could ask
 * the question and the other hundred could not. It belongs beside the other
 * thing every surface asks of an error.
 */
export function isNotFound(error: unknown): boolean {
  return error instanceof ApiError && error.status === 404;
}

/**
 * WHY a pane has nothing to show, decided from the error rather than assumed.
 *
 * `<PaneLoadError>` has always been able to tell these apart and defaulted to
 * `unreachable`, which is a CLAIM: a 404 came back in milliseconds and the
 * screen said the server could not be reached, over a "Try again" that could
 * only ever fail. Deep-linking a record from another business, opening a saved
 * layout pinned to a deleted one, and following an old bookmark all land here.
 *
 * A 5xx is the THIRD case, and it was wearing the first one's sentence. The
 * server WAS reached; it answered, and its answer was that it had failed. "The
 * server could not be reached" sends someone to check their connection over a
 * fault that is entirely ours, and no amount of checking it will help.
 */
export type PaneLoadReason = 'missing' | 'unreachable' | 'failed' | 'refused';

export function paneLoadReason(error: unknown): PaneLoadReason {
  if (isNotFound(error)) return 'missing';
  if (error instanceof ApiError && error.status >= 500) return 'failed';
  // A 400 or a 422 on a READ is the same answer as a 404 wearing a different
  // number: the server was reached, and what it said was that there is nothing
  // at that address. It reaches a person through a link whose id got cut off in
  // a chat message, and it was landing on "the server could not be reached"
  // over a Try again that could only ever fail - the exact fault the two
  // paragraphs above this one were written about. The `missing` copy already
  // covers it: "deleted, or the address points at something that is not in this
  // business."
  //
  // 403 stays where it is. The thing IS there and somebody simply cannot open
  // it; calling that deleted would be a different lie.
  if (error instanceof ApiError && (error.status === 400 || error.status === 422)) return 'missing';
  // 401 and 403: the thing is THERE and this account cannot open it. Calling it
  // deleted would be a lie, and so was "a problem reaching the server", which is
  // what it said for want of words of its own (persona issue 260).
  if (error instanceof ApiError && (error.status === 401 || error.status === 403)) return 'refused';
  // Any other 4xx was still an ANSWER. Only an error with no status at all is
  // the server not being reached.
  if (error instanceof ApiError && error.status >= 400) return 'failed';
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
  'Your account is not allowed to open this. Nothing has been changed. The business owner can change what you can open under Team.';

/**
 * What to say about a failed load, chosen from the error (persona issue 260).
 *
 * A screen's own sentence is written about the server not being reached, so it
 * is kept for that case only. Every other cause gets words owned here, so a
 * server fault, a refusal and a deleted record never borrow the connection's
 * sentence. `<PaneLoadError>` uses this, and so must any alert or empty state
 * that reports a failed read.
 */
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
 * The SCHEMA layer reporting on itself. Its message is the fixed string
 * "Request validation failed." and the useful part is in `details`, keyed by
 * field path. Shown to a business owner it explains nothing and reads like
 * their fault, so the caller's fallback wins. Found by recording a payment with
 * a value the enum did not accept: the toast said "Could not write that down ·
 * Request validation failed."
 *
 * An EMPTY message is worse than the fallback for the obvious reason — the toast
 * renders a title and no body. Two of the eighty-two already guarded this; the
 * other eighty did not.
 *
 * Dropping the schema's SENTENCE is right. Dropping its FIELD LIST was not: the
 * paragraph above says the useful part is keyed by field path, and then for a
 * year nothing read it, so a refused save on a twenty-field form named no box at
 * all. `refusedWhat` turns that list into one plain sentence and leaves the
 * reason where it belongs ([[feedback_fetched_but_never_rendered]]).
 */
export function apiErrorMessage(error: unknown, fallback: string): string {
  if (!(error instanceof ApiError)) return fallback;
  if (error.status < 400 || error.status >= 500) return fallback;
  if (schemaReportingOnItself(error)) {
    const which = refusedWhat(error.details);
    return which === null ? fallback : `${fallback} ${which}`;
  }
  return error.message || fallback;
}

/**
 * ONE code, TWO senders — and only one of them is worth repeating.
 *
 * `VALIDATION_ERROR` covers both Zod describing its own failure and a SERVICE
 * deliberately explaining a business rule. Silencing the whole code silenced the
 * second kind too, so "No payment gateway is configured to settle this refund.
 * Refund the customer manually or issue account credit" — the exact sentence the
 * operator needed — reached her as "Check what you entered and try again", about
 * something she had not entered.
 *
 * They are told apart by WHO is speaking, not by whether a field is named. Zod
 * always says the fixed "Request validation failed.", and Fastify's own schema
 * check sends ajv entries, each carrying a `keyword`. A service may name a field
 * too: every service mapper in api-rest passes its `details` through, and the
 * rule that the field-list meant "schema" threw away "Nothing on record says
 * what this item cost" and said "Please try again" (persona issue 245).
 */
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
