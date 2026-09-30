// The Late control on the invoices list, and how it arrives from outside.
//
// Split out of `invoice-list.tsx` so it can be TESTED: that file is React, and
// the console's test seat is plain Node. The half worth guarding is the pairing
// with Home's "8 invoices are late", which counts `pastDue=true` — the sentence
// opened the whole receivables list, paid and unpaid, with the eight somewhere
// in it ([258]).

// LATE IS A DATE, NOT A STATUS. `overdue` used to sit in the Status list, which
// made it look like the answer to "who is late" and it was not: the status
// column is written when something is DONE to a document, and a due date passing
// is nobody doing anything, so it went on saying `unpaid` or `partial` for ever
// (issue 522). Asking the due date is a different question from asking the money
// state, the way `sent` is, so it gets its own control rather than a word in
// somebody else's list.
export const LATE_FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'true', label: 'Late only' },
] as const;

export type LateFilter = (typeof LATE_FILTERS)[number]['value'];

/**
 * `pastDue` on the address — the same key the chip is saved under and the same
 * value it sends — read once as the chip's starting value, so the narrowing is on
 * screen and one tap turns it off. Anything unrecognised means "no narrowing".
 */
export function parseLate(raw: unknown): LateFilter {
  return LATE_FILTERS.find((option) => option.value === raw)?.value ?? 'all';
}
