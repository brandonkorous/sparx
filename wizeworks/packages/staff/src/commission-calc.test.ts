// The commission arithmetic — the two places a wrong answer becomes somebody's
// pay rather than a cosmetic bug.
//
// Pure, so it runs everywhere: `decimalToCents` bridges the order tables' major
// units to the integer cents every other money path uses, and
// `refundAdjustedBasis` decides how much of a partly-refunded sale still counts.

import { describe, expect, it } from 'vitest';

import { decimalToCents, refundAdjustedBasis } from './commission-calc.js';
import { commissionCents } from './commissions.js';

/** A stand-in for Prisma's Decimal, which is only ever read via toString(). */
const dec = (s: string) => ({ toString: () => s });

describe('decimalToCents', () => {
  it('converts major units exactly, where a float multiply does not', () => {
    // `Number('123.45') * 100` is 12344.999999999998. That is the entire reason
    // this function exists rather than a multiply at each call site.
    expect(decimalToCents(dec('123.45'))).toBe(12_345);
    expect(decimalToCents(dec('0.07'))).toBe(7);
    expect(decimalToCents(dec('1.10'))).toBe(110);
    expect(decimalToCents(dec('8.20'))).toBe(820);
  });

  it('handles whole numbers, a bare zero, and a single decimal place', () => {
    expect(decimalToCents(dec('40'))).toBe(4_000);
    expect(decimalToCents(dec('0'))).toBe(0);
    expect(decimalToCents(dec('0.00'))).toBe(0);
    expect(decimalToCents(dec('12.5'))).toBe(1_250);
  });

  it('keeps a negative negative — a refund column is not an absolute value', () => {
    expect(decimalToCents(dec('-25.30'))).toBe(-2_530);
  });

  it('survives a large order without losing precision', () => {
    expect(decimalToCents(dec('1999999.99'))).toBe(199_999_999);
  });
});

describe('refundAdjustedBasis', () => {
  it('leaves an unrefunded sale alone', () => {
    expect(refundAdjustedBasis(10_000, 12_000, 0)).toBe(10_000);
  });

  it('halves the basis on a half refund', () => {
    expect(refundAdjustedBasis(10_000, 12_000, 6_000)).toBe(5_000);
  });

  it('pays nothing on a full refund', () => {
    // The case that matters most: a fully refunded order must not leave a
    // commission standing against money the business gave back.
    expect(refundAdjustedBasis(10_000, 12_000, 12_000)).toBe(0);
    expect(refundAdjustedBasis(10_000, 12_000, 99_999)).toBe(0);
  });

  it('is proportional to the ORDER TOTAL, not to the commissionable slice', () => {
    // Basis excludes tax and shipping, but a refund of the shipping charge is
    // still money returned. Measuring the refund against the total is what stops
    // "the refund happened to land outside the slice" from overpaying.
    const basis = 10_000; // subtotal less discount
    const total = 12_500; // plus tax + shipping
    expect(refundAdjustedBasis(basis, total, 2_500)).toBe(8_000);
  });

  it('never returns a negative, whatever it is handed', () => {
    expect(refundAdjustedBasis(-500, 12_000, 0)).toBe(0);
    expect(refundAdjustedBasis(10_000, 0, 5_000)).toBe(10_000);
    expect(refundAdjustedBasis(0, 0, 0)).toBe(0);
  });
});

describe('the two composed — what someone is actually paid', () => {
  it('7.5% of a $400 sale is $30.00', () => {
    const basis = decimalToCents(dec('400.00'));
    expect(commissionCents(basis, 7.5)).toBe(3_000);
  });

  it('and half of it after a half refund', () => {
    const basis = refundAdjustedBasis(
      decimalToCents(dec('400.00')),
      decimalToCents(dec('440.00')),
      decimalToCents(dec('220.00'))
    );
    expect(commissionCents(basis, 7.5)).toBe(1_500);
  });

  it('rounds once, at the end, to a whole cent', () => {
    // $99.99 at 3.333% is 333.2667 cents. It must land on a cent by a rule
    // somebody chose, not on whatever a binary float happened to produce.
    expect(commissionCents(decimalToCents(dec('99.99')), 3.333)).toBe(333);
  });

  it('earns nothing from a zero or negative basis', () => {
    expect(commissionCents(0, 7.5)).toBe(0);
    expect(commissionCents(-1_000, 7.5)).toBe(0);
  });
});
