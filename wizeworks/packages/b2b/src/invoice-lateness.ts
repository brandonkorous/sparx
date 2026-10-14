// How late a trade account's bill is, worked out when somebody asks.
//
// The stored `overdue_days` and `status` are refreshed by a daily job (6pm Denver
// time for Gillett), so between midnight and the job every read was a day behind:
// an AI app was told O'Malley's bill was 42 days late while the Invoices screen
// said 43 (sparx persona issue 175). Worked out here, on the business's calendar,
// with the same `daysPastDue` the screens use.

import { daysPastDue } from '@wizeworks/crm';

/** The status a bill has today, and how many whole days late it is. */
export function invoiceLateness(
  bill: { status: string; dueAt: Date | null; amountCents: number; balanceCents: number },
  now: Date,
  timeZone: string | null
): { status: string; overdueDays: number } {
  if (bill.status === 'paid' || bill.status === 'void' || bill.balanceCents <= 0) {
    return { status: bill.status, overdueDays: 0 };
  }
  const days = bill.dueAt ? daysPastDue(bill.dueAt, now, timeZone) : 0;
  if (days > 0) return { status: 'overdue', overdueDays: days };
  // Not late today. A bill stored as overdue had its due date moved out.
  const owed = bill.balanceCents < bill.amountCents ? 'partial' : 'unpaid';
  return { status: bill.status === 'overdue' ? owed : bill.status, overdueDays: 0 };
}
