// What an invoice is doing, in words, with its semantic colour.
//
// Two panes carry the same five-value column and drifted apart: the wholesale
// list said "Part paid" and "Written off", the invoicing list printed the raw
// value — `unpaid`, `partial` — beside a tone it had already worked out. So the
// colour was the business's and the word was the database's.

/** The five states an invoice can be in. One union, both panes. */
export type InvoiceStatus = 'unpaid' | 'partial' | 'paid' | 'overdue' | 'void';

/** Status is its own colour axis, independent of the module hue (docs/23).
 *  `undefined` is a deliberate member: see `void` below. */
export type InvoiceTone = 'success' | 'warning' | 'danger' | 'info' | undefined;

export interface InvoiceState {
  label: string;
  tone: InvoiceTone;
}

/**
 * `overdueDays` is optional because only the wholesale projection counts them.
 * Where it is known the badge says how late, which is the thing somebody chasing
 * money actually needs; where it is not, "Late" is the whole truth available and
 * a made-up day count would be worse than none.
 *
 * `void` gets NO colour rather than a grey one. A written-off invoice is a real
 * outcome carrying no semantic tone, and a colourless badge resolves to base ink
 * in both themes — where `color="neutral"` is a choice that needs approval.
 */
export function invoiceState(status: InvoiceStatus, overdueDays?: number | null): InvoiceState {
  switch (status) {
    case 'paid':
      return { label: 'Paid', tone: 'success' };
    case 'partial':
      return { label: 'Part paid', tone: 'info' };
    case 'overdue':
      return {
        label: overdueDays && overdueDays > 0 ? `Late by ${String(overdueDays)} days` : 'Late',
        tone: 'danger',
      };
    case 'void':
      return { label: 'Written off', tone: undefined };
    default:
      return { label: 'Owed', tone: 'warning' };
  }
}
