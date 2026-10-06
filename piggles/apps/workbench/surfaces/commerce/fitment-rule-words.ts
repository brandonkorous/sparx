// Saying a fitment rule out loud, and reading one back out of the year boxes.
// Shared by a product's "What it fits" pane and the Products list's bulk action.

import type { FitmentDimension, FitmentDomain, ProductFitmentRange } from './products-data';

/** A numeric window in words: "Year 2011–2016", "Weight up to 12000 lb". The
 *  unit is dropped when it repeats the label ("Year 2011–2022 year"). */
export function rangeLabel(
  range: ProductFitmentRange,
  dimension: FitmentDimension | undefined
): string {
  const label = dimension?.label ?? range.dimensionKey;
  const redundant = dimension?.unit?.toLowerCase() === label.toLowerCase();
  const unit = dimension?.unit && !redundant ? ` ${dimension.unit}` : '';
  if (range.min !== null && range.max !== null) {
    return `${label} ${String(range.min)}–${String(range.max)}${unit}`;
  }
  if (range.min !== null) return `${label} ${String(range.min)}${unit} and up`;
  if (range.max !== null) return `${label} up to ${String(range.max)}${unit}`;
  return `${label}: any`;
}

/** A rule as a phrase. The list's name is the owner's own, singular or plural,
 *  so "Everything in <Name>" never bends it into a slot (issue 794). */
export function ruleTitle(
  rule: { nodePath: string[] },
  domain: FitmentDomain | undefined,
  position: 'start' | 'mid' = 'start'
): string {
  if (rule.nodePath.length > 0) return rule.nodePath.join(' › ');
  const lead = position === 'start' ? 'Everything in' : 'everything in';
  return domain ? `${lead} ${domain.displayName}` : `${lead} this list`;
}

/** What was typed into one axis's From and To boxes. */
export interface RangeDraft {
  min: string;
  max: string;
}

/** The windows typed into the boxes, or the one sentence saying what is wrong.
 *  Blank means "whatever the year"; a bad number is never silently dropped. */
export function rangesFromDrafts(
  dimensions: readonly FitmentDimension[],
  drafts: Readonly<Record<string, RangeDraft>>
): { ranges: ProductFitmentRange[]; problem: string | null } {
  const ranges: ProductFitmentRange[] = [];
  for (const dimension of dimensions) {
    const draft = drafts[dimension.key];
    if (!draft) continue;
    const minText = draft.min.trim();
    const maxText = draft.max.trim();
    if (minText === '' && maxText === '') continue;
    const min = minText === '' ? null : Number(minText);
    const max = maxText === '' ? null : Number(maxText);
    if ((min !== null && !Number.isFinite(min)) || (max !== null && !Number.isFinite(max))) {
      return { ranges: [], problem: `${dimension.label} has to be a number.` };
    }
    if (min !== null && max !== null && min > max) {
      return {
        ranges: [],
        problem: `The first ${dimension.label.toLowerCase()} has to come before the second.`,
      };
    }
    ranges.push({ dimensionKey: dimension.key, min, max });
  }
  return { ranges, problem: null };
}
