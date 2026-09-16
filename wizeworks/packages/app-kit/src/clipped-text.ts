// Text that is cut off should still be readable.
//
// The workbench clips long values to keep a table's columns honest — `truncate`
// and `line-clamp-*` on a cell that must not push its neighbours off the pane.
// That is the right layout decision and it has a hole in it: the part that was
// cut off is not reachable by any means. On a purchase order, "Brass belt
// hardware, antique" reads as "Brass belt h…" with no way to see the rest.
//
// It is not rare. There are 991 clipping spans across the two workbenches, 352
// of them showing a name a person wrote, and 45.6% of the product titles on this
// platform are longer than the column that shows them.
//
// Fixing that at 991 call sites is a sweep, and a sweep over JSX is how controls
// get deleted with every check green. So it is fixed ONCE, here, as behavior:
// a delegated listener notices the element under the pointer, measures whether
// it is actually clipped, and puts the whole string in its `title`. Nothing is
// measured until somebody hovers, so the cost is one read per hover and zero
// otherwise — and nothing is added to an element whose text fits, which a
// blanket `title` on every clipping span could not avoid.
//
// An author's own `title` is never touched. A `title` this put there is removed
// again the moment the element stops being clipped, so widening a pane does not
// leave a tooltip behind repeating a line that is fully on screen.

/** What the decision needs to know about one element. Structural so the rule can
 *  be tested without a DOM. */
export interface ClipMetrics {
  scrollWidth: number;
  clientWidth: number;
  scrollHeight: number;
  clientHeight: number;
  /** The element's visible text, before normalizing. */
  text: string;
  /** A `title` the element already carries, if any. */
  existingTitle: string | null;
}

/**
 * Sub-pixel layout makes `scrollWidth` round up past `clientWidth` on text that
 * fits perfectly well, so a bare `>` reports a clip on lines nobody clipped.
 * One pixel of slack is enough to tell a rounding artifact from a cut word.
 */
const SLACK_PX = 1;

/** Collapse the whitespace JSX leaves between elements, so a tooltip reads as
 *  one line rather than as the source's indentation. */
function normalize(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

/**
 * The whole string this element is only showing part of, or `null` if there is
 * nothing to reveal.
 *
 * Returns `null` when the author has already written a `title`: their sentence
 * says something this one does not, and replacing it with the visible text would
 * lose it.
 */
export function clippedTitleFor(metrics: ClipMetrics): string | null {
  if (metrics.existingTitle !== null) return null;

  const text = normalize(metrics.text);
  if (text === '') return null;

  const clipped =
    metrics.scrollWidth > metrics.clientWidth + SLACK_PX ||
    metrics.scrollHeight > metrics.clientHeight + SLACK_PX;

  return clipped ? text : null;
}
