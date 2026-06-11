// AR (accounts-receivable) derivation for billing documents (docs/87 §8). Pure +
// DB-free so the status machine and payment aggregation are unit-testable. The
// document's status is PAYMENT-derived and independent of the workflow stage:
// moving a card to a "Paid" stage doesn't mark money received — recording a
// payment does.

export type DocumentStatus = 'unpaid' | 'partial' | 'paid' | 'overdue' | 'void';

export interface DeriveStatusArgs {
  total: number;
  amountPaid: number;
  dueAt: Date | null;
  voided: boolean;
  now: Date;
}

/** The AR status machine. Precedence: void > paid > overdue > partial > unpaid.
 *  `overdue` is a past-due balance (any unpaid/partial amount past `dueAt`); a
 *  fully-paid document is never overdue. */
export function deriveDocumentStatus(args: DeriveStatusArgs): DocumentStatus {
  const { total, amountPaid, dueAt, voided, now } = args;
  if (voided) return 'void';
  const pastDue = dueAt !== null && dueAt.getTime() < now.getTime();
  if (amountPaid <= 0) {
    // Nothing paid: overdue only if something is actually owed past the due date.
    return pastDue && total > 0 ? 'overdue' : 'unpaid';
  }
  if (amountPaid >= total) return 'paid';
  return pastDue ? 'overdue' : 'partial';
}

export interface PaymentRow {
  kind: string;
  amount: number;
}

/** Aggregate payment rows into the document's cached money fields. A `refund`
 *  reduces amountPaid; a `deposit` counts toward both amountPaid and the deposit
 *  subtotal; anything else is treated as a regular payment. */
export function aggregatePayments(rows: PaymentRow[]): {
  amountPaid: number;
  depositTotal: number;
} {
  let payments = 0;
  let deposits = 0;
  let refunds = 0;
  for (const r of rows) {
    if (r.kind === 'refund') refunds += r.amount;
    else if (r.kind === 'deposit') deposits += r.amount;
    else payments += r.amount;
  }
  return {
    amountPaid: round2(payments + deposits - refunds),
    depositTotal: round2(deposits),
  };
}

/** Parse a B2B account's free-text payment terms ("net30", "net 15", "due on
 *  receipt") into a day count. Unknown / empty → 0 (due immediately). */
export function netTermsDays(paymentTerms: string | null | undefined): number {
  if (!paymentTerms) return 0;
  const match = /(\d+)/.exec(paymentTerms);
  return match ? Number(match[1]) : 0;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
