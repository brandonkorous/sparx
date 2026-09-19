// IS THE SITE ACTUALLY BEING SERVED RIGHT NOW?
//
// A separate question from "is this page published", and the console was
// answering only the second one while making a claim about the first:
//
//     Published
//     Live on your site. Anyone can read it.
//
// A suspended account's public site serves the "Temporarily unavailable · Back
// soon" overlay instead of its pages — checked, not assumed: the site answered
// 200 with that overlay for this tenant while the console showed four legal
// pages each saying anyone can read it. Measured the same day, **32 of the 113
// tenants on the platform are past their grace window**, so every one of them
// is told a stranger can read pages nobody can reach.
//
// The page's own state is still `published`, and that is the state the owner
// controls, so the label and its color are untouched. It is only the sentence
// about who can READ it that has to stop being said while the lights are off.
//
// Pure predicate plus a hook, so the copy modules stay testable without the
// query stack behind them.

import { useBill, type BillingPhaseView } from '../../surfaces/finance/bill-data';

/**
 * True when the public site is dark.
 *
 * ONLY `suspended`. `grace` deliberately keeps the site live for its whole
 * window (that is what grace is for), and an account still `trialing` is fully
 * served, so neither of those may suppress the sentence. An `undefined` billing
 * view means the answer has not arrived, and a page is not declared unreachable
 * on a guess — the ordinary, reassuring sentence is the right default.
 */
export function siteIsDark(billing: BillingPhaseView | undefined): boolean {
  return billing?.phase === 'suspended';
}

/** The same, read from the account the console is signed in to. Shares
 *  `useBill`'s query with the billing banner in the chrome, so it costs nothing
 *  extra. */
export function useSiteIsDark(): boolean {
  const { data: bill } = useBill();
  return siteIsDark(bill?.billing);
}
