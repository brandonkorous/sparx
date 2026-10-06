// What is wrong with a markup rule form, and what a $100 cost comes to under it
// (sparx persona issue 086).

import { applyMarkupRule, type MarkupRuleSpec } from '@wizeworks/commerce-schemas';
import type { BandMethodName } from './markup-rule-words';
import { rulePayload, typed, type BandDraft, type RuleDraft } from './markup-rule-draft';

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

/** What a $100 cost sells for under the rule as it stands: its effect, not its
 *  settings. Null while it cannot price. */
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
