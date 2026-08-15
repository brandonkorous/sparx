// Markup pricing maths for a billing line — pure logic, no UI (docs/87 §5, docs/48).
//
// A markup / pass-through line is not priced by a typed unit price; it is priced
// LIVE from a cost basis + a markup directive (a saved rule or an ad-hoc markup),
// off the SAME pure engine as catalog/quote markup (`applyMarkupRule` in
// @sparx/commerce-schemas), so the two never drift. The resolved directive is
// sent with the line and the server re-prices authoritatively and snapshots the
// result — what's computed here is a faithful preview of that answer.
//
// This module owns the MATHS ONLY. It deliberately does not own a cost field or
// render one: cost is a property of the LINE, not of the markup, and the line
// editor keeps it in one place for every pricing mode. An earlier version put a
// cost input inside the markup component, which meant the same field lived in
// two different components depending on mode — the layout could never be made
// coherent because the field kept changing owners.

import {
  applyMarkupRule,
  type BandMethod,
  type LineMarkupInput,
  type MarkupRuleSpec,
} from '@sparx/commerce-schemas';
import type { DraftLine } from './totals';

export const ADHOC = 'adhoc';
export const PASSTHROUGH = 'passthrough';

/** A document-applicable markup rule (GET /v1/markup-rules, appliesTo document|both),
 *  reduced to the fields the pure engine needs to price a line (docs/48 §5). */
export interface MarkupRuleSummary {
  id: string;
  name: string;
  method: MarkupRuleSpec['method'];
  value: number | null;
  bands: MarkupRuleSpec['bands'];
  rounding: MarkupRuleSpec['rounding'];
  floorProfitCents: number | null;
  floorMargin: number | null;
  ceilingSrc: MarkupRuleSpec['ceilingSrc'];
  ceilingValueCents: number | null;
}

/** Per ad-hoc method: the input label + how the typed value maps to (and from)
 *  the engine's unitless `value` (percentage / margin_target are entered as %). */
export const METHOD_META: Record<
  BandMethod,
  { label: string; toEngine: (n: number) => number; fromEngine: (n: number) => number }
> = {
  percentage: { label: 'Markup %', toEngine: (n) => n / 100, fromEngine: (n) => n * 100 },
  margin_target: { label: 'Target margin %', toEngine: (n) => n / 100, fromEngine: (n) => n * 100 },
  multiplier: { label: 'Multiplier ×', toEngine: (n) => n, fromEngine: (n) => n },
  flat: { label: 'Add fixed $', toEngine: (n) => n, fromEngine: (n) => n },
};

export function ruleToSpec(r: MarkupRuleSummary): MarkupRuleSpec {
  return {
    method: r.method,
    value: r.value,
    bands: r.bands ?? [],
    rounding: r.rounding ?? null,
    floorProfitCents: r.floorProfitCents,
    floorMargin: r.floorMargin,
    ceilingSrc: r.ceilingSrc,
    ceilingValueCents: r.ceilingValueCents,
  };
}

export function isMarkupMode(mode: string | undefined): boolean {
  return mode === 'markup' || mode === 'pass_through';
}

/** The markup DIRECTIVE only — which markup, and its terms. Cost is not here;
 *  it belongs to the line and is passed in when pricing. */
export interface MarkupState {
  source: string; // a rule id, ADHOC, or PASSTHROUGH (pass_through only)
  method: BandMethod;
  value: string; // ad-hoc value in display units
}

export interface ResolvedMarkup {
  preview: { priceCents: number; marginPct: number; markupPct: number } | null;
  /** Body fields to send: explicitCostCents always; markup omitted for a
   *  pass-through-at-cost line. Null when the inputs aren't yet priceable. */
  payload: { explicitCostCents: number; markup?: LineMarkupInput } | null;
  error: string | null;
}

export function freshMarkupState(rules: MarkupRuleSummary[], pricingMode: string): MarkupState {
  return {
    source: pricingMode === 'pass_through' ? PASSTHROUGH : (rules[0]?.id ?? ADHOC),
    method: 'percentage',
    // 0, not empty. An empty value is UNPRICEABLE, so entering a cost would show
    // "Invalid value" before the operator has done anything wrong. 0% markup is a
    // real answer — sell at cost — so the line prices immediately and the number
    // is then edited up. Safe for the default method (percentage accepts 0);
    // margin_target and multiplier reject it, but those are only ever reached by
    // switching method, which carries its own value across anyway.
    value: '0',
  };
}

/** The cost a line opens with, in display dollars — its own explicit cost, else
 *  the basis of the markup it was last priced with. */
export function seedCost(line: DraftLine): string {
  if (line.costCents != null) return String(line.costCents / 100);
  if (line.appliedMarkup) return String(line.appliedMarkup.costBasisValueCents / 100);
  return '';
}

/** Re-open a priced line showing the rule/value it was actually priced with. */
export function seedMarkupState(
  line: DraftLine,
  rules: MarkupRuleSummary[],
  pricingMode: string
): MarkupState {
  const base = freshMarkupState(rules, pricingMode);
  const snapshot = line.appliedMarkup;
  if (!snapshot) return base;
  if (snapshot.ruleId && rules.some((r) => r.id === snapshot.ruleId)) {
    return { ...base, source: snapshot.ruleId };
  }
  // Ad-hoc (or a rule since deleted) → seed the ad-hoc inputs.
  const method: BandMethod = (
    ['percentage', 'margin_target', 'multiplier', 'flat'] as BandMethod[]
  ).includes(snapshot.method as BandMethod)
    ? (snapshot.method as BandMethod)
    : 'percentage';
  // Same reasoning as the fresh default: a snapshot with no value falls back to
  // a priceable 0 rather than an empty field that reads as an error on open.
  const value =
    snapshot.value != null ? String(METHOD_META[method].fromEngine(snapshot.value)) : base.value;
  return { source: ADHOC, method, value };
}

/** Validate the ad-hoc value against the same bounds LineMarkupInput enforces,
 *  so the live preview never shows a price the server would then reject. */
export function adhocEngineValue(method: BandMethod, raw: string): number | null {
  const n = parseFloat(raw);
  if (!raw.trim() || Number.isNaN(n)) return null;
  const v = METHOD_META[method].toEngine(n);
  if (method === 'margin_target' && (v <= 0 || v >= 1)) return null;
  if (method === 'multiplier' && v <= 0) return null;
  if ((method === 'percentage' || method === 'flat') && v < 0) return null;
  return v;
}

/** Price a line from its cost (display dollars) + the chosen markup directive. */
export function resolveMarkup(
  cost: string,
  st: MarkupState,
  rules: MarkupRuleSummary[],
  pricingMode: string
): ResolvedMarkup {
  const costNum = parseFloat(cost);
  if (!cost.trim() || Number.isNaN(costNum) || costNum < 0) {
    return { preview: null, payload: null, error: 'Enter a cost to price this line.' };
  }
  const costCents = Math.round(costNum * 100);

  // Pass-through at cost: no markup, price == cost.
  if (pricingMode === 'pass_through' && st.source === PASSTHROUGH) {
    return {
      preview: { priceCents: costCents, marginPct: 0, markupPct: 0 },
      payload: { explicitCostCents: costCents },
      error: null,
    };
  }

  let spec: MarkupRuleSpec;
  let markup: LineMarkupInput;
  if (st.source !== ADHOC) {
    const rule = rules.find((r) => r.id === st.source);
    if (!rule) return { preview: null, payload: null, error: 'Pick a rule' };
    spec = ruleToSpec(rule);
    markup = { kind: 'rule', ruleId: rule.id };
  } else {
    const engineValue = adhocEngineValue(st.method, st.value);
    if (engineValue == null) {
      return { preview: null, payload: null, error: 'Invalid value' };
    }
    spec = { method: st.method, value: engineValue };
    markup = { kind: 'adhoc', method: st.method, value: engineValue };
  }

  const result = applyMarkupRule(costCents, spec);
  return {
    preview: {
      priceCents: result.priceCents,
      marginPct: result.marginPct,
      markupPct: result.markupPct,
    },
    payload: { explicitCostCents: costCents, markup },
    error: null,
  };
}
