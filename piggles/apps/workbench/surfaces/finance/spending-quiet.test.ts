// Spending in a month with no costs, for a business that has some (issue 930).

import { describe, expect, it } from 'vitest';
import { periodHolding, quietPeriod } from './spending-quiet';

const oct6 = new Date(2026, 9, 6, 12);
const horn = {
  incurredAt: '2026-09-16T04:58:55.917Z',
  description: 'Horn buttons from the Saturday market',
  amountCents: 1250,
  currency: 'USD',
};

describe('a period with nothing in it', () => {
  it('names the period instead of saying nothing was ever recorded', () => {
    expect(quietPeriod('this_month', horn, oct6)?.title).toBe('Nothing recorded this month');
  });

  it('offers the shortest period that holds the last cost', () => {
    const quiet = quietPeriod('this_month', horn, oct6);
    expect(quiet?.show).toBe('last_month');
    expect(quiet?.showLabel).toBe('Show last month');
  });

  it('goes wider when the last cost is older', () => {
    expect(periodHolding('2026-02-03', 'this_month', oct6)).toBe('this_year');
    expect(periodHolding('2025-11-20', 'this_month', oct6)).toBe('last_12');
    expect(periodHolding('2024-01-01', 'this_month', oct6)).toBe('all');
  });

  it('never offers the period already showing', () => {
    expect(periodHolding('2026-09-16', 'last_month', oct6)).toBe('this_year');
  });

  it('keeps the first-run words for a business with no costs at all', () => {
    expect(quietPeriod('this_month', null, oct6)).toBeNull();
  });

  it('says no "yet" while the newest cost is still loading', () => {
    expect(quietPeriod('this_month', undefined, oct6)).toEqual({
      title: 'Nothing recorded this month',
      last: null,
      show: null,
      showLabel: null,
    });
  });
});
