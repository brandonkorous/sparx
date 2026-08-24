// Plumbing every reports file needs: the column shape, number formatting, the
// row-open contract, and the one visual the pane draws.

import type { OpenTarget } from '../../lib/surfaces/registry';

export const COLUMN = 'mx-auto flex w-full max-w-5xl flex-col gap-4';
export const NUMBER = new Intl.NumberFormat();

/** Same modifier contract as every list — a dead-stock line opens that item's
 *  stock, alongside on shift, in a new window on alt. */
export function targetFor(event: { shiftKey: boolean; altKey: boolean }): OpenTarget {
  if (event.altKey) return 'window';
  if (event.shiftKey) return 'beside';
  return 'tab';
}

/**
 * A proportion as one of a fixed set of width classes.
 *
 * Quantised to 5% steps so every width is a LITERAL Tailwind class the compiler
 * can see — an inline `style={{ width }}` is banned, and on a bar this short a
 * 5% step is a couple of pixels, below the threshold of noticing.
 */
const BAR_WIDTH = [
  'w-px',
  'w-[5%]',
  'w-[10%]',
  'w-[15%]',
  'w-[20%]',
  'w-[25%]',
  'w-[30%]',
  'w-[35%]',
  'w-[40%]',
  'w-[45%]',
  'w-[50%]',
  'w-[55%]',
  'w-[60%]',
  'w-[65%]',
  'w-[70%]',
  'w-[75%]',
  'w-[80%]',
  'w-[85%]',
  'w-[90%]',
  'w-[95%]',
  'w-full',
];

export function barWidthClass(fraction: number): string {
  if (!Number.isFinite(fraction) || fraction <= 0) return BAR_WIDTH[0]!;
  const step = Math.round(Math.min(1, fraction) * 20);
  return BAR_WIDTH[step] ?? BAR_WIDTH[BAR_WIDTH.length - 1]!;
}

/**
 * How much of a valuation nobody has costed.
 *
 * Cost is optional and the product form never asks for it, so a shop can hold
 * 372 garments whose total value works out to $0.00 — which reads exactly like
 * a shop holding nothing.
 *
 * `uncostedUnits` comes from the server, which is the only place that can count
 * it: from the browser a total of zero could mean "no costs" or "no stock", and
 * a PARTLY costed shop — nine items in ten priced — is invisible from the total
 * alone, because its figure looks like a complete answer.
 */
export interface CostCoverage {
  /** Nothing at all is costed: the figure is not a valuation. */
  none: boolean;
  /** Some of it is costed and some is not: the figure is real but short. */
  partial: boolean;
  uncostedUnits: number;
}

export function costCoverage(valuation: {
  totalUnits: number;
  totalCostCents: number;
  uncostedUnits: number;
}): CostCoverage {
  const { totalUnits, totalCostCents, uncostedUnits } = valuation;
  return {
    none: totalUnits > 0 && totalCostCents === 0,
    partial: uncostedUnits > 0 && totalCostCents > 0,
    uncostedUnits,
  };
}
