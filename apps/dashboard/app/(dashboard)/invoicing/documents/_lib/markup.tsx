'use client';

// Shared markup pricing primitives (docs/87 §5, docs/48). A markup / pass_through
// line is priced LIVE off the same pure engine as catalog/quote markup: a cost
// basis + a markup directive (a saved rule or an ad-hoc markup) resolve to a unit
// price, snapshotted on the line so the price is reproducible after cost drift.
//
// This module is the ONE source of truth for that editor: both the document editor
// (the line grid, editing a live document) and the create wizard (composing lines
// locally before the document exists) import these so a line priced in the wizard
// is identical to the same line priced in the editor.

import * as React from 'react';

import { Badge, Input, Label } from '@wizeworks/silicaui-react';
import {
  applyMarkupRule,
  type BandMethod,
  type LineMarkupInput,
  type MarkupRuleSpec,
} from '@sparx/commerce-schemas';

import { formatMoney } from '../../_components/format';

// A native-select skin matching the platform Input (the grid uses raw <select>
// for its dense inline pickers; this is shared chrome, not a re-skinned control).
export const SELECT_CLASS =
  'flex h-9 w-full rounded-md border border-base-300 bg-base-100 px-2 text-sm text-base-content focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary';

export const ADHOC = 'adhoc';
export const PASSTHROUGH = 'passthrough';

// A document-applicable markup rule (GET /v1/markup-rules, appliesTo document|both),
// reduced to the fields the pure engine needs to price a line (docs/48 §5).
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

// Per ad-hoc method: the input label + how the typed value maps to (and from) the
// engine's unitless `value` (percentage / margin_target are entered as percents).
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

// ── Markup editor state + resolution ──────────────────────────────────────────

export interface MarkupState {
  cost: string; // dollars
  source: string; // a rule id, ADHOC, or PASSTHROUGH (pass_through only)
  method: BandMethod;
  value: string; // ad-hoc value in display units
}

export interface ResolvedMarkup {
  preview: { priceCents: number; marginPct: number; markupPct: number } | null;
  // The body fields to send (explicitCostCents always; markup omitted for a
  // pass-through-at-cost line). Null when the inputs aren't yet priceable.
  payload: { explicitCostCents: number; markup?: LineMarkupInput } | null;
  error: string | null;
}

export function freshMarkupState(rules: MarkupRuleSummary[], pricingMode: string): MarkupState {
  return {
    cost: '',
    source: pricingMode === 'pass_through' ? PASSTHROUGH : (rules[0]?.id ?? ADHOC),
    method: 'percentage',
    value: '',
  };
}

// Validate the ad-hoc value against the same bounds LineMarkupInput enforces, so
// the live preview never shows a nonsensical price the server would reject.
export function adhocEngineValue(method: BandMethod, raw: string): number | null {
  const n = parseFloat(raw);
  if (!raw.trim() || Number.isNaN(n)) return null;
  const v = METHOD_META[method].toEngine(n);
  if (method === 'margin_target' && (v <= 0 || v >= 1)) return null;
  if (method === 'multiplier' && v <= 0) return null;
  if ((method === 'percentage' || method === 'flat') && v < 0) return null;
  return v;
}

export function resolveMarkup(
  st: MarkupState,
  rules: MarkupRuleSummary[],
  pricingMode: string
): ResolvedMarkup {
  const costNum = parseFloat(st.cost);
  if (!st.cost.trim() || Number.isNaN(costNum) || costNum < 0) {
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
    if (!rule) return { preview: null, payload: null, error: 'Pick a markup rule.' };
    spec = ruleToSpec(rule);
    markup = { kind: 'rule', ruleId: rule.id };
  } else {
    const engineValue = adhocEngineValue(st.method, st.value);
    if (engineValue == null) {
      return { preview: null, payload: null, error: 'Enter a valid markup value.' };
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

// The shared markup inputs (cost · source · ad-hoc method+value) + a live preview.
export function MarkupFields({
  state,
  rules,
  pricingMode,
  resolved,
  disabled,
  onChange,
  currency,
}: {
  state: MarkupState;
  rules: MarkupRuleSummary[];
  pricingMode: string;
  resolved: ResolvedMarkup;
  disabled: boolean;
  onChange: (next: Partial<MarkupState>) => void;
  currency: string;
}) {
  return (
    <div className="flex min-w-[16rem] flex-col gap-2">
      <div className="flex flex-row flex-wrap items-end gap-2">
        <div className="flex flex-col gap-1">
          <Label className="text-xs">Cost</Label>
          <Input
            type="number"
            min="0"
            step="0.01"
            className="w-28 text-right"
            aria-label="Line cost"
            value={state.cost}
            disabled={disabled}
            onChange={(e) => onChange({ cost: e.target.value })}
            placeholder="0.00"
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label className="text-xs">Markup</Label>
          <select
            aria-label="Markup source"
            className={`${SELECT_CLASS} w-44`}
            value={state.source}
            disabled={disabled}
            onChange={(e) => onChange({ source: e.target.value })}
          >
            {pricingMode === 'pass_through' && (
              <option value={PASSTHROUGH}>Pass through at cost</option>
            )}
            {rules.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
            <option value={ADHOC}>Ad-hoc markup…</option>
          </select>
        </div>
      </div>

      {state.source === ADHOC && (
        <div className="flex flex-row flex-wrap items-end gap-2">
          <div className="flex flex-col gap-1">
            <Label className="text-xs">Method</Label>
            <select
              aria-label="Markup method"
              className={`${SELECT_CLASS} w-40`}
              value={state.method}
              disabled={disabled}
              onChange={(e) => onChange({ method: e.target.value as BandMethod })}
            >
              <option value="percentage">Markup %</option>
              <option value="margin_target">Target margin %</option>
              <option value="multiplier">Multiplier ×</option>
              <option value="flat">Add fixed $</option>
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-xs">{METHOD_META[state.method].label}</Label>
            <Input
              type="number"
              step="0.01"
              className="w-28 text-right"
              aria-label="Markup value"
              value={state.value}
              disabled={disabled}
              onChange={(e) => onChange({ value: e.target.value })}
            />
          </div>
        </div>
      )}

      {resolved.preview ? (
        <div className="flex flex-row flex-wrap items-center gap-2">
          <Badge color="module" variant="soft">
            {formatMoney(resolved.preview.priceCents / 100, currency)} / unit
          </Badge>
          <p className="text-base-content text-xs">
            {resolved.preview.marginPct}% margin · {resolved.preview.markupPct}% markup
          </p>
        </div>
      ) : (
        <p className="text-base-content text-xs">
          {resolved.error ?? 'Enter a cost to preview the price.'}
        </p>
      )}
    </div>
  );
}
