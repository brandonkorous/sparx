import { describe, expect, it } from 'vitest';
import { readMoney } from './read-money';

/**
 * WHY THIS FILE EXISTS.
 *
 * A money field is the one place in a console where being nearly right is the
 * same as being wrong. Two separate parsers were reading the amounts people
 * type, and each had half the answer:
 *
 *   • `read-money` knew WHICH of `.` and `,` separated the cents, and then did
 *     `Math.round(Number(x) * 100)` — which reads three decimals low, because
 *     `Number('0.145') * 100` is 14.499999999999998.
 *   • the spending form's own parser did the arithmetic exactly, on a string it
 *     had already stripped every comma out of — so "46,80" became four thousand
 *     six hundred and eighty dollars, and a $46.80 cost was written to the books
 *     as $4,680.00 with no complaint (issue 488).
 *
 * There is now one parser with both halves, and these are the cases that put it
 * there. Removing `exactCents` reddens "a third decimal rounds up"; putting the
 * comma-stripping back reddens "a comma is the cents".
 */
describe('readMoney', () => {
  const cents = (text: string) => {
    const { amount } = readMoney(text, { allowZero: true });
    return amount === null ? null : Math.round(amount * 100);
  };

  it('reads the one spelling everybody agrees on', () => {
    expect(cents('8.50')).toBe(850);
  });

  it('reads a comma as the cents when two digits follow it', () => {
    expect(cents('46,80')).toBe(4680);
    expect(cents('8,50')).toBe(850);
  });

  it('reads a comma as a thousands group when three digits follow it', () => {
    expect(cents('1,250')).toBe(125_000);
  });

  it('reads both marks at once, whichever way round they come', () => {
    expect(cents('1,250.00')).toBe(125_000);
    expect(cents('1.250,00')).toBe(125_000);
  });

  it('ignores the currency somebody typed in front of it', () => {
    expect(cents('$8.00')).toBe(800);
    expect(cents(' 8.00 ')).toBe(800);
  });

  it('rounds a third decimal UP rather than down through a float', () => {
    // Math.round(Number('0.145') * 100) is 14. String arithmetic says 15.
    expect(cents('0.145')).toBe(15);
    expect(cents('1.005')).toBe(101);
  });

  it('refuses an amount less than nothing', () => {
    expect(readMoney('-5.00', { allowZero: true }).amount).toBeNull();
    expect(readMoney('-5.00', { allowZero: true }).problem).toBe(
      'An amount cannot be less than nothing.'
    );
  });

  it('refuses exponent form, which is a slip rather than a price', () => {
    expect(cents('1e9')).toBeNull();
  });

  it('says nothing about an empty field, because empty is not wrong', () => {
    expect(readMoney('').amount).toBeNull();
    expect(readMoney('').problem).toBeNull();
  });

  it('refuses zero unless the caller says nothing is a real answer', () => {
    expect(readMoney('0.00').amount).toBeNull();
    expect(readMoney('0.00', { allowZero: true }).amount).toBe(0);
  });
});
