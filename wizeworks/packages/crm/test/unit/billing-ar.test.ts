// AR derivation (docs/87 §8): the payment-derived status machine, payment
// aggregation, and net-terms parsing — all pure.

import { describe, expect, it } from 'vitest';

import {
  aggregatePayments,
  deriveDocumentStatus,
  netTermsDays,
} from '../../src/services/billing-ar';

const NOW = new Date('2026-06-15T00:00:00.000Z');
const PAST = new Date('2026-06-01T00:00:00.000Z');
const FUTURE = new Date('2026-07-01T00:00:00.000Z');

describe('deriveDocumentStatus', () => {
  it('is unpaid when nothing is paid and not past due', () => {
    expect(
      deriveDocumentStatus({ total: 100, amountPaid: 0, dueAt: null, voided: false, now: NOW })
    ).toBe('unpaid');
    expect(
      deriveDocumentStatus({ total: 100, amountPaid: 0, dueAt: FUTURE, voided: false, now: NOW })
    ).toBe('unpaid');
  });

  it('is partial when some but not all is paid', () => {
    expect(
      deriveDocumentStatus({ total: 100, amountPaid: 40, dueAt: null, voided: false, now: NOW })
    ).toBe('partial');
  });

  it('is paid when fully covered, and never overdue once paid', () => {
    expect(
      deriveDocumentStatus({ total: 100, amountPaid: 100, dueAt: PAST, voided: false, now: NOW })
    ).toBe('paid');
    expect(
      deriveDocumentStatus({ total: 100, amountPaid: 120, dueAt: PAST, voided: false, now: NOW })
    ).toBe('paid');
  });

  it('is overdue when a balance remains past the due date', () => {
    expect(
      deriveDocumentStatus({ total: 100, amountPaid: 0, dueAt: PAST, voided: false, now: NOW })
    ).toBe('overdue');
    expect(
      deriveDocumentStatus({ total: 100, amountPaid: 40, dueAt: PAST, voided: false, now: NOW })
    ).toBe('overdue');
  });

  it('void dominates every other state', () => {
    expect(
      deriveDocumentStatus({ total: 100, amountPaid: 100, dueAt: PAST, voided: true, now: NOW })
    ).toBe('void');
  });

  it('treats a $0 document past due as unpaid, not overdue', () => {
    expect(
      deriveDocumentStatus({ total: 0, amountPaid: 0, dueAt: PAST, voided: false, now: NOW })
    ).toBe('unpaid');
  });
});

describe('aggregatePayments', () => {
  it('sums payments + deposits and subtracts refunds', () => {
    const r = aggregatePayments([
      { kind: 'deposit', amount: 50 },
      { kind: 'payment', amount: 30 },
      { kind: 'refund', amount: 10 },
    ]);
    expect(r).toEqual({ amountPaid: 70, depositTotal: 50 });
  });

  it('is zero across the board for no rows', () => {
    expect(aggregatePayments([])).toEqual({ amountPaid: 0, depositTotal: 0 });
  });
});

describe('netTermsDays', () => {
  it('parses net-N terms in various spellings', () => {
    expect(netTermsDays('net30')).toBe(30);
    expect(netTermsDays('net 15')).toBe(15);
    expect(netTermsDays('Net-45')).toBe(45);
  });

  it('returns 0 for due-on-receipt / empty / unknown', () => {
    expect(netTermsDays(null)).toBe(0);
    expect(netTermsDays('due on receipt')).toBe(0);
    expect(netTermsDays('')).toBe(0);
  });
});
