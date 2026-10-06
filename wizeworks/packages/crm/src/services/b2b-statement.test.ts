import { describe, expect, it } from 'vitest';

import {
  computeStatement,
  parseStatementDay,
  paymentTermsWords,
  statementPeriod,
  type StatementBillInput,
} from './b2b-statement';
import { CrmValidationError } from '../errors';

// Wasatch Front Utility Contractors buys from Gillett Diesel on Net 30 and pays
// against its own purchase orders. Their AP clerk reconciles the statement line
// by line against their ledger, so every number here has to add up exactly.

const at = (iso: string) => new Date(iso);

function bill(partial: Partial<StatementBillInput> & { id: string }): StatementBillInput {
  return {
    number: null,
    poNumber: null,
    issuedAt: at('2026-09-02T18:00:00Z'),
    dueAt: null,
    totalCents: 0,
    voidedAt: null,
    payments: [],
    ...partial,
  };
}

const OCTOBER = statementPeriod(
  { from: '2026-10-01', to: '2026-10-31' },
  at('2026-11-15T12:00:00Z')
);

describe('the statement for a period', () => {
  const september = bill({
    id: 'a',
    number: 'INV-000001',
    poNumber: 'WFUC-24-0823',
    issuedAt: at('2026-09-02T18:13:19Z'),
    dueAt: at('2026-10-02T18:13:19Z'),
    totalCents: 67800,
    payments: [
      {
        id: 'p1',
        kind: 'payment',
        method: 'check',
        reference: '10442',
        amountCents: 67800,
        receivedAt: at('2026-10-09T15:00:00Z'),
      },
    ],
  });
  const october = bill({
    id: 'b',
    number: 'INV-000003',
    poNumber: 'WFUC-24-0817',
    issuedAt: at('2026-10-02T19:12:54Z'),
    dueAt: at('2026-11-01T19:12:54Z'),
    totalCents: 407560,
  });

  it('opens on everything owed before the first day, and adds the period up to the close', () => {
    const s = computeStatement([september, october], OCTOBER);
    expect(s.openingCents).toBe(67800);
    expect(s.chargesCents).toBe(407560);
    expect(s.creditsCents).toBe(67800);
    expect(s.closingCents).toBe(407560);
    expect(s.closingCents).toBe(s.openingCents + s.chargesCents - s.creditsCents);
  });

  it('lists the period in date order with a running balance', () => {
    const s = computeStatement([september, october], OCTOBER);
    expect(s.rows.map((r) => [r.kind, r.documentNumber, r.balanceCents])).toEqual([
      ['invoice', 'INV-000003', 475360],
      ['payment', 'INV-000001', 407560],
    ]);
  });

  it("carries the buyer's PO number on every row of its invoice, payments included", () => {
    const s = computeStatement([september, october], OCTOBER);
    const payment = s.rows.find((r) => r.kind === 'payment');
    expect(payment?.poNumber).toBe('WFUC-24-0823');
    expect(payment?.description).toBe('Payment by check, ref 10442');
    expect(s.rows.find((r) => r.kind === 'invoice')?.poNumber).toBe('WFUC-24-0817');
    // The number has its own column; the row says what happened.
    expect(s.rows.find((r) => r.kind === 'invoice')?.description).toBe('Invoice issued');
  });

  it('shows the due date on the invoice row only', () => {
    const s = computeStatement([september, october], OCTOBER);
    expect(s.rows.find((r) => r.kind === 'invoice')?.dueAt).toBe('2026-11-01T19:12:54.000Z');
    expect(s.rows.find((r) => r.kind === 'payment')?.dueAt).toBeNull();
  });

  it('leaves out a bill issued after the period ends', () => {
    const later = bill({
      id: 'c',
      number: 'INV-000009',
      issuedAt: at('2026-11-03T10:00:00Z'),
      totalCents: 5000,
    });
    const s = computeStatement([september, october, later], OCTOBER);
    expect(s.rows.some((r) => r.documentNumber === 'INV-000009')).toBe(false);
    expect(s.openItems.some((i) => i.number === 'INV-000009')).toBe(false);
    expect(s.closingCents).toBe(407560);
  });

  it('counts a refund back onto the balance', () => {
    const refunded = bill({
      id: 'r',
      number: 'INV-000004',
      issuedAt: at('2026-10-03T10:00:00Z'),
      totalCents: 20000,
      payments: [
        {
          id: 'p',
          kind: 'payment',
          method: 'card',
          reference: null,
          amountCents: 20000,
          receivedAt: at('2026-10-04T10:00:00Z'),
        },
        {
          id: 'q',
          kind: 'refund',
          method: 'card',
          reference: null,
          amountCents: 5000,
          receivedAt: at('2026-10-05T10:00:00Z'),
        },
      ],
    });
    const s = computeStatement([refunded], OCTOBER);
    expect(s.rows.map((r) => [r.kind, r.chargeCents, r.creditCents, r.balanceCents])).toEqual([
      ['invoice', 20000, 0, 20000],
      ['payment', 0, 20000, 0],
      ['refund', 5000, 0, 5000],
    ]);
    expect(s.closingCents).toBe(5000);
  });
});

describe('a written-off invoice', () => {
  const writtenOff = bill({
    id: 'w',
    number: 'INV-000002',
    poNumber: 'WFUC-24-0790',
    issuedAt: at('2026-08-01T10:00:00Z'),
    dueAt: at('2026-08-31T10:00:00Z'),
    totalCents: 50000,
    voidedAt: at('2026-10-20T10:00:00Z'),
    payments: [
      {
        id: 'p',
        kind: 'payment',
        method: 'ach',
        reference: null,
        amountCents: 20000,
        receivedAt: at('2026-09-10T10:00:00Z'),
      },
    ],
  });

  it('takes off only what was still owed, on the day it was written off', () => {
    const s = computeStatement([writtenOff], OCTOBER);
    expect(s.openingCents).toBe(30000);
    expect(s.rows).toHaveLength(1);
    expect(s.rows[0]).toMatchObject({
      kind: 'write_off',
      documentNumber: 'INV-000002',
      poNumber: 'WFUC-24-0790',
      creditCents: 30000,
      balanceCents: 0,
      description: 'Written off',
    });
    expect(s.closingCents).toBe(0);
    expect(s.openItems).toHaveLength(0);
  });

  it('is still open on a statement for a period that ended before the write-off', () => {
    const september = statementPeriod(
      { from: '2026-09-01', to: '2026-09-30' },
      at('2026-11-15T12:00:00Z')
    );
    const s = computeStatement([writtenOff], september);
    expect(s.rows.some((r) => r.kind === 'write_off')).toBe(false);
    expect(s.openItems.map((i) => [i.number, i.openCents])).toEqual([['INV-000002', 30000]]);
    expect(s.closingCents).toBe(30000);
  });
});

describe('aging at the end of the period', () => {
  // Every bill is open; each is due a different number of days before Oct 31.
  const due = (days: number, cents: number, n: string) =>
    bill({
      id: n,
      number: n,
      issuedAt: at('2026-06-01T10:00:00Z'),
      dueAt: new Date(Date.UTC(2026, 9, 31) - days * 86_400_000 + 15 * 3_600_000),
      totalCents: cents,
    });

  const bills = [
    due(-3, 100, 'NOT-YET'),
    due(0, 200, 'TODAY'),
    due(1, 300, 'ONE'),
    due(30, 400, 'THIRTY'),
    due(31, 500, 'THIRTY-ONE'),
    due(61, 600, 'SIXTY-ONE'),
    due(91, 700, 'NINETY-ONE'),
  ];

  it('files each balance by how late it was on the last day, not today', () => {
    // Printed weeks later: aged as of October 31st all the same.
    const period = statementPeriod(
      { from: '2026-10-01', to: '2026-10-31' },
      at('2027-02-01T12:00:00Z')
    );
    const s = computeStatement(bills, period);
    expect(s.aging.map((b) => [b.key, b.count, b.cents])).toEqual([
      ['current', 2, 300],
      ['d1_30', 2, 700],
      ['d31_60', 1, 500],
      ['d61_90', 1, 600],
      ['d90_plus', 1, 700],
    ]);
    expect(s.aging.map((b) => b.label)).toEqual([
      'Not yet due',
      '1 to 30 days late',
      '31 to 60 days late',
      '61 to 90 days late',
      'Over 90 days late',
    ]);
  });

  it('owes now what is due by the last day, and is late on what is past it', () => {
    const s = computeStatement(bills, OCTOBER);
    expect(s.dueNowCents).toBe(200 + 300 + 400 + 500 + 600 + 700);
    expect(s.pastDueCents).toBe(300 + 400 + 500 + 600 + 700);
    expect(s.openItems.find((i) => i.number === 'TODAY')?.daysLate).toBe(0);
    expect(s.openItems.find((i) => i.number === 'THIRTY-ONE')?.daysLate).toBe(31);
  });

  it('agrees with the closing balance when nothing is overpaid', () => {
    const s = computeStatement(bills, OCTOBER);
    expect(s.aging.reduce((sum, b) => sum + b.cents, 0)).toBe(s.closingCents);
  });

  it('treats a bill with no due date as due now and not late', () => {
    const s = computeStatement([bill({ id: 'x', number: 'X', totalCents: 900 })], OCTOBER);
    expect(s.dueNowCents).toBe(900);
    expect(s.pastDueCents).toBe(0);
    expect(s.aging[0]).toMatchObject({ key: 'current', cents: 900 });
  });
});

describe('the period', () => {
  it('is the month so far, on the business calendar, when nothing is chosen', () => {
    // 9pm on Oct 31 in Denver is already Nov 1 in UTC.
    const p = statementPeriod({}, at('2026-11-01T03:00:00Z'), 'America/Denver');
    expect([p.from, p.to]).toEqual(['2026-10-01', '2026-10-31']);
    expect(p.endExclusive.toISOString()).toBe('2026-11-01T00:00:00.000Z');
  });

  it('fills in a missing end with today and a missing start with the first of the month', () => {
    const now = at('2026-10-20T12:00:00Z');
    expect(statementPeriod({ from: '2026-07-15' }, now)).toMatchObject({
      from: '2026-07-15',
      to: '2026-10-20',
    });
    expect(statementPeriod({ to: '2026-09-12' }, now)).toMatchObject({
      from: '2026-09-01',
      to: '2026-09-12',
    });
  });

  it('refuses a start after the end, an end after today, and a day that does not exist', () => {
    const now = at('2026-10-20T12:00:00Z');
    expect(() => statementPeriod({ from: '2026-10-10', to: '2026-10-01' }, now)).toThrow(
      CrmValidationError
    );
    expect(() => statementPeriod({ to: '2026-10-21' }, now)).toThrow('cannot be after today');
    expect(() => statementPeriod({ from: '2026-02-30', to: '2026-03-01' }, now)).toThrow(
      'not a date'
    );
    expect(parseStatementDay('20266-09-01')).toBeNull();
  });
});

describe('payment terms in words', () => {
  it('reads the stored code as a sentence a buyer understands', () => {
    expect(paymentTermsWords('net30')).toBe('Pay within 30 days');
    expect(paymentTermsWords('NET1')).toBe('Pay within 1 day');
    expect(paymentTermsWords('prepay')).toBe('Pay before it ships');
    expect(paymentTermsWords(null)).toBeNull();
    expect(paymentTermsWords('whenever')).toBeNull();
  });
});
