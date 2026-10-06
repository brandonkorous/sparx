// Saying a fitment rule out loud, and reading one back out of the year boxes.
//
// Shared by the product's own "What it fits" pane and the Products list's bulk
// "Set what it fits", so the same rule reads the same in both places and a
// window typed into either is checked by the same rule.

import type { FitmentDimension, FitmentDomain, ProductFitmentRange } from './products-data';

/**
 * A numeric window in words. "Year 2011–2016", "Weight up to 12000 lb".
 *
 * The unit is dropped when it merely repeats the axis label, which is the common
 * case — the stock vehicle dictionary ships a `Year` axis whose unit is `year`,
 * and printing both gives "Year 2011–2022 year".
 */
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

/**
 * A rule as a phrase, at the start of a sentence or in the middle of one.
 *
 * The list's name is the TENANT's own — "Apparel sizes", "Vehicles", "Printer
 * models" — so it may be singular or plural and nothing here may bend it into a
 * grammatical slot. `Every ${name.toLowerCase()}` gave Devi a button reading
 * **"It fits every apparel sizes"** (issue 794). "Everything in <Name>" reads
 * correctly whichever way the list was named.
 */
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

/**
 * The windows typed into the boxes, as a rule carries them, or the one sentence
 * saying what is wrong with them. Blank boxes mean "whatever the year"; a box
 * holding something that is not a number is a problem, never silently dropped,
 * because a rule saved without the years someone typed fits more than they meant.
 */
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
