// The profit arithmetic and the allocation guard — the two places where getting
// a sign or a boundary wrong produces a confidently wrong number on screen.

import { describe, expect, it } from 'vitest';

import { assertAllocationsFit, unallocatedCents } from './expenses';
import { OverAllocatedError } from './errors';
import { computeProfit, utcDayRange, utcMidnight } from './rollup';

const inputs = {
  revenueCents: 0,
  cogsCents: 0,
  feeCents: 0,
  costOfSaleCents: 0,
  laborCents: 0,
  operatingCents: 0,
  unallocatedCents: 0,
};

describe('computeProfit', () => {
  it('takes goods, fees and cost-of-sale off the gross line', () => {
    const result = computeProfit({
      ...inputs,
      revenueCents: 100_00,
      cogsCents: 30_00,
      feeCents: 5_00,
      costOfSaleCents: 15_00,
    });
    expect(result.grossProfitCents).toBe(50_00);
    // Nothing below the line yet, so net matches gross.
    expect(result.netProfitCents).toBe(50_00);
  });

  it('takes labour and operating off the net line only', () => {
    const result = computeProfit({
      ...inputs,
      revenueCents: 100_00,
      laborCents: 40_00,
      operatingCents: 25_00,
    });
    expect(result.grossProfitCents).toBe(100_00);
    expect(result.netProfitCents).toBe(35_00);
  });

  it('reports a real loss rather than clamping at zero', () => {
    // A bad month has to read as negative. Flooring at zero here is how an owner
    // finds out in April that they were losing money in January.
    const result = computeProfit({
      ...inputs,
      revenueCents: 10_00,
      cogsCents: 8_00,
      laborCents: 20_00,
    });
    expect(result.grossProfitCents).toBe(2_00);
    expect(result.netProfitCents).toBe(-18_00);
  });

  it('credits back a reversal, because consumed cost is signed', () => {
    // A cancelled order restocks and carries a NEGATIVE cost_consumed_cents, so
    // summing the column over a period needs no special case for refunds.
    const result = computeProfit({ ...inputs, revenueCents: 0, cogsCents: -30_00 });
    expect(result.grossProfitCents).toBe(30_00);
  });

  it('passes unallocated spend through without double-subtracting it', () => {
    // Overhead is already inside the three slices; it is reported separately so
    // "what does it cost to keep the doors open" is answerable, not subtracted twice.
    const result = computeProfit({
      ...inputs,
      revenueCents: 100_00,
      operatingCents: 20_00,
      unallocatedCents: 20_00,
    });
    expect(result.netProfitCents).toBe(80_00);
    expect(result.unallocatedCents).toBe(20_00);
  });
});

describe('utcDayRange', () => {
  it('is half-open, so a movement at midnight belongs to exactly one day', () => {
    const { start, end } = utcDayRange(new Date('2027-03-04T17:42:11.000Z'));
    expect(start.toISOString()).toBe('2027-03-04T00:00:00.000Z');
    expect(end.toISOString()).toBe('2027-03-05T00:00:00.000Z');
  });

  it('ignores the local clock', () => {
    expect(utcMidnight(new Date('2027-03-04T23:59:59.999Z')).toISOString()).toBe(
      '2027-03-04T00:00:00.000Z'
    );
  });
});

describe('assertAllocationsFit', () => {
  const at = (amountCents: number) => ({
    targetType: 'order' as const,
    targetId: '00000000-0000-0000-0000-000000000001',
    targetLabel: null,
    amountCents,
  });

  it('allows splitting less than the total — the rest is overhead', () => {
    expect(() => assertAllocationsFit(100_00, [at(30_00), at(20_00)])).not.toThrow();
  });

  it('allows splitting the whole thing', () => {
    expect(() => assertAllocationsFit(100_00, [at(100_00)])).not.toThrow();
  });

  it('refuses to charge jobs for money nobody spent', () => {
    expect(() => assertAllocationsFit(100_00, [at(60_00), at(60_00)])).toThrow(OverAllocatedError);
  });

  it('compares on magnitude, so a vendor credit splits like a bill', () => {
    expect(() => assertAllocationsFit(-100_00, [at(-60_00)])).not.toThrow();
    expect(() => assertAllocationsFit(-100_00, [at(-120_00)])).toThrow(OverAllocatedError);
  });

  it('says the amounts out loud, in money a person reads', () => {
    expect(() => assertAllocationsFit(100_00, [at(150_00)])).toThrow(/\$150\.00.*\$100\.00/);
  });
});

describe('unallocatedCents', () => {
  it('is the remainder left on the business rather than a job', () => {
    expect(unallocatedCents(100_00, [{ amountCents: 30_00 }])).toBe(70_00);
  });

  it('is the whole expense when nothing was pinned to a job', () => {
    expect(unallocatedCents(100_00, [])).toBe(100_00);
  });
});
