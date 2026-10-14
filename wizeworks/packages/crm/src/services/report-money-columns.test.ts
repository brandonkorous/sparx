// A report column that adds up money says so (sparx persona issue 251).
//
// A result column carried only its key and label, so the screen could not tell
// "Total value" from "Deals" and printed $61,250.50 as "61250.50".

import { describe, expect, it } from 'vitest';

import { compileReport } from './report-compiler';

const base = {
  objectKey: 'deal',
  filters: { logic: 'AND' as const, conditions: [] },
  dateRange: { kind: 'all' as const },
};

describe('the columns of a report', () => {
  it('mark a sum of money as money and a count as a number', () => {
    const compiled = compileReport(
      {
        ...base,
        groupBy: { field: 'stageId' },
        measures: [
          { fn: 'count' },
          { fn: 'sum', field: 'value' },
          { fn: 'avg', field: 'probability' },
        ],
      },
      10
    );
    expect(compiled.columns.map((c) => c.kind)).toEqual([
      undefined,
      'number',
      'currency',
      'number',
    ]);
  });
});
