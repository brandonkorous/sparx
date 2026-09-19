// A ZERO IS NOT A PROBLEM, SO IT DOES NOT WEAR A PROBLEM'S COLOR.
//
// "Things that do not add up" showed a business owner three big numbers in a
// row:
//
//     1            0                  0
//     Sales refused  Promised anyway   Sold below zero
//
// in amber, blue and red. The color was fixed to the KIND of event rather than
// to whether any had happened, so two of the three shouted about nothing. The
// eye goes to the red one, which is the number that says nothing went wrong.
//
// The rule was already written down, in a comment on the receivables card:
//
//     The one figure allowed to shout. Everything else on this surface stays
//     neutral so that this reads as urgent rather than decorative.
//
// And 150 lines above those three stats, in the very same file, a fourth count
// already guarded itself with `openDrifts > 0 ? 'text-danger …' : '…'`. Six
// screens never got the message. [[feedback_a_fix_leaves_its_neighbour_behind]]
//
// This is RULE #4 read forwards rather than backwards: color IS the design, so
// spending it on a zero is what leaves nothing for the number that matters.
//
// A leaf module, importing nothing, so the rule can be tested.

/**
 * The ink for a count that means "here is a problem": the given color when
 * there is something to see, and the surface's ordinary ink when there is not.
 *
 * `ink` must be a LITERAL Tailwind class at the call site, not built from a
 * variable — Tailwind reads source text and never generates an interpolated
 * class name.
 *
 * Returns the empty string for zero rather than a muted or faded class: a zero
 * is still a figure she is meant to READ, and fading it would break RULE #3 to
 * fix RULE #4.
 */
export function countInk(count: number, ink: string): string {
  return count > 0 ? ink : '';
}

/**
 * The same rule, spelled for a `className` that also carries size and weight.
 *
 * `countClass(0, 'text-2xl font-semibold tabular-nums', 'text-danger')` gives
 * back the base classes alone.
 */
export function countClass(count: number, base: string, ink: string): string {
  const tone = countInk(count, ink);
  return tone === '' ? base : `${base} ${tone}`;
}
