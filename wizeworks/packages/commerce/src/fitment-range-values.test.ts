// A fit rule with no years fits every year (sparx persona issue 125).

import { describe, expect, it } from 'vitest';
import { EVERY_FITMENT_YEAR } from '@wizeworks/search';
import { fitmentRangeValues } from './search-projection';

describe('fitmentRangeValues', () => {
  it('marks a rule with no years as fitting every year', () => {
    expect(fitmentRangeValues([{ ranges: [] }])).toEqual([EVERY_FITMENT_YEAR]);
  });

  it('marks a window open at both ends the same way', () => {
    expect(fitmentRangeValues([{ ranges: [{ min: null, max: null }] }])).toEqual([
      EVERY_FITMENT_YEAR,
    ]);
  });

  it('lists the years of a closed window and nothing else', () => {
    expect(fitmentRangeValues([{ ranges: [{ min: 2019, max: 2021 }] }])).toEqual([
      2019, 2020, 2021,
    ]);
  });

  it('keeps both when one rule has years and another has none', () => {
    expect(
      fitmentRangeValues([{ ranges: [{ min: 2007, max: 2008 }] }, { ranges: [] }]).sort()
    ).toEqual([EVERY_FITMENT_YEAR, 2007, 2008].sort());
  });

  it('is empty for a product with no fit rules', () => {
    expect(fitmentRangeValues([])).toEqual([]);
  });
});
