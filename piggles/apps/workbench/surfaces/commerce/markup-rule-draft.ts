// The markup rule form, and its numbers in the server's units (sparx persona
// issue 086). Pure, so every conversion has a test.

import type { MarkupRuleSpec, MarkupScope } from '@wizeworks/commerce-schemas';
import {
  toDisplay,
  toEngine,
  type AppliesTo,
  type BandMethodName,
  type MarkupRuleRow,
  type RoundingChoice,
  type RuleMethod,
} from './markup-rule-words';

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
export function typed(text: string): number | null {
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
