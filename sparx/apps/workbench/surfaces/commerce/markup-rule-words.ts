// Markup rules in an owner's words, and the form's numbers in the server's units
// (sparx persona issue 086).
//
// The /b2b page says "set line-item pricing (markup rules help)", and until this
// screen existed a rule could only be made through the API. The server stores a
// percentage as a fraction (40% is 0.4), a fixed amount in dollars, a cost
// range in cents and a minimum margin as a percent. The form shows each the way
// a person would type it, and this file is the one place that converts.
//
// Pure: no React, no fetch, so every rule here has a test.

import {
  applyMarkupRule,
  type MarkupRuleSpec,
  type MarkupScope,
} from '@wizeworks/commerce-schemas';
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
function toDisplay(method: BandMethodName, value: number): string {
  const shown = method === 'percentage' || method === 'margin_target' ? value * 100 : value;
  return String(Number(shown.toFixed(4)));
}

function toEngine(method: BandMethodName, typed: number): number {
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

/* ── The form ───────────────────────────────────────────────────────────── */

export interface BandDraft {
  /** Dollars as typed. */
  from: string;
  /** Dollars as typed; blank means "and up". */
  to: string;
  method: BandMethodName;
  value: string;
}

export interface RuleDraft {
  name: string;
  appliesTo: AppliesTo;
  isActive: boolean;
  method: RuleMethod;
  /** In the units a person types: 40 for 40%, 2.5 for ×2.5, 15 for $15. */
  value: string;
  bands: BandDraft[];
  costBasis: string;
  rounding: RoundingChoice;
  precisionCents: number;
  endingCents: number;
  /** Dollars as typed; blank is no minimum. */
  floorProfit: string;
  /** Percent as typed; blank is no minimum. */
  floorMargin: string;
  ceilingSrc: string;
  /** Dollars as typed, for a fixed ceiling. */
  ceilingValue: string;
  /** Kept whole: a list of chosen products is not edited here, and is sent
   *  back exactly as it came. */
  scope: MarkupScope;
  priority: string;
  recomputeMode: string;
  /** Percent as typed; blank is no limit. */
  tolerance: string;
}

/** How a form section changes one field of the draft. */
export type SetRuleDraft = <K extends keyof RuleDraft>(key: K, value: RuleDraft[K]) => void;

export function emptyRuleDraft(): RuleDraft {
  return {
    name: '',
    // A rule made from the quote screen is for quotes; that is the door most
    // people come through, and the one the /b2b page describes.
    appliesTo: 'document',
    isActive: true,
    method: 'percentage',
    value: '',
    bands: [],
    costBasis: 'variant_cost',
    rounding: 'none',
    precisionCents: 5,
    endingCents: 99,
    floorProfit: '',
    floorMargin: '',
    ceilingSrc: 'none',
    ceilingValue: '',
    scope: { type: 'all' },
    priority: '0',
    recomputeMode: 'auto',
    tolerance: '',
  };
}

function centsText(cents: number | null): string {
  return cents === null ? '' : String(Number((cents / 100).toFixed(2)));
}

export function ruleDraftFrom(rule: MarkupRuleRow): RuleDraft {
  const method = rule.method as RuleMethod;
  const strategy = (rule.rounding.strategy ?? 'none') as RoundingChoice;
  return {
    name: rule.name,
    appliesTo: rule.appliesTo as AppliesTo,
    isActive: rule.isActive,
    method,
    value: method === 'matrix' || rule.value === null ? '' : toDisplay(method, rule.value),
    bands: rule.bands.map((band) => ({
      from: centsText(band.costMinCents),
      to: centsText(band.costMaxCents),
      method: band.method,
      value: toDisplay(band.method, band.value),
    })),
    costBasis: rule.costBasis,
    rounding: strategy,
    precisionCents: rule.rounding.precisionCents ?? 5,
    endingCents: rule.rounding.endingCents ?? 99,
    floorProfit: centsText(rule.floorProfitCents),
    floorMargin: rule.floorMargin === null ? '' : String(rule.floorMargin),
    ceilingSrc: rule.ceilingSrc,
    ceilingValue: centsText(rule.ceilingValueCents),
    scope: rule.scope,
    priority: String(rule.priority),
    recomputeMode: rule.recomputeMode,
    tolerance: rule.recomputeTolerancePct === null ? '' : String(rule.recomputeTolerancePct),
  };
}

/** A typed number, or null for blank, or NaN for something unreadable. */
function typed(text: string): number | null {
  const cleaned = text.replace(/[$,%\s]/g, '');
  if (cleaned === '') return null;
  return Number(cleaned);
}

function cents(text: string): number | null {
  const n = typed(text);
  return n === null ? null : Math.round(n * 100);
}

function roundingPayload(draft: RuleDraft): MarkupRuleSpec['rounding'] {
  if (draft.rounding === 'nearest') {
    return { strategy: 'nearest', precisionCents: draft.precisionCents };
  }
  if (draft.rounding === 'charm') return { strategy: 'charm', endingCents: draft.endingCents };
  return { strategy: 'none' };
}

/** The body POST/PATCH /v1/markup-rules takes. Call only on a draft with no errors. */
export function rulePayload(draft: RuleDraft) {
  const matrix = draft.method === 'matrix';
  const value = typed(draft.value);
  return {
    name: draft.name.trim(),
    method: draft.method,
    value: matrix || value === null ? null : toEngine(draft.method as BandMethodName, value),
    bands: matrix
      ? draft.bands.map((band) => ({
          costMinCents: cents(band.from) ?? 0,
          costMaxCents: cents(band.to),
          method: band.method,
          value: toEngine(band.method, typed(band.value) ?? 0),
        }))
      : [],
    costBasis: draft.costBasis,
    rounding: roundingPayload(draft),
    floorProfitCents: cents(draft.floorProfit),
    floorMargin: typed(draft.floorMargin),
    ceilingSrc: draft.ceilingSrc,
    ceilingValueCents: draft.ceilingSrc === 'fixed' ? cents(draft.ceilingValue) : null,
    appliesTo: draft.appliesTo,
    scope: draft.scope,
    priority: typed(draft.priority) ?? 0,
    isActive: draft.isActive,
    recomputeMode: draft.recomputeMode,
    recomputeTolerancePct: typed(draft.tolerance),
  };
}

export type RulePayload = ReturnType<typeof rulePayload>;

/** What is wrong with a step's value, in the words the field shows. */
function valueProblem(method: BandMethodName, text: string): string | null {
  const n = typed(text);
  if (n === null || Number.isNaN(n)) return 'Enter a number.';
  if (method === 'margin_target' && (n <= 0 || n >= 100)) {
    return 'A margin has to be more than 0% and less than 100%.';
  }
  if (method === 'multiplier' && n <= 0) return 'Multiply by more than 0.';
  if (n < 0) return 'This cannot be below zero.';
  return null;
}

function bandsProblem(bands: BandDraft[]): string | null {
  if (bands.length === 0) return 'Add at least one cost range.';
  for (const [index, band] of bands.entries()) {
    const which = `Range ${String(index + 1)}`;
    const from = typed(band.from);
    const to = typed(band.to);
    if (from === null || Number.isNaN(from) || from < 0) return `${which} needs a starting cost.`;
    if (to !== null && (Number.isNaN(to) || to < 0))
      return `${which} has an ending cost that is not a number.`;
    if (to !== null && to < from) return `${which} ends before it starts.`;
    const problem = valueProblem(band.method, band.value);
    if (problem) return `${which}: ${problem}`;
  }
  return null;
}

function optionalNumberProblem(text: string, max?: number): string | null {
  const n = typed(text);
  if (n === null) return null;
  if (Number.isNaN(n) || n < 0) return 'Enter a number of zero or more, or leave it blank.';
  if (max !== undefined && n > max) return `Keep it at ${String(max)} or less.`;
  return null;
}

export interface DraftErrors {
  name: string | null;
  value: string | null;
  bands: string | null;
  floorProfit: string | null;
  floorMargin: string | null;
  ceilingValue: string | null;
  priority: string | null;
  tolerance: string | null;
}

export function draftErrors(draft: RuleDraft): DraftErrors {
  const priority = typed(draft.priority);
  return {
    name: draft.name.trim() === '' ? 'Give this rule a name.' : null,
    value: draft.method === 'matrix' ? null : valueProblem(draft.method, draft.value),
    bands: draft.method === 'matrix' ? bandsProblem(draft.bands) : null,
    floorProfit: optionalNumberProblem(draft.floorProfit),
    floorMargin: optionalNumberProblem(draft.floorMargin, 99.99),
    ceilingValue:
      draft.ceilingSrc !== 'fixed'
        ? null
        : typed(draft.ceilingValue) === null
          ? 'Enter the most a price may be.'
          : optionalNumberProblem(draft.ceilingValue),
    priority:
      priority !== null && (Number.isNaN(priority) || priority < 0 || !Number.isInteger(priority))
        ? 'Enter a whole number of zero or more.'
        : null,
    tolerance: optionalNumberProblem(draft.tolerance),
  };
}

export function hasErrors(errors: DraftErrors): boolean {
  return Object.values(errors).some(Boolean);
}

/** The cost the example is worked on: a round $100. */
const EXAMPLE_COST_CENTS = 10_000;

/**
 * What a $100 cost sells for under the rule as it stands, so the owner sees the
 * rule's effect instead of reading its settings. Null while it cannot price.
 */
export function examplePrice(
  draft: RuleDraft,
  costCents = EXAMPLE_COST_CENTS
): { costCents: number; priceCents: number; marginPct: number } | null {
  const errors = draftErrors({ ...draft, name: draft.name || 'example' });
  if (
    errors.value ||
    errors.bands ||
    errors.floorProfit ||
    errors.floorMargin ||
    errors.ceilingValue
  ) {
    return null;
  }
  const payload = rulePayload(draft);
  const spec: MarkupRuleSpec = {
    method: payload.method,
    value: payload.value,
    bands: payload.bands,
    rounding: payload.rounding ?? null,
    floorProfitCents: payload.floorProfitCents,
    floorMargin: payload.floorMargin,
    ceilingSrc: payload.ceilingSrc as MarkupRuleSpec['ceilingSrc'],
    ceilingValueCents: payload.ceilingValueCents,
  };
  const result = applyMarkupRule(costCents, spec);
  return { costCents, priceCents: result.priceCents, marginPct: result.marginPct };
}
