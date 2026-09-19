import { describe, expect, it } from 'vitest';
import {
  looseJobCostCents,
  looseJobCostIsExact,
  unchargedJobCostLine,
  type SpendShape,
} from './uncharged-words';

/** Plain money, so these tests read the sentence and not Intl's output. */
const money = (cents: number): string => `$${(cents / 100).toFixed(2)}`;

function spend(over: Partial<SpendShape> = {}): SpendShape {
  return {
    costOfSaleCents: 30_870,
    laborCents: 0,
    operatingCents: 185_000,
    unallocatedCents: 215_870,
    ...over,
  };
}

describe('how much of the uncharged pile is job cost', () => {
  it('is all of the job cost when nothing has been pinned to a job', () => {
    // Juniper Row: $308.70 of parts and $1,850.00 of rent, none of it charged.
    expect(looseJobCostCents(spend())).toBe(30_870);
    expect(looseJobCostIsExact(spend())).toBe(true);
  });

  it('is nothing when the uncharged pile is all overhead', () => {
    // Every penny of parts already charged to a job; only the rent is loose.
    const f = spend({ unallocatedCents: 185_000 });
    expect(looseJobCostCents(f)).toBe(0);
  });

  it('is a floor when some spend has been pinned, never an overstatement', () => {
    // $2,158.70 of spend, $1,000.00 pinned somewhere, $1,158.70 loose. Even if
    // every pinned cent came out of the parts pile, $308.70 - $1,000.00 is
    // below zero, so nothing about the parts can be proved.
    const f = spend({ unallocatedCents: 115_870 });
    expect(looseJobCostCents(f)).toBe(0);

    // Pin only $100: at least $208.70 of the parts is still loose.
    const g = spend({ unallocatedCents: 205_870 });
    expect(looseJobCostCents(g)).toBe(20_870);
    expect(looseJobCostIsExact(g)).toBe(false);
  });

  it('never claims more job cost is loose than exists', () => {
    const f = spend({ costOfSaleCents: 5_000, unallocatedCents: 999_999 });
    expect(looseJobCostCents(f)).toBe(5_000);
  });
});

describe('the sentence', () => {
  it('names the amount plainly when nothing has been charged', () => {
    expect(unchargedJobCostLine(spend(), money)).toBe(
      '$308.70 of that is parts, materials or subcontractors, which usually does belong to a job.'
    );
  });

  it('says "at least" when it can only prove a floor', () => {
    const line = unchargedJobCostLine(spend({ unallocatedCents: 205_870 }), money);
    expect(line).toBe(
      'At least $208.70 of that is parts, materials or subcontractors, which usually does belong to a job.'
    );
  });

  it('reads differently in the two cases rather than hedging both', () => {
    // A floor and an exact figure are different claims. Printing "at least" over
    // a number that is exact teaches a reader to distrust the exact ones.
    const exact = unchargedJobCostLine(spend(), money) ?? '';
    const floor = unchargedJobCostLine(spend({ unallocatedCents: 205_870 }), money) ?? '';
    expect(exact.replace(/[\d.,]+/g, 'N')).not.toBe(floor.replace(/[\d.,]+/g, 'N'));
  });

  it('says nothing at all when the uncharged pile is all overhead', () => {
    // Otherwise a shop whose only loose cost is rent reads "$0.00 of that is
    // parts" on the screen every month.
    expect(unchargedJobCostLine(spend({ unallocatedCents: 185_000 }), money)).toBeNull();
  });
});
