import { describe, expect, it } from 'vitest';
import { parseMoneyToCents } from './spend-data';

/**
 * The cost form's own reading of an amount.
 *
 * It had a parser of its own that threw every comma away before looking, so
 * "46,80" was read as four thousand six hundred and eighty dollars and a $46.80
 * cost went into the books as $4,680.00 (issue 488). It now asks `readMoney`,
 * which decides which of `.` and `,` is separating the cents in the text in
 * front of it. Putting `.replace(/[,\s]/g, '')` back reddens the first two.
 */
describe('parseMoneyToCents', () => {
  it('reads a comma as the cents when two digits follow it', () => {
    expect(parseMoneyToCents('46,80')).toBe(4680);
  });

  it('still reads a comma as a thousands group when three digits follow it', () => {
    expect(parseMoneyToCents('1,250')).toBe(125_000);
    expect(parseMoneyToCents('1,250.00')).toBe(125_000);
  });

  it('keeps the exact arithmetic a third decimal needs', () => {
    expect(parseMoneyToCents('0.145')).toBe(15);
  });

  it('reads the plain spelling, a typed currency mark, and stray spaces', () => {
    expect(parseMoneyToCents('8.50')).toBe(850);
    expect(parseMoneyToCents('$8.00')).toBe(800);
    expect(parseMoneyToCents(' 8.00 ')).toBe(800);
  });

  it('is null for an empty field and for text that is not an amount', () => {
    expect(parseMoneyToCents('')).toBeNull();
    expect(parseMoneyToCents('   ')).toBeNull();
    expect(parseMoneyToCents('about fifty')).toBeNull();
  });

  it('is zero for a zero, which is a real answer on a cost', () => {
    expect(parseMoneyToCents('0')).toBe(0);
  });
});
