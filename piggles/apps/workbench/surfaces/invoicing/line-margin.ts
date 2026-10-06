// Margin on a quote or invoice, worked out as you price it (sparx persona issue
// 086). A line with no cost is left out and said to be, never counted at $0.
// Staff only: guarded server-side by crm's buyer-output-has-no-cost.test.ts.

import { isBlank, type DraftLine } from './totals';
import { formatMoney } from './types';

/** Below this share of the price a margin is thin; the product tab's line too. */
export const THIN_MARGIN_PCT = 15;

export type MarginTone = 'success' | 'warning' | 'danger';

export interface LineMargin {
  /** What the customer pays for the line, after its discount, before tax. */
  revenueCents: number;
  costCents: number;
  profitCents: number;
  /** Share of what they pay, one decimal; null when they pay nothing. */
  marginPct: number | null;
  tone: MarginTone;
}

type Priced = Pick<
  DraftLine,
  'quantity' | 'unitPrice' | 'discountAmount' | 'explicitCostCents' | 'costCents'
>;

/** Cost per unit in cents: typed in the editor, else stored. Null when none. */
export function lineCostCents(
  line: Pick<DraftLine, 'explicitCostCents' | 'costCents'>
): number | null {
  return line.explicitCostCents ?? line.costCents ?? null;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function marginOf(revenueCents: number, costCents: number): LineMargin {
  const profitCents = revenueCents - costCents;
  const marginPct = revenueCents > 0 ? round1((profitCents / revenueCents) * 100) : null;
  const tone: MarginTone =
    profitCents < 0
      ? 'danger'
      : marginPct !== null && marginPct < THIN_MARGIN_PCT
        ? 'warning'
        : 'success';
  return { revenueCents, costCents, profitCents, marginPct, tone };
}

/** The margin on one line, or null with no cost (or nothing on it at all). */
export function lineMargin(line: Priced): LineMargin | null {
  const unitCost = lineCostCents(line);
  if (unitCost === null) return null;
  const revenueCents =
    Math.round(line.quantity * line.unitPrice * 100) - Math.round(line.discountAmount * 100);
  const costCents = Math.round(line.quantity * unitCost);
  if (revenueCents === 0 && costCents === 0) return null;
  return marginOf(revenueCents, costCents);
}

/** "31.3% margin, $187.50 profit", or that the line loses money and by how much. */
export function marginWords(margin: LineMargin, currency: string): string {
  if (margin.profitCents < 0) {
    return `Below cost: you lose ${formatMoney(-margin.profitCents / 100, currency)}`;
  }
  const profit = `${formatMoney(margin.profitCents / 100, currency)} profit`;
  return margin.marginPct === null ? profit : `${String(margin.marginPct)}% margin, ${profit}`;
}

export interface DocumentMargin {
  costedLines: number;
  uncostedLines: number;
  revenueCents: number | null;
  costCents: number | null;
  profitCents: number | null;
  marginPct: number | null;
  tone: MarginTone | null;
}

/** The margin across a document: its lines with a cost, added up. */
export function documentMargin(lines: DraftLine[]): DocumentMargin {
  let costedLines = 0;
  let uncostedLines = 0;
  let revenueCents = 0;
  let costCents = 0;
  for (const line of lines) {
    if (isBlank(line)) continue;
    const margin = lineMargin(line);
    if (margin === null) {
      if (lineCostCents(line) === null) uncostedLines += 1;
      continue;
    }
    costedLines += 1;
    revenueCents += margin.revenueCents;
    costCents += margin.costCents;
  }
  if (costedLines === 0) {
    const none = { revenueCents: null, costCents: null, profitCents: null, marginPct: null };
    return { costedLines, uncostedLines, ...none, tone: null };
  }
  const total = marginOf(revenueCents, costCents);
  return { costedLines, uncostedLines, ...total };
}

/** "2 lines have no cost, so they are not counted.", or null when all have one. */
export function uncostedSentence(count: number): string | null {
  if (count <= 0) return null;
  return count === 1
    ? '1 line has no cost, so it is not counted.'
    : `${String(count)} lines have no cost, so they are not counted.`;
}

/** The live margin in the line editor, from the form's own fields. */
export function formMargin(form: {
  livePrice: number | null;
  quantity: number;
  discountAmount: number;
  costText: string;
}): LineMargin | null {
  const cost = form.costText.trim() === '' ? NaN : Number(form.costText);
  if (form.livePrice === null || !Number.isFinite(cost) || cost < 0) return null;
  if (!Number.isFinite(form.quantity) || form.quantity <= 0) return null;
  return lineMargin({
    quantity: form.quantity,
    unitPrice: form.livePrice,
    discountAmount: form.discountAmount,
    explicitCostCents: Math.round(cost * 100),
  });
}
