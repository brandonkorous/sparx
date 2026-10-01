// What the footer of an UNPAGED list says.
//
// The long lists carry a pager and get their sentence from list-pagination-words.
// A short list has no pager and still owes the reader one fact: how many there
// are. Ten surfaces each wrote that fact out by hand, which is how three
// different wordings and one wrong text size came to live in the same row.
//
// Kept apart from the component for the same reason the pager's words are: the
// console's test seat runs plain TypeScript and no React, so a sentence a
// business owner reads is a pure function and gets a test.

/**
 * How many rows there are, in words.
 *
 * Two readings, and they are not the same fact:
 *   • FILTERED — the reader narrowed the list, so the number they want is what
 *     came back, and the total would answer a question they stopped asking.
 *   • WHOLE — nothing is narrowed, so the number is everything there is.
 *
 * `noun` is the only part that varies between surfaces, and it varies because
 * the ROWS vary: tasks are "to do", help requests are "open", everything else is
 * "in total". Returns null when there is nothing to say — a count the server has
 * not sent yet, or a fetch still in flight, must not render as zero.
 * [[feedback_never_present_absence_as_measurement]]
 */
export function countLabel(o: {
  shown: number;
  total: number | undefined;
  filtered: boolean;
  pending: boolean;
  noun?: string;
}): string | null {
  if (o.pending) return null;
  if (typeof o.total !== 'number') return null;
  return o.filtered
    ? `${o.shown.toLocaleString()} shown`
    : `${o.total.toLocaleString()} ${o.noun ?? 'in total'}`;
}
