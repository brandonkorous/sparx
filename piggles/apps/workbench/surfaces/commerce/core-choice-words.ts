// What the core charge choices screen says about each product, and what it sends
// (sparx persona issue 057). The deposit comes from the store's WORDS, so each row
// shows today's prices beside the new ones.

import type { CoreChoiceCandidate } from '@wizeworks/commerce-schemas';
import { formatMoney } from './data';

/** What the owner has typed on one row. Money in cents; undefined = blank. */
export interface ChoiceDraft {
  partCents: number | undefined;
  partProblem: string | null;
  depositCents: number | undefined;
  depositProblem: string | null;
  offerFirst: boolean;
}

/** What goes to the server for one product. */
export interface CoreChoiceChange {
  productId: string;
  /** Omitted when the product keeps one version per other choice: each keeps
   *  its own old-part-first price, and the server refuses one price for all. */
  partPriceCents?: number;
  coreChargeCents: number;
  offerCoreFirst: boolean;
}

export type ChoiceTone = 'success' | 'warning' | 'info' | 'error';

function money(cents: number, currency: string): string {
  return formatMoney(cents / 100, currency);
}

export function plural(count: number, one: string, many: string): string {
  return `${String(count)} ${count === 1 ? one : many}`;
}

/** The row as the server suggested it: the part at its old-part-first price, the
 *  deposit the words name (blank when they name none), still offering the old
 *  part first, because the store offered that. */
export function startingDraft(candidate: CoreChoiceCandidate): ChoiceDraft {
  return {
    partCents: candidate.suggestedPartPriceCents,
    partProblem: null,
    depositCents: candidate.suggestedCoreChargeCents ?? undefined,
    depositProblem: null,
    offerFirst: true,
  };
}

/** Whether the owner has changed anything on this row since it loaded. */
export function isEdited(candidate: CoreChoiceCandidate, draft: ChoiceDraft): boolean {
  const start = startingDraft(candidate);
  return (
    draft.partCents !== start.partCents ||
    draft.depositCents !== start.depositCents ||
    draft.offerFirst !== start.offerFirst
  );
}

/** One price for all of it, or one per version of its other choices. */
export function sharesOnePrice(candidate: CoreChoiceCandidate): boolean {
  return candidate.groups <= 1;
}

/** Why this row cannot be changed yet, or null when it can. */
export function blockedBy(candidate: CoreChoiceCandidate, draft: ChoiceDraft): string | null {
  if (candidate.problem) return candidate.problem;
  if (draft.depositProblem) return draft.depositProblem;
  if (draft.depositCents === undefined || draft.depositCents <= 0) {
    return candidate.suggestedCoreChargeCents === null
      ? `“${candidate.depositLabel}” names no amount, so type the core deposit.`
      : 'Give the core deposit an amount.';
  }
  if (sharesOnePrice(candidate)) {
    if (draft.partProblem) return draft.partProblem;
    if (draft.partCents === undefined || draft.partCents <= 0) return 'Give the part a price.';
  }
  return null;
}

/** The part's price after the change: the one typed, or the old-part-first price
 *  when each version keeps its own. */
function partAfter(candidate: CoreChoiceCandidate, draft: ChoiceDraft): number {
  return sharesOnePrice(candidate)
    ? (draft.partCents ?? candidate.suggestedPartPriceCents)
    : candidate.firstSidePriceCents;
}

/** How a buyer's price moves, in words, or null when it does not. The prices
 *  rarely follow the words, so this is said on the row before anything changes. */
export function priceShift(candidate: CoreChoiceCandidate, draft: ChoiceDraft): string | null {
  if (candidate.problem || draft.depositCents === undefined || draft.depositCents <= 0) {
    return null;
  }
  const { currency } = candidate;
  const part = partAfter(candidate, draft);
  const said: string[] = [];
  if (candidate.depositSidePriceCents !== part + draft.depositCents) {
    said.push(
      `Today a buyer who ships now pays ${money(candidate.depositSidePriceCents, currency)}. After: ${money(part, currency)} + ${money(draft.depositCents, currency)} deposit.`
    );
  }
  if (candidate.firstSidePriceCents !== part) {
    said.push(
      `Today a buyer who sends the old part first pays ${money(candidate.firstSidePriceCents, currency)}. After: ${money(part, currency)}.`
    );
  }
  if (said.length === 0) return null;
  return sharesOnePrice(candidate) ? said.join(' ') : `For ${candidate.keptSku}: ${said.join(' ')}`;
}

/** The state badge on a row. */
export function rowState(
  candidate: CoreChoiceCandidate,
  draft: ChoiceDraft
): { label: string; tone: ChoiceTone } {
  if (candidate.problem) return { label: 'Change by hand', tone: 'error' };
  if (blockedBy(candidate, draft)) {
    return draft.depositProblem || draft.partProblem
      ? { label: 'Check the amounts', tone: 'error' }
      : { label: 'Needs a deposit amount', tone: 'warning' };
  }
  return priceShift(candidate, draft)
    ? { label: 'Price changes', tone: 'info' }
    : { label: 'Same prices as today', tone: 'success' };
}

/** The request for one row. Only call it on a row `blockedBy` passes. */
export function changeFor(candidate: CoreChoiceCandidate, draft: ChoiceDraft): CoreChoiceChange {
  return {
    productId: candidate.productId,
    ...(sharesOnePrice(candidate) && draft.partCents !== undefined
      ? { partPriceCents: draft.partCents }
      : {}),
    coreChargeCents: draft.depositCents ?? 0,
    offerCoreFirst: draft.offerFirst,
  };
}

/** What happens to a product once it changes, in the owner's words. */
export function whatHappens(candidate: CoreChoiceCandidate, draft: ChoiceDraft): string {
  const { currency } = candidate;
  const deposit = money(draft.depositCents ?? 0, currency);
  const priced = sharesOnePrice(candidate)
    ? `at ${money(partAfter(candidate, draft), currency)} with a ${deposit} core deposit`
    : `with a ${deposit} core deposit, each of its ${String(candidate.groups)} versions keeping its own price`;
  const retired = candidate.retiredVariantIds.length;
  return [
    `${candidate.title} becomes one part, ${candidate.keptSku}, ${priced}.`,
    `The “${candidate.optionName}” choice goes, and the other ${retired === 1 ? 'version stops' : `${String(retired)} versions stop`} being sold. ${retired === 1 ? 'Its photos move' : 'Their photos move'} to the one that stays.`,
    draft.offerFirst
      ? 'Buyers can still send their old part first instead of paying the deposit.'
      : 'Every buyer pays the deposit: sending the old part first is no longer offered.',
  ].join(' ');
}

/** The confirm before changing every ready row at once. */
export function changeAllWords(count: number, offering: number): string {
  return [
    `Each of the ${plural(count, 'product', 'products')} becomes one part with a real core deposit, at the prices shown on this screen.`,
    'On each, the other version stops being sold and its photos move to the one that stays, and the core choice goes.',
    offering === count
      ? count === 1
        ? 'Buyers can still send their old part first.'
        : 'Buyers can still send their old part first on all of them.'
      : offering === 0
        ? 'None of them will offer sending the old part first.'
        : `${plural(offering, 'of them still offers', 'of them still offer')} sending the old part first.`,
  ].join(' ');
}

/** Said once a run of changes is done, for the number that changed. */
export function changedWords(count: number): string {
  return count === 1
    ? 'It is a single part with a real core deposit now.'
    : 'Each one is a single part with a real core deposit now.';
}

/** Said when some of a run could not change, for the number that could not. */
export function stuckWords(count: number): string {
  return count === 1
    ? '1 product could not be changed. The reason is shown on it.'
    : `${String(count)} products could not be changed. The reason is shown on each.`;
}

/** Under the results heading, for the number that could not change. */
export function stuckDetail(count: number): string {
  return count === 1
    ? 'This one could not be changed, and nothing on it moved.'
    : 'These could not be changed, and nothing on them moved.';
}
