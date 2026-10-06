// Markup rules in an owner's words (sparx persona issue 086). The server stores
// 40% as 0.4 and a cost range in cents; this and markup-rule-draft.ts convert.

import type { MarkupScope } from '@wizeworks/commerce-schemas';
import { formatCentsAmount } from '../../lib/money-format';

/* ── The server's row ───────────────────────────────────────────────────── */

export type RuleMethod = 'percentage' | 'multiplier' | 'flat' | 'margin_target' | 'matrix';
export type BandMethodName = Exclude<RuleMethod, 'matrix'>;
export type AppliesTo = 'catalog' | 'document' | 'both';
export type RoundingChoice = 'none' | 'nearest' | 'charm';

export interface MarkupBandRow {
  costMinCents: number;
  costMaxCents: number | null;
  method: BandMethodName;
  value: number;
}

/** A rule exactly as GET /v1/markup-rules returns it. */
export interface MarkupRuleRow {
  id: string;
  name: string;
  method: string;
  value: number | null;
  bands: MarkupBandRow[];
  costBasis: string;
  rounding: { strategy?: string; precisionCents?: number | null; endingCents?: number | null };
  floorProfitCents: number | null;
  floorMargin: number | null;
  ceilingSrc: string;
  ceilingValueCents: number | null;
  appliesTo: string;
  scope: MarkupScope;
  priority: number;
  isActive: boolean;
  recomputeMode: string;
  recomputeTolerancePct: number | null;
  /** How many catalog versions are priced by this rule right now. */
  boundVariantCount: number;
  createdAt: string;
  updatedAt: string;
}

/* ── Words ──────────────────────────────────────────────────────────────── */

/** Engine value ↔ what a person types: percentages as whole percents. */
export function toDisplay(method: BandMethodName, value: number): string {
  const shown = method === 'percentage' || method === 'margin_target' ? value * 100 : value;
  return String(Number(shown.toFixed(4)));
}

export function toEngine(method: BandMethodName, typed: number): number {
  return method === 'percentage' || method === 'margin_target' ? typed / 100 : typed;
}

function money(cents: number): string {
  return formatCentsAmount(cents, 'USD');
}

function stepWords(method: BandMethodName, value: number): string {
  switch (method) {
    case 'percentage':
      return `Adds ${toDisplay(method, value)}% to the cost.`;
    case 'multiplier':
      return `Multiplies the cost by ${toDisplay(method, value)}.`;
    case 'flat':
      return `Adds ${money(Math.round(value * 100))} to the cost.`;
    case 'margin_target':
      return `Prices for a ${toDisplay(method, value)}% margin.`;
  }
}

/** What a rule does to a cost, in one sentence. */
export function describeRule(rule: {
  method: string;
  value: number | null;
  bands?: readonly unknown[];
}): string {
  if (rule.method === 'matrix') {
    const count = rule.bands?.length ?? 0;
    return count === 1
      ? 'Marks up by what it costs, in 1 cost range.'
      : `Marks up by what it costs, in ${String(count)} cost ranges.`;
  }
  if (rule.value === null) return 'Works the price out from the cost.';
  return stepWords(rule.method as BandMethodName, rule.value);
}

/** Which cost a catalog rule starts from, in words. */
export function costBasisWords(costBasis: string): string {
  return costBasis === 'supplier_cost' ? "your supplier's current cost" : 'the cost on the product';
}

/** What a rule does and which cost it starts from, for a screen that shows a
 *  rule without opening it (the product Pricing tab). */
export function ruleSentence(rule: {
  method: string;
  value: number | null;
  bands?: readonly unknown[];
  costBasis: string;
}): string {
  return `${describeRule(rule)} Starts from ${costBasisWords(rule.costBasis)}.`;
}

export const APPLIES_TO_WORDS: Record<AppliesTo, string> = {
  document: 'Quote and invoice lines',
  catalog: 'Products in your catalog',
  both: 'Quotes, invoices and your catalog',
};

export function appliesToWords(value: string): string {
  return APPLIES_TO_WORDS[value as AppliesTo] ?? value;
}

/** Whether the line editor on a quote offers this rule. */
export function pricesQuotes(appliesTo: string): boolean {
  return appliesTo === 'document' || appliesTo === 'both';
}

export function pricesCatalog(appliesTo: string): boolean {
  return appliesTo === 'catalog' || appliesTo === 'both';
}
