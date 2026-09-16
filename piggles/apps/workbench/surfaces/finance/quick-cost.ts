'use client';

// Why the quick cost row cannot be recorded yet, in words.
//
// The row is three fields and a button, and the button needs all three. It used
// to say so only about the amount, and only when the amount was unreadable —
// so somebody who typed $12.50 and "Horn buttons from the Saturday market" and
// then went looking for the grey Record button was told nothing at all. A dead
// control with no reason beside it is a dead end: the one thing she cannot work
// out by looking is the thing the screen knows.
//
// ONE sentence, like `cms/webhook-draft`'s `draftProblem`, so the line under the
// row and anything else that explains the button can never disagree.

/** What the row holds, as typed. `amountCents` is the parsed reading of
 *  `amount` — null when it is not a number we can read. */
export interface QuickCostDraft {
  amount: string;
  amountCents: number | null;
  description: string;
  categoryId: string;
}

/** "a, b and c" — no comma before the "and", because this is a sentence and not
 *  a list of clauses. */
function and(parts: string[]): string {
  if (parts.length <= 1) return parts[0] ?? '';
  return `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1] ?? ''}`;
}

/**
 * The one sentence under the row, or null when there is nothing to say.
 *
 * Null on an untouched row. An empty row is not a mistake, it is a row nobody
 * has typed in, and a pane that opens already telling somebody off is worse than
 * one that waits. "Touched" deliberately ignores the category: a saved cost
 * clears the amount and the description but KEEPS the category, because a run of
 * receipts is usually a run of the same kind of thing — so counting the sticky
 * category as a start would nag after every successful save.
 */
export function quickCostProblem(draft: QuickCostDraft): string | null {
  const amount = draft.amount.trim();
  const description = draft.description.trim();

  const touched = amount !== '' || description !== '';
  if (!touched) return null;

  // The malformed cases first, and only once something is in the box: they are
  // about what she can already see, so answering them with "add an amount" would
  // be telling her a field she filled in is empty.
  if (amount !== '' && draft.amountCents === null) {
    return 'That amount is not a number we can read. Try something like 42.50.';
  }
  if (draft.amountCents !== null && draft.amountCents <= 0) {
    return 'A cost has to be more than nothing. Put in what it actually came to.';
  }

  const missing: string[] = [];
  if (draft.amountCents === null) missing.push('an amount');
  if (description === '') missing.push('what it was for');
  if (draft.categoryId === '') missing.push('a category');

  if (missing.length === 0) return null;
  return `Add ${and(missing)} to record this.`;
}
