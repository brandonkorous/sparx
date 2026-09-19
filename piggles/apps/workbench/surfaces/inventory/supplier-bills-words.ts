// What the line above the supplier bills is allowed to claim.
//
// ── THE HEADING THIS EXISTS FOR ─────────────────────────────────────────────
//
// It said:
//
//     $684.00 owed across 1 bill
//
// directly above four unpaid bills worth $1,626.72. The one bill it was
// counting was not one of the four a reader would have picked: it was the
// single bill Juniper Row has QUERIED with the supplier, the one she has said
// she is not paying yet. The three she actually owes — $942.72 — were left out
// entirely, because the aggregate excluded the status this console calls
// "Entered".
//
// The service now counts every unpaid bill that has not been cancelled. This
// file is the other half: a queried bill is owed AND uncertain, and one number
// cannot say both, so the sentence says the total and then names the part that
// might change.
//
// Kept out of the .tsx because the console's test seat is `environment: 'node'`
// and cannot import one.

export interface OwedShape {
  /** Every unpaid bill that has not been canceled. */
  outstandingCents: number;
  outstandingCount: number;
  /** The part of that which is queried with the supplier. */
  queriedCents: number;
  queriedCount: number;
}

const plural = (n: number, one: string, many: string) => `${String(n)} ${n === 1 ? one : many}`;

/**
 * The status line.
 *
 * `format` is passed in rather than imported so this module stays free of the
 * console's money formatting and its tests can read plain numbers.
 */
export function owedLine(o: OwedShape, format: (cents: number) => string): string {
  if (o.outstandingCount === 0) return 'Nothing owed';

  const head = `${format(o.outstandingCents)} owed across ${plural(o.outstandingCount, 'bill', 'bills')}`;
  if (o.queriedCount === 0) return head;

  // "of which" rather than a second total: the queried amount is INSIDE the
  // first figure, and a reader who adds the two together has been misled by
  // punctuation.
  const which =
    o.queriedCount === 1
      ? `${format(o.queriedCents)} of that is queried with the supplier`
      : `${format(o.queriedCents)} of that is queried with suppliers`;
  return `${head} · ${which}`;
}

/**
 * Whether the heading is describing the same bills the reader can see.
 *
 * Not rendered — this is the invariant the old heading broke, written down so a
 * test can hold it: the total must never be smaller than what a filtered view
 * is showing, because the total is about the whole shop and the rows are a
 * subset of it.
 */
export function totalCoversRows(o: OwedShape, rowsShown: number): boolean {
  return o.outstandingCount >= rowsShown;
}
