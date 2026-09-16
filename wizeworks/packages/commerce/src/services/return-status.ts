// Which moves a return will still accept, by where it has got to.
//
// Pulled out of return-service.ts because the answers are pure rules about a
// word, and the service that enforces them is 1,000 lines of database work that
// can only be exercised against a real Postgres. A rule nobody can test in
// isolation is a rule that drifts from the six places it is spelled out.

/**
 * Whether a return's money question is closed.
 *
 * BOTH endings count. A swap is settled exactly as finally as a refund: the
 * customer has their replacement, nothing is owed either way, and no later
 * transition may reopen it. The guard used to name only `refunded`, because
 * `exchanged` did not exist when it was written — so the sentence a shop read
 * on a swapped return was "Cannot issue refund from status exchanged; expected
 * inspected or received", which describes a state machine rather than the fact
 * that this return is finished (issue 452).
 */
export function isSettledReturn(status: string): boolean {
  return status === 'refunded' || status === 'exchanged';
}

/**
 * Whether what physically came back may still be written down.
 *
 * This is the ONE thing a settled return still accepts, and it is deliberate.
 * The condition of the goods is a fact about the goods, not about the money —
 * looking in the box does not un-refund anybody.
 *
 * The alternative stranded them. A return can be settled straight from "back
 * with you" without recording anything, and after settling the console offered
 * no route to record it. The returns bench that asks "what have I not decided
 * about yet" is built on inspection rows, so goods with no inspection appear on
 * no list, ever: not on the bench, not in the valuation, nowhere. They simply
 * stop existing on screen while sitting in a box on a shelf (issue 452).
 */
export function canRecordInspection(status: string): boolean {
  return status === 'received' || status === 'inspecting' || isSettledReturn(status);
}

/**
 * Whether recording the condition should ALSO move the return to "checked".
 *
 * Never for a settled return. Writing down what came back must not walk a
 * finished return backwards into a stage that offers to settle it a second
 * time.
 */
export function inspectionAdvancesStatus(status: string): boolean {
  return !isSettledReturn(status);
}
