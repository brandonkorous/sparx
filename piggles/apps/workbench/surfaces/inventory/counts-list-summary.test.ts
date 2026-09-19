import { describe, expect, it } from 'vitest';
import {
  anyUnpriced,
  differenceLabel,
  differenceSentence,
  summaryLine,
} from './counts-list-summary';
import type { CountRow } from './counts-data';

/**
 * "62 ITEMS - EVERYTHING MATCHED, NOTHING TO CORRECT", OVER 372 MOVED GARMENTS.
 *
 * `varianceValueCents` is the sum of |counted - expected| x unit cost. A cost
 * price is optional and nothing ever asks for one, so a shop that has never
 * entered one gets zero out of that sum however much stock moved. A list that
 * branches on the money therefore cannot tell "we checked and it all matched"
 * apart from "we corrected 372 garments and cannot price them", and it picked
 * the reassuring one.
 *
 * Measured: 6 stock counts in the database, every one of them at
 * `variance_value_cents = 0`. Two of those moved units (372 and 2) and three
 * were discarded without applying anything.
 */
function count(over: Partial<CountRow>): CountRow {
  return {
    id: 'c1',
    number: 'CNT-000001',
    status: 'posted',
    lineCount: 62,
    countedLineCount: 62,
    varianceValueCents: 0,
    varianceUnits: 0,
    ...over,
  } as CountRow;
}

describe('summaryLine', () => {
  it('does not say everything matched over a count that moved stock', () => {
    // The whole failure, stated as a rule.
    const line = summaryLine(count({ status: 'posted', varianceUnits: 372 }));
    expect(line).not.toContain('everything matched');
    expect(line).toContain('372 units corrected');
    expect(line).toContain('no cost recorded');
  });

  it('still says everything matched when nothing actually moved', () => {
    expect(summaryLine(count({ status: 'posted', varianceUnits: 0 }))).toContain(
      'everything matched, nothing to correct'
    );
  });

  it('reports real money when there is real money to report', () => {
    const line = summaryLine(
      count({ status: 'posted', varianceUnits: 8, varianceValueCents: 4200 })
    );
    expect(line).toContain('$42.00 of corrections applied');
  });

  it('reads units before money while a count is waiting to be applied', () => {
    const line = summaryLine(count({ status: 'review', varianceUnits: 372 }));
    expect(line).not.toContain('everything matched');
    expect(line).toContain('372 units different');
  });
});

describe('differenceLabel', () => {
  it('shows a dash, not $0.00, for a count that was never applied', () => {
    // "$0.00" on a discarded count claims a check that never happened.
    expect(differenceLabel(count({ status: 'cancelled', varianceUnits: 372 }))).toBe('—');
    expect(differenceLabel(count({ status: 'counting', varianceUnits: 0 }))).toBe('—');
  });

  it('says so rather than printing a confident zero', () => {
    expect(differenceLabel(count({ status: 'posted', varianceUnits: 372 }))).toBe('No cost yet');
  });

  it('prints the money when the money is real', () => {
    expect(
      differenceLabel(count({ status: 'posted', varianceUnits: 8, varianceValueCents: 4200 }))
    ).toBe('$42.00');
  });

  it('prints a genuine zero when nothing moved', () => {
    expect(differenceLabel(count({ status: 'posted', varianceUnits: 0 }))).toBe('$0.00');
  });
});

describe('differenceSentence', () => {
  it('is the same fact the column carries, for the narrow layout', () => {
    // The Difference column is hidden below @xl, so this sentence is the ONLY
    // place the fact appears in the layout a shop owner works in.
    expect(differenceSentence(count({ varianceUnits: 372 }))).toContain('no cost recorded');
  });
});

describe('anyUnpriced', () => {
  it('is true only when a count moved stock it cannot value', () => {
    expect(anyUnpriced([count({ varianceUnits: 0 })])).toBe(false);
    expect(anyUnpriced([count({ varianceUnits: 8, varianceValueCents: 4200 })])).toBe(false);
    expect(anyUnpriced([count({ varianceUnits: 0 }), count({ varianceUnits: 372 })])).toBe(true);
  });

  it('does not raise the notice for a count that applied nothing', () => {
    // The column shows a dash for these two. A banner above the table saying
    // they "moved real stock" would be two screens telling a shop owner
    // opposite things about the same row.
    expect(anyUnpriced([count({ status: 'cancelled', varianceUnits: 372 })])).toBe(false);
    expect(anyUnpriced([count({ status: 'counting', varianceUnits: 372 })])).toBe(false);
  });
});
