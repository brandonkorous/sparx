// AR aging bucketing (docs/87 §8) — pure, DB-free.

import { describe, it, expect } from 'vitest';

import { bucketAging, daysPastDue, type AgingInputRow } from './billing-ar';

const NOW = new Date('2026-06-12T00:00:00.000Z');
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86_400_000);

describe('bucketAging', () => {
  it('places not-yet-due and no-due-date balances in current', () => {
    const rows: AgingInputRow[] = [
      { balance: 100, dueAt: daysAgo(-5) }, // due in the future
      { balance: 50, dueAt: null }, // pay-now retail, not on terms
      { balance: 25, dueAt: NOW }, // due exactly now → 0 days past
    ];
    const b = bucketAging(rows, NOW);
    expect(b.current).toEqual({ count: 3, balance: 175 });
    expect(b.d1_30.count).toBe(0);
  });

  it('buckets by days past due across the boundaries', () => {
    const rows: AgingInputRow[] = [
      { balance: 10, dueAt: daysAgo(1) }, // 1–30
      { balance: 20, dueAt: daysAgo(30) }, // 1–30 (inclusive)
      { balance: 30, dueAt: daysAgo(31) }, // 31–60
      { balance: 40, dueAt: daysAgo(60) }, // 31–60
      { balance: 50, dueAt: daysAgo(61) }, // 61–90
      { balance: 60, dueAt: daysAgo(90) }, // 61–90
      { balance: 70, dueAt: daysAgo(91) }, // 90+
      { balance: 80, dueAt: daysAgo(400) }, // 90+
    ];
    const b = bucketAging(rows, NOW);
    expect(b.d1_30).toEqual({ count: 2, balance: 30 });
    expect(b.d31_60).toEqual({ count: 2, balance: 70 });
    expect(b.d61_90).toEqual({ count: 2, balance: 110 });
    expect(b.d90_plus).toEqual({ count: 2, balance: 150 });
  });

  it('skips non-positive balances', () => {
    const rows: AgingInputRow[] = [
      { balance: 0, dueAt: daysAgo(45) },
      { balance: -10, dueAt: daysAgo(45) },
      { balance: 15, dueAt: daysAgo(45) },
    ];
    const b = bucketAging(rows, NOW);
    expect(b.d31_60).toEqual({ count: 1, balance: 15 });
  });

  it('rounds accumulated balances to cents', () => {
    const rows: AgingInputRow[] = [
      { balance: 10.1, dueAt: daysAgo(5) },
      { balance: 20.2, dueAt: daysAgo(5) },
    ];
    const b = bucketAging(rows, NOW);
    expect(b.d1_30.balance).toBe(30.3);
  });
});

// ── Due dates that are not midnight ────────────────────────────────────────
//
// Every case above uses a due date at exactly 00:00 UTC, which is why this file
// passed while the rule was wrong: at midnight, "elapsed 24-hour periods" and
// "calendar days apart" give the same answer for every input, so the buggy
// reader satisfied every assertion. Real invoices are raised at whatever hour
// somebody happened to raise them.
describe('daysPastDue counts calendar days, not elapsed 24-hour periods', () => {
  // 10:14 on the 9th — the moment a real shop's screen was read.
  const MORNING = new Date('2026-09-09T10:14:00.000Z');

  it('calls a bill due yesterday one day late, whatever hour it was due', () => {
    // Two invoices, both printed "Due Sep 8". The second was raised at noon, so
    // only 0.93 of a 24-hour period had passed: it read "Not yet due" on the same
    // screen as the first, which read "1 day late".
    expect(daysPastDue(new Date('2026-09-08T02:41:59.000Z'), MORNING)).toBe(1);
    expect(daysPastDue(new Date('2026-09-08T12:00:00.000Z'), MORNING)).toBe(1);
    expect(daysPastDue(new Date('2026-09-08T23:59:59.000Z'), MORNING)).toBe(1);
  });

  it('does not call a bill due TODAY late', () => {
    expect(daysPastDue(new Date('2026-09-09T00:00:00.000Z'), MORNING)).toBe(0);
    // Already past on the clock, still due today.
    expect(daysPastDue(new Date('2026-09-09T09:00:00.000Z'), MORNING)).toBe(0);
    expect(daysPastDue(new Date('2026-09-09T23:00:00.000Z'), MORNING)).toBe(0);
  });

  it('counts forward for a bill not due yet', () => {
    expect(daysPastDue(new Date('2026-09-10T01:00:00.000Z'), MORNING)).toBe(-1);
  });

  it('has no answer to give when no deadline was ever set', () => {
    expect(daysPastDue(null, MORNING)).toBe(0);
  });

  it('puts a noon-due bill in the late bucket, not in current', () => {
    // The screen that started this: $234.60 sat under "Not yet due" beside seven
    // invoices printed with the SAME due date under "1–30 days late".
    const b = bucketAging(
      [{ balance: 234.6, dueAt: new Date('2026-09-08T12:00:00.000Z') }],
      MORNING
    );
    expect(b.current).toEqual({ count: 0, balance: 0 });
    expect(b.d1_30).toEqual({ count: 1, balance: 234.6 });
  });
});
