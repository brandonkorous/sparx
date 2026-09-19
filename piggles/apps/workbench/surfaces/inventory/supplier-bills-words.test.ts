import { describe, expect, it } from 'vitest';

import { owedLine, totalCoversRows, type OwedShape } from './supplier-bills-words';

const money = (cents: number) =>
  `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** Juniper Row, exactly as the screen found it: three bills entered and one
 *  queried, all four unpaid. */
const JUNIPER: OwedShape = {
  outstandingCents: 68_400 + 3_600 + 22_272 + 68_400,
  outstandingCount: 4,
  queriedCents: 68_400,
  queriedCount: 1,
};

describe('owedLine', () => {
  it('counts every unpaid bill, not just the queried one', () => {
    expect(owedLine(JUNIPER, money)).toContain('$1,626.72 owed across 4 bills');
  });

  it('never reports the queried bill as if it were the whole debt', () => {
    // The exact sentence the screen used to print over those four rows.
    expect(owedLine(JUNIPER, money)).not.toBe('$684.00 owed across 1 bill');
    expect(owedLine(JUNIPER, money).startsWith('$684.00')).toBe(false);
  });

  it('names the queried part, and says it is part of the total', () => {
    const line = owedLine(JUNIPER, money);
    expect(line).toContain('$684.00 of that is queried with the supplier');
  });

  it('says nothing about queries when there are none', () => {
    const clean: OwedShape = { ...JUNIPER, queriedCents: 0, queriedCount: 0 };
    expect(owedLine(clean, money)).toBe('$1,626.72 owed across 4 bills');
    expect(owedLine(clean, money)).not.toContain('queried');
  });

  it('reads right for one bill', () => {
    expect(
      owedLine(
        { outstandingCents: 3_600, outstandingCount: 1, queriedCents: 0, queriedCount: 0 },
        money
      )
    ).toBe('$36.00 owed across 1 bill');
  });

  it('says nothing owed only when nothing is', () => {
    expect(
      owedLine(
        { outstandingCents: 0, outstandingCount: 0, queriedCents: 0, queriedCount: 0 },
        money
      )
    ).toBe('Nothing owed');
  });

  it('does not call it nothing owed just because the money is zero', () => {
    // A bill entered at zero is still a bill, and "Nothing owed" over a row is
    // the same class of lie as the one this file exists for.
    const zeroValue: OwedShape = {
      outstandingCents: 0,
      outstandingCount: 1,
      queriedCents: 0,
      queriedCount: 0,
    };
    expect(owedLine(zeroValue, money)).toBe('$0.00 owed across 1 bill');
  });
});

describe('totalCoversRows', () => {
  it('holds for the shop-wide total against any filtered view', () => {
    expect(totalCoversRows(JUNIPER, 4)).toBe(true);
    expect(totalCoversRows(JUNIPER, 1)).toBe(true);
  });

  it('is what the old heading broke', () => {
    // 1 bill counted, 4 on screen.
    const old: OwedShape = { ...JUNIPER, outstandingCount: 1, outstandingCents: 68_400 };
    expect(totalCoversRows(old, 4)).toBe(false);
  });
});
