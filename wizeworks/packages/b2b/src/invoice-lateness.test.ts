// HOW LATE A FLEET'S BILL IS, WORKED OUT WHEN IT IS ASKED.
//
// At 1:27am Denver time on Oct 9 an AI app asked Gillett's sparx for the overdue
// fleet invoices and was told O'Malley's 4471 was 42 days late. The Invoices screen
// said 43. The API returned a stored count that a job refreshes at 6pm Denver, so
// for eighteen hours a day it was a day behind (sparx persona issue 175).

import { describe, expect, it } from 'vitest';

import { invoiceLateness } from './invoice-lateness.js';

const DENVER = 'America/Denver';
// 1:27am on Oct 9 in Denver.
const NOW = new Date('2026-10-09T07:27:00Z');
// Due dates are stored as noon UTC on the day.
const due = (day: string) => new Date(`${day}T12:00:00Z`);

describe('how late a bill is', () => {
  it("is counted on the business's calendar today, not on the stored count", () => {
    const bill = {
      status: 'overdue',
      dueAt: due('2026-08-27'),
      amountCents: 128640,
      balanceCents: 128640,
    };
    expect(invoiceLateness(bill, NOW, DENVER)).toEqual({ status: 'overdue', overdueDays: 43 });
  });

  it('turns an unpaid bill overdue the morning after its due day, before any job runs', () => {
    const bill = {
      status: 'unpaid',
      dueAt: due('2026-10-08'),
      amountCents: 5000,
      balanceCents: 5000,
    };
    expect(invoiceLateness(bill, NOW, DENVER)).toEqual({ status: 'overdue', overdueDays: 1 });
  });

  it('is not late on its due day', () => {
    const bill = {
      status: 'unpaid',
      dueAt: due('2026-10-09'),
      amountCents: 5000,
      balanceCents: 5000,
    };
    expect(invoiceLateness(bill, NOW, DENVER)).toEqual({ status: 'unpaid', overdueDays: 0 });
  });

  it('is part paid, not overdue, once its due date was moved out', () => {
    const bill = {
      status: 'overdue',
      dueAt: due('2026-11-01'),
      amountCents: 5000,
      balanceCents: 2000,
    };
    expect(invoiceLateness(bill, NOW, DENVER)).toEqual({ status: 'partial', overdueDays: 0 });
  });

  it('is never late once paid or written off', () => {
    for (const status of ['paid', 'void']) {
      const bill = { status, dueAt: due('2026-08-27'), amountCents: 5000, balanceCents: 0 };
      expect(invoiceLateness(bill, NOW, DENVER)).toEqual({ status, overdueDays: 0 });
    }
  });
});
