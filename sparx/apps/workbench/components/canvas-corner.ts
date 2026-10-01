// ROOM FOR THE FLOATING TOOLS, said once.
//
// The workspace tools — the size glass, and the tidy menu in windows mode —
// float at the canvas's bottom-right corner, above every pane (see
// WindowCanvas). A pane docked against that edge puts its FOOTER in exactly
// that corner, so whatever the footer right-aligns ends up underneath them.
//
// Keyed on the CANVAS rather than on a width. A container query cannot answer
// it — a 600px pane docked right collides and a 900px pane docked left does not
// — and the mobile shell mounts no floating tools at all, so a phone would have
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
