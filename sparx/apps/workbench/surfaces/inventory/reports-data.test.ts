// Whether the stock report may print a money figure at all.
//
// The server turns every missing cost into a zero before it sums, so the total
// cannot tell "nothing costed" from "no stock" from "costed at nothing", and a
// PARTLY costed shop gets a figure that looks complete while it is short by
// exactly the stock nobody costed. `uncostedUnits` is the only honest witness,
// and these pin that `costCoverage` reads it rather than the total.

import { describe, expect, it } from 'vitest';

import { costCoverage } from './reports-data';

describe('costCoverage', () => {
  it('says nothing is costed when every unit held is uncosted', () => {
    expect(costCoverage({ totalUnits: 372, uncostedUnits: 372 })).toEqual({
      none: true,
      partial: false,
      uncostedUnits: 372,
    });
  });

  it('says the figure is short when only some of it is costed', () => {
    const cover = costCoverage({ totalUnits: 400, uncostedUnits: 28 });
    expect(cover.none).toBe(false);
    expect(cover.partial).toBe(true);
    expect(cover.uncostedUnits).toBe(28);
  });

  it('does not call stock deliberately costed at nothing "uncosted"', () => {
    // Free samples: a $0.00 total with every unit costed. Reading the zero
    // total instead of the count would tell this owner she never recorded costs.
    expect(costCoverage({ totalUnits: 50, uncostedUnits: 0 })).toEqual({
      none: false,
      partial: false,
      uncostedUnits: 0,
    });
  });

  it('says nothing about an empty shop', () => {
    const cover = costCoverage({ totalUnits: 0, uncostedUnits: 0 });
    expect(cover.none || cover.partial).toBe(false);
  });
});
