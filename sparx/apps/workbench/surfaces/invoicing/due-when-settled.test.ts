// A paid invoice is not late (persona issue 283): 4459, paid to $0.00, sat in the
// invoice list as "15 days late" in red, beside its own "Paid" badge.

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { describeDue } from './types';

const DUE = '2026-09-29T18:00:00.000Z';

// "Late" is counted from today, so the test fixes today: Oct 14, 2026, midday in
// Denver, 15 days after the due date. It read the real clock and went red two days
// later ("17 days late").
beforeAll(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-10-14T18:00:00.000Z'));
});
afterAll(() => {
  vi.useRealTimers();
});

describe('the Due column', () => {
  it('shows a settled invoice by its date, not as late', () => {
    const due = describeDue(DUE, 15, 'America/Denver', true);
    expect(due.label).not.toMatch(/late/);
    expect(due.tone).toBe('muted');
  });

  it('still counts an unpaid invoice late', () => {
    expect(describeDue(DUE, 15, 'America/Denver').label).toBe('15 days late');
  });
});
