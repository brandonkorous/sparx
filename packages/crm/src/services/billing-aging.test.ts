// AR aging bucketing (docs/87 §8) — pure, DB-free.

import { describe, it, expect } from 'vitest';

import { bucketAging, type AgingInputRow } from './billing-ar';

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
