// A COLUMN OF DASHES WITH NOTHING SAYING WHY.
//
// "Cost to keep" is one of the most careful screens in the console. It counts
// the stock levels with no cost price and says so out loud, above the figures:
//
//     68 items have no cost price
//     They are left out of everything on this screen, so what your stock is
//     really worth (and what it really costs to keep) is higher than these
//     figures say.
//
// The table underneath then has a **Cover** column, which is a dash on almost
// every row, and nothing anywhere explains it. Cover needs
// `inventory_demand_velocity.forecast_per_day`, which only exists once an item
// has actually sold. Measured: of 600 stocked levels on the platform, **13 have
// a positive forecast**, and they belong to two businesses. Six of the eight
// shops with stock have not one row that can show a cover figure.
//
// So the same screen explains one absent measure beautifully and is silent about
// the other sitting two columns to its right, which reads as a broken column
// rather than as a thing that needs sales history first.
//
// Counted from the rows already on screen rather than from a new field on the
// response: the answer is in the component's hand, and a count taken anywhere
// else could disagree with what the reader is looking at.

export interface CoverRow {
  daysOfCover: number | null;
}

/**
 * The sentence under the table, or null when every row can show a cover figure
 * and there is nothing to explain.
 */
export function coverNote(rows: CoverRow[]): string | null {
  if (rows.length === 0) return null;

  const missing = rows.filter((row) => row.daysOfCover === null).length;
  if (missing === 0) return null;

  const why =
    'Cover is how long the stock would last at the rate it has been selling, so an item needs ' +
    'some sales behind it before there is anything to work it out from.';

  if (missing === rows.length) {
    return `None of these has a cover figure yet. ${why}`;
  }

  if (missing === 1) {
    return `One of these has no cover figure. ${why}`;
  }

  return `${String(missing)} of these have no cover figure. ${why}`;
}
