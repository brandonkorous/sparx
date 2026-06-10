import { describe, expect, it } from 'vitest';

import { computeNewPrice } from './bulk-price-service';

// The pricing math is the part most likely to be subtly wrong (rounding, sign,
// the never-negative floor), so it's unit-tested directly. Apply/revert/RLS are
// covered by the api-rest integration suite (bulk-price.test.ts).

describe('computeNewPrice', () => {
  it('raises by a percentage', () => {
    expect(computeNewPrice(1000, { mode: 'percent', percent: 10 })).toBe(1100);
    expect(computeNewPrice(2500, { mode: 'percent', percent: 20 })).toBe(3000);
  });

  it('lowers by a percentage', () => {
    expect(computeNewPrice(1000, { mode: 'percent', percent: -10 })).toBe(900);
    expect(computeNewPrice(2000, { mode: 'percent', percent: -25 })).toBe(1500);
  });

  it('rounds to the nearest cent', () => {
    // 999 * 1.1 = 1098.9 → 1099
    expect(computeNewPrice(999, { mode: 'percent', percent: 10 })).toBe(1099);
    // 1000 * 0.925 = 925 exactly
    expect(computeNewPrice(1000, { mode: 'percent', percent: -7.5 })).toBe(925);
  });

  it('never produces a negative price (percent floor at -100%)', () => {
    expect(computeNewPrice(1000, { mode: 'percent', percent: -100 })).toBe(0);
  });

  it('adds / subtracts a fixed amount in cents', () => {
    expect(computeNewPrice(1000, { mode: 'fixed', amountCents: 500 })).toBe(1500);
    expect(computeNewPrice(1000, { mode: 'fixed', amountCents: -500 })).toBe(500);
  });

  it('floors a fixed decrease at zero rather than going negative', () => {
    expect(computeNewPrice(1000, { mode: 'fixed', amountCents: -2500 })).toBe(0);
  });

  it('sets an exact price regardless of the current value', () => {
    expect(computeNewPrice(1000, { mode: 'set', priceCents: 1999 })).toBe(1999);
    expect(computeNewPrice(5000, { mode: 'set', priceCents: 0 })).toBe(0);
  });
});
