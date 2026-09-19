// WHAT THE CONDITIONS FOUND, AND WHERE IT WENT.
//
// The rules pane had two sentences: "no products match yet" and "N products
// matched". Both read `productCount`, which since issue 626 means what a SHOPPER
// would find in the group ON THIS SITE rather than how many filing rows exist.
//
// That split one of those sentences in half. On a business running seven websites,
// the group "New arrivals" matched five products and every one of them was
// jewelry or fragrance belonging to their other sites. Under the old count the
// pane said "5 products matched" over a group page holding nothing; under the
// new one it would say "No products match these conditions yet", which is worse,
// because the conditions plainly did match and the author would go and rewrite rules
// that are working ([[feedback_one_outcome_two_causes]]).
//
// Two causes, two fixes, so they get two sentences.

/** What the pane knows after a read. */
export interface MembershipFacts {
  /** Matched AND on this website: what a shopper would find. */
  shown: number;
  /** Matched but not on this website: archived, still a draft, or kept for one
   *  of the business's other sites. */
  hidden: number;
}

/** The shared tail, so the three sentences that need it word it identically. */
const WHY_HIDDEN = 'archived, still a draft, or kept for one of your other sites';

function products(n: number): string {
  return `${String(n)} product${n === 1 ? '' : 's'}`;
}

/** The line under "Which products belong here". */
export function membershipLine(facts: MembershipFacts): string {
  const { shown, hidden } = facts;

  // Nothing anywhere. The conditions really have found nothing, or no check has
  // run since they were written.
  if (shown === 0 && hidden === 0) {
    return (
      'No products match these conditions yet, or the last check has not run. ' +
      'Membership is worked out in the background after you save.'
    );
  }

  // The conditions WORK and the results are somewhere else. Saying "no products
  // match" here sends the author to rewrite a rule that is doing its job.
  if (shown === 0) {
    const one = hidden === 1;
    return (
      `${products(hidden)} ${one ? 'matches' : 'match'} these conditions, but ` +
      `${one ? 'it is not' : 'none of them is'} on this website: ${WHY_HIDDEN}.`
    );
  }

  if (hidden === 0) {
    return (
      `${products(shown)} matched when membership was last worked out. ` +
      'It refreshes in the background after a change.'
    );
  }

  return (
    `${products(shown)} on this website matched when membership was last worked out, ` +
    `and ${String(hidden)} more matched but ${hidden === 1 ? 'is' : 'are'} not shown here: ${WHY_HIDDEN}.`
  );
}

/**
 * How many products a DELETE has to account for.
 *
 * Deleting the group removes it from every site at once, so the dialog counts
 * every site's worth. Counting only what is visible here would offer "the
 * products in it are kept" over a number that is not the number kept — and on a
 * group split across sites it would have read as though it were empty.
 */
export function filedInGroup(facts: MembershipFacts): number {
  return facts.shown + facts.hidden;
}
