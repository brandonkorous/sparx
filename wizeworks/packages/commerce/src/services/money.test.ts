// A money figure a person has to count digits in is not a money figure.

import { describe, expect, it } from 'vitest';
import { formatAmount, formatCents } from './money';

describe('formatCents', () => {
  it('groups the thousands', () => {
    // The whole reason this exists. Every trade account on the platform has a
    // credit limit of $10,000, $25,000 or $50,000, and all three were printed
    // without a separator.
    expect(formatCents(5_000_00)).toBe('$5,000.00');
    expect(formatCents(50_000_00)).toBe('$50,000.00');
    expect(formatCents(1_234_567_89)).toBe('$1,234,567.89');
  });

  it('still reads correctly under a thousand', () => {
    expect(formatCents(0)).toBe('$0.00');
    expect(formatCents(100_00)).toBe('$100.00');
    expect(formatCents(7_50)).toBe('$7.50');
  });

  it('keeps two decimal places', () => {
    expect(formatCents(5_00)).toBe('$5.00');
    expect(formatCents(5_10)).toBe('$5.10');
  });

  it('uses the currency it is given, not a dollar sign', () => {
    expect(formatCents(5_000_00, 'EUR')).toBe('€5,000.00');
    expect(formatCents(5_000_00, 'GBP')).toBe('£5,000.00');
    expect(formatCents(5_000_00, 'JPY')).not.toContain('$');
  });

  it('prints a number and the code rather than guessing, on a bad code', () => {
    // A wrong symbol on a figure reads as a fact. No symbol does not.
    const text = formatCents(5_000_00, 'not-a-currency');
    expect(text).toContain('5,000.00');
    expect(text).not.toContain('$');
    expect(text).toContain('NOT-A-CURRENCY');
  });

  it('handles negatives without losing the separator', () => {
    expect(formatCents(-50_000_00)).toBe('-$50,000.00');
  });
});

describe('formatAmount', () => {
  it('takes whole units, for the figures already stored that way', () => {
    // `company.creditLimit` is a Decimal in dollars, not cents.
    expect(formatAmount(50_000)).toBe('$50,000.00');
    expect(formatAmount(1_234.5)).toBe('$1,234.50');
  });
});
