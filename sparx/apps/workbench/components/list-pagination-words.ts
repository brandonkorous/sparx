// What the pager SAYS, and whether it is worth a row of the pane at all.
//
// Kept apart from the control itself because the console's test seat runs plain
// TypeScript and no React: a sentence a business owner reads is a pure function
// and gets a test; the component that places it is checked by driving the screen.

/** The range readout, in words. Undefined total is reported as unknown, never as
 *  zero — "1–50 of 0" would be a lie the moment an endpoint stops sending a
 *  count. */
export function rangeLabel(shown: number, firstRow: number, total: number | undefined): string {
  if (shown === 0) return 'Nothing to show';
  const lastRow = firstRow + shown - 1;
  return total === undefined
    ? `Showing ${String(firstRow)}–${String(lastRow)}`
    : `Showing ${String(firstRow)}–${String(lastRow)} of ${String(total)}`;
}

/**
 * Whether this control has anything in it worth a row of the pane.
 *
 * Rows on screen means a readout worth reading. No rows means the surface's own
 * empty state is saying it, and better — UNLESS there is somewhere to go from
 * here, which is the case that makes this a guard rather than a blanket hide:
 *
 *   • a reader on page 5 of a list that just shrank to 2 pages has zero rows and
 *     needs the page numbers to get back, and
 *   • a cursor feed walked into a quiet window has zero rows and needs Newer.
 *
 * Hide those and the reader is stranded on an empty screen with no way off it.
 */
export function pagerHasContent(o: {
  shown: number;
  cursorMode: boolean;
  pageCount: number;
}): boolean {
  return o.shown > 0 || o.cursorMode || o.pageCount > 1;
}
