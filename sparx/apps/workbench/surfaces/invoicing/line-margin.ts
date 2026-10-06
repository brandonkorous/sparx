// Margin on a quote or invoice, worked out as you price it (sparx persona issue 086).
//
// The /b2b page promises "Margin shows as you price, off the cost basis". It
// used to show only on a line priced by a markup rule, read from the server's
// snapshot, so it never moved while a price was typed and never appeared on a
// flat, labor or catalog line at all. This works it out from the numbers on
// the line, for every line that has a cost.
//
// The rule under everything here: a line with no cost is LEFT OUT, and said to
// be left out. It is never treated as costing $0, which would report a 100%
// margin on it and flatter the whole document.
//
// Cost and margin are the business's own figures. Nothing here is ever sent to
// a customer: the server's buyer-facing output is guarded by
// `buyer-output-has-no-cost.test.ts` in @wizeworks/crm.

import { isBlank, type DraftLine } from './totals';
import { formatMoney } from './types';

/** Below this share of the price, a margin is thin enough to look at twice.
 *  The same line the product Pricing tab draws. */
export const THIN_MARGIN_PCT = 15;

export type MarginTone = 'success' | 'warning' | 'danger';

export interface LineMargin {
  /** What the customer pays for the line, after its discount, before tax. */
  revenueCents: number;
  costCents: number;
  profitCents: number;
  /** Profit as a share of what they pay, to one decimal; null when they pay
   *  nothing, where a share of nothing means nothing. */
  marginPct: number | null;
  tone: MarginTone;
}

type Priced = Pick<
  DraftLine,
  'quantity' | 'unitPrice' | 'discountAmount' | 'explicitCostCents' | 'costCents'
>;

/** The line's cost per unit in cents: the one typed in the editor, else the one
 *  the server last stored. Null when nobody has given one. */
export function lineCostCents(
  line: Pick<DraftLine, 'explicitCostCents' | 'costCents'>
): number | null {
  return line.explicitCostCents ?? line.costCents ?? null;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function toneFor(profitCents: number, marginPct: number | null): MarginTone {
  if (profitCents < 0) return 'danger';
  if (marginPct !== null && marginPct < THIN_MARGIN_PCT) return 'warning';
  return 'success';
}

function marginOf(revenueCents: number, costCents: number): LineMargin {
  const profitCents = revenueCents - costCents;
  const marginPct = revenueCents > 0 ? round1((profitCents / revenueCents) * 100) : null;
  return { revenueCents, costCents, profitCents, marginPct, tone: toneFor(profitCents, marginPct) };
}

/** The margin on one line, or null when it has no cost (or nothing at all on it). */
export function lineMargin(line: Priced): LineMargin | null {
  const unitCost = lineCostCents(line);
  if (unitCost === null) return null;
  const revenueCents =
    Math.round(line.quantity * line.unitPrice * 100) - Math.round(line.discountAmount * 100);
  const costCents = Math.round(line.quantity * unitCost);
  if (revenueCents === 0 && costCents === 0) return null;
  return marginOf(revenueCents, costCents);
}

function percentText(pct: number): string {
  return `${String(pct)}%`;
}

/** The margin as an owner says it: "31.3% margin, $187.50 profit", or that the
 *  line loses money and by how much. */
export function marginWords(margin: LineMargin, currency: string): string {
  if (margin.profitCents < 0) {
    return `Below cost: you lose ${formatMoney(-margin.profitCents / 100, currency)}`;
  }
  const profit = `${formatMoney(margin.profitCents / 100, currency)} profit`;
  return margin.marginPct === null ? profit : `${percentText(margin.marginPct)} margin, ${profit}`;
}

export interface DocumentMargin {
  /** Lines with a cost, which are the only ones counted. */
  costedLines: number;
  /** Lines without one, which are left out and said to be. */
  uncostedLines: number;
  /** What the counted lines bring in; null when none are counted. */
  revenueCents: number | null;
  costCents: number | null;
  profitCents: number | null;
  marginPct: number | null;
  tone: MarginTone | null;
}

/** The margin across a whole document: the lines that have a cost, added up. */
export function documentMargin(lines: DraftLine[]): DocumentMargin {
  let costedLines = 0;
  let uncostedLines = 0;
  let revenueCents = 0;
  let costCents = 0;
  for (const line of lines) {
    if (isBlank(line)) continue;
    const margin = lineMargin(line);
    if (margin === null) {
      // A line with a cost but nothing charged and nothing spent has no margin
      // to add, and it is not missing a cost either.
      if (lineCostCents(line) === null) uncostedLines += 1;
      continue;
    }
    costedLines += 1;
    revenueCents += margin.revenueCents;
    costCents += margin.costCents;
  }
  if (costedLines === 0) {
    return {
      costedLines,
      uncostedLines,
      revenueCents: null,
      costCents: null,
      profitCents: null,
      marginPct: null,
      tone: null,
    };
  }
  const total = marginOf(revenueCents, costCents);
  return {
    costedLines,
    uncostedLines,
    revenueCents,
    costCents,
    profitCents: total.profitCents,
    marginPct: total.marginPct,
    tone: total.tone,
  };
}

/** "2 lines have no cost, so they are not counted.", or null when every line has one. */
export function uncostedSentence(count: number): string | null {
  if (count <= 0) return null;
  return count === 1
    ? '1 line has no cost, so it is not counted.'
    : `${String(count)} lines have no cost, so they are not counted.`;
}
