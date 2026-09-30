// What a person wrote down about a payment, and never anything a machine wrote.

/** Where the order pane's own note box ever wrote into `processorRef`, before
 *  issue 223 moved the note to `metadata.note`. Elsewhere that field is a
 *  gateway charge id, a gift card's code or a till id, which is nobody's note. */
const HAND_TAKEN = new Set(['manual', 'check', 'wire']);

/** The note on a payment, or null when nobody wrote one. An old hand-taken row
 *  keeps its note in `processorRef`, unless an invoice recorded it, whose
 *  `processorRef` is the invoice payment's id. */
export function paymentNote(payment: {
  processor: string;
  processorRef: string | null;
  metadata?: Record<string, unknown> | null;
}): string | null {
  const note = payment.metadata?.note;
  if (typeof note === 'string' && note.trim()) return note.trim();
  if (!HAND_TAKEN.has(payment.processor)) return null;
  if (payment.metadata?.billingDocumentId !== undefined) return null;
  const older = payment.processorRef?.trim() ?? '';
  return older === '' ? null : older;
}
