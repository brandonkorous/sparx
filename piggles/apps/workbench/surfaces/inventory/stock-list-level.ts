// Which states of stock the list is narrowed to, and how that arrives from
// outside. Split from `stock-list-toolbar.tsx` so the deep link from Home can be
// TESTED against the count it names: that file is React, and the console's test
// seat is plain Node.

/**
 * Which states of stock the list is narrowed to.
 *
 * Three values rather than two booleans, because they are the answers to ONE
 * question and the server makes them mutually exclusive: "running low" is paired
 * with `sellable_only`, so a level at zero is `out` and never also `low`. Two
 * independent toggles would offer a both-on combination that means neither.
 */
export type StockLevelFilter = '' | 'low' | 'out';

/** A `level` arriving from outside — a deep link from Home, or a saved view
 *  written before this was a three-way choice. Anything unrecognised means
 *  "no narrowing", never a guess. */
export function parseLevel(raw: unknown): StockLevelFilter {
  if (raw === 'low' || raw === 'out') return raw;
  return '';
}
