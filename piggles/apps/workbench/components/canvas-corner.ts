// ROOM FOR THE FLOATING TOOLS, said once.
//
// The workspace tools — the size glass, and the tidy menu in windows mode —
// float at the canvas's bottom-right corner, above every pane (see
// WindowCanvas). A pane docked against that edge puts its FOOTER in exactly
// that corner, so whatever the footer right-aligns ends up underneath them.
//
// Keyed on the CANVAS rather than on a width. A container query cannot answer
// it — a 600px pane docked right collides and a 900px pane docked left does not
// — and the compact shell mounts no floating tools at all, so a phone would have
// paid for room nothing was standing in.
//
// The number is the worst case, measured: two 48px buttons, a 4px gap, 8px of
// padding and a border make the pill 110px, and it sits 16px off the edge. 144px
// clears it with room to spare, and the same number in both footers keeps the
// last thing on a paged list level with the last thing on a counted one.
//
// ONE export, not two literals. This was already solved once for the pager
// (issue 772, measured 2026-09-22) and the fix did not reach the twelve surfaces
// that write their own footer row, because there was nothing for it to reach
// them THROUGH. [[feedback_a_fix_leaves_its_neighbour_behind]]

/** Padding that keeps a footer's right-hand end clear of the floating tools.
 *  Put it on whatever a footer pushes to its right edge. */
export const CANVAS_CORNER_CLEARANCE = '[[data-canvas-tools]_&]:pe-36';

/**
 * Room at the END of every pane's full-height scrolling list, so its last row can be
 * scrolled up out from under the tools. A footer moves sideways; a list's last row
 * cannot, and its right-hand end is where a row keeps its actions. Rosalind could not
 * reach "Delete" on the last page in her page list: the size glass sat on it, and the
 * list could not scroll any further (persona issue 947). 80px clears the pill (56px)
 * and its 16px offset.
 *
 * Put on the canvas once, matching the pane list's own shape (`flex-1` + scroll),
 * rather than on the 300-odd lists that share it.
 */
export const CANVAS_LIST_END_CLEARANCE = '[&_.flex-1.overflow-y-auto]:pb-20';
