// WHERE NEW CUSTOMERS COME FROM, MINUS THE ONES NOBODY CAN ANSWER FOR.
//
// The panel groups new customers by the channel of their FIRST ORDER. A
// customer who has not ordered has no channel, and the report used to give
// them one anyway: "Direct" if they stood alone, "B2B portal" if they were
// attached to a company. Both read like answers. Neither was one.
//
// Measured on the dev database 2026-09-25: 686 of 745 customers had no first
// order, so 92% of this panel was a guess. On Devi's own shop it was 33 of 40,
// and the guessed bar was so much taller than the real ones that the three
// true answers were slivers a pixel wide.
// [[feedback_never_present_absence_as_measurement]]
//
// So the unknowns come out of the bars and go into a sentence. What is left is
// a comparison between things that really happened, and the sentence says
// plainly how much of the picture is missing. Shares are worked out over the
// KNOWN ones only — a bar reading 10% next to a note saying most never ordered
// would be two different denominators on one panel.

import type { LeadSourceRow } from './reports-data';

/** The key the report uses for a customer with no first order. It is not a
 *  channel, and the service keeps it out of the channel set on purpose. */
export const NO_ORDER_YET = 'none';

export interface ObservedSource {
  source: string;
  count: number;
  sharePct: number;
}

export interface LeadSourceView {
  /** The ways customers really did arrive, most first. */
  observed: ObservedSource[];
  /** Customers in the window who have not ordered. */
  notKnown: number;
  /** Everybody in the window, answered or not. */
  total: number;
  /** The tallest bar, so a one-source panel still draws a full bar. */
  peak: number;
}

export function splitLeadSources(rows: readonly LeadSourceRow[] | undefined): LeadSourceView {
  const all = rows ?? [];
  let notKnown = 0;
  const known: LeadSourceRow[] = [];
  for (const row of all) {
    if (row.source === NO_ORDER_YET) notKnown += row.count;
    else known.push(row);
  }

  const knownTotal = known.reduce((sum, row) => sum + row.count, 0);
  const observed = known
    .map((row) => ({
      source: row.source,
      count: row.count,
      sharePct: knownTotal > 0 ? +((row.count / knownTotal) * 100).toFixed(1) : 0,
    }))
    .sort((a, b) => b.count - a.count);

  return {
    observed,
    notKnown,
    total: knownTotal + notKnown,
    peak: Math.max(1, ...observed.map((row) => row.count)),
  };
}

/** What to say about the customers this panel cannot answer for. `null` when
 *  every one of them ordered, because then there is nothing missing to admit. */
export function notKnownNote(notKnown: number, total: number): string | null {
  if (notKnown <= 0) return null;
  const tail = 'Until somebody orders, there is nothing to say about where they came from.';
  if (notKnown === 1 && total === 1) {
    return `This customer has not ordered yet. ${tail}`;
  }
  if (notKnown === total) {
    return `None of these ${total.toLocaleString()} have ordered yet. ${tail}`;
  }
  return `${notKnown.toLocaleString()} of these ${total.toLocaleString()} have not ordered yet. ${tail}`;
}
