// WHAT A SIGNATURE REQUEST IS REALLY DOING RIGHT NOW.
//
// Three things the pane could not say, all of them already in its hand:
//
//   1. WHETHER THEY OPENED IT. `viewedAt` is written by the signing page, and the
//      code that writes it says why in as many words: "'They opened it' is the
//      difference between a customer who is thinking about it and one who never
//      got the email — which is the whole question a business has three days
//      after sending a quote." The console drew nothing.
//      [[feedback_fetched_but_never_rendered]]
//
//   2. WHEN THE LINK DIES. Every request carries `expiresAt`, never null. The row
//      showed the date it was SENT and nothing about the date it stops working.
//
//   3. THAT IT HAS ALREADY DIED. `status` only becomes 'expired' two ways: the
//      signer opens the dead link, or `expireStale` runs. Measured 2026-09-28:
//      `expireStale` has exactly ONE reference in the whole repository, its own
//      definition. Since 2026-09-30 the CRM sla-sweep cron calls it for every
//      CRM-active tenant, but the check below stays: a tenant without CRM, or a
//      link that expired since the last sweep, still reaches this screen.
//      [[feedback_screen_over_a_function_nobody_calls]]
//
//      So a link that ran out three weeks ago still read "Waiting for them",
//      and the only thing that would correct it is the one person who cannot:
//      the customer, opening a link that no longer works.
//
// The fix for (3) is a READ-SIDE overlay, not a write and not a schedule. The
// stored status is the record of what was DONE; the date is the fact that decides
// what is true now, and both are already on the row. The same shape as the SEO
// scorecard's refreshed wording (issue 863): derive on read, leave the row alone.
//
// Lives in a `.ts` beside the pane because a `.tsx` cannot be imported by vitest
// in this app (`jsx: preserve`), and these are rules worth a test.

import type { DocumentSignature } from '../crm/workspace-data';

export type SignatureStatus = DocumentSignature['status'];

/**
 * The status this request really has, now.
 *
 * Only `pending` can be wrong, and only in one direction: a request whose link
 * has run out is still stored as waiting until somebody writes otherwise. Every
 * other status is a thing that happened and cannot go stale.
 *
 * `now` is passed in rather than read, so a test can stand at any date.
 */
export function effectiveStatus(
  signature: Pick<DocumentSignature, 'status' | 'expiresAt'>,
  now: number
): SignatureStatus {
  if (signature.status !== 'pending') return signature.status;
  return Date.parse(signature.expiresAt) < now ? 'expired' : 'pending';
}

/** Whether staff can still take this request back. Reads the EFFECTIVE status, so
 *  the pane never offers to withdraw a link that has already stopped working —
 *  the server would accept it and record a revoke that changed nothing. */
export function canTakeBack(
  signature: Pick<DocumentSignature, 'status' | 'expiresAt'>,
  now: number
): boolean {
  return effectiveStatus(signature, now) === 'pending';
}

/**
 * Whether they have opened it, in her words. Null when the question does not
 * apply: a signed request answers itself, and a declined one obviously was read.
 *
 * `format` renders a date, so the caller keeps its own formatting.
 */
export function seenLine(
  signature: Pick<DocumentSignature, 'status' | 'expiresAt' | 'viewedAt'>,
  now: number,
  format: (iso: string) => string
): string | null {
  const status = effectiveStatus(signature, now);
  if (status !== 'pending' && status !== 'expired') return null;
  if (signature.viewedAt !== null) return `They opened it ${format(signature.viewedAt)}`;
  return status === 'expired' ? 'They never opened it' : 'They have not opened it yet';
}

/**
 * When the link stops working, or that it already has.
 *
 * Only for a request that is or was waiting. A signed document's link expiring
 * is not news.
 */
export function expiryLine(
  signature: Pick<DocumentSignature, 'status' | 'expiresAt'>,
  now: number,
  format: (iso: string) => string
): string | null {
  const status = effectiveStatus(signature, now);
  if (status === 'pending') return `The link works until ${format(signature.expiresAt)}`;
  if (status === 'expired') return `The link stopped working on ${format(signature.expiresAt)}`;
  return null;
}
