// What the Products list's bulk bar acts on, and the sentences it says about it.
//
// A selection is either rows somebody ticked, or "every product the list
// matches" (which can be far more than one page). Both go to the server as the
// same `selection` body, and every sentence here leads with the count, because
// the number is the thing a person checks before pressing the button.

import type { ProductStatus } from './products-data';

/** The list's narrowing, as the bulk endpoints take it. The site is the
 *  server's to add, from the site the list is scoped to. */
export interface ProductMatchQuery {
  q?: string;
  status?: ProductStatus;
  includeArchived?: boolean;
  productType?: string;
}

export type BulkTarget =
  | { kind: 'ids'; productIds: string[] }
  | { kind: 'match'; match: ProductMatchQuery; total: number };

/** The most one "everything that matches" write may cover (the server's
 *  BULK_MATCH_LIMIT). Mirrored rather than imported so the console does not
 *  pull a server schema package in for one number. */
export const MATCH_LIMIT = 2000;

export function targetCount(target: BulkTarget): number {
  return target.kind === 'ids' ? target.productIds.length : target.total;
}

/** The `selection` body every bulk endpoint takes. */
export function selectionBody(
  target: BulkTarget
): { productIds: string[] } | { match: ProductMatchQuery } {
  return target.kind === 'ids' ? { productIds: target.productIds } : { match: target.match };
}

/** "3 products" / "1 product", with a thousands separator. */
export function productCount(n: number): string {
  return n === 1 ? '1 product' : `${n.toLocaleString('en-US')} products`;
}

/** Verb agreement for "fit": "1 product fits", "3 products fit". */
export function fit(n: number): string {
  return n === 1 ? 'fits' : 'fit';
}

/** "1 already fits it." / "3 already fit it." */
function already(n: number): string {
  return `${n.toLocaleString('en-US')} already ${fit(n)} it.`;
}

/** "1 was" / "3 were", for the tails of result sentences. */
function were(n: number): string {
  return n === 1 ? '1 was' : `${n.toLocaleString('en-US')} were`;
}

/**
 * Whether to offer "everything that matches", and how to say it.
 *
 * Only once every row on the page is ticked, which is the moment someone has
 * shown they mean "all of these", and only when the list holds more than the
 * page. Past the limit it says so rather than offering a button that will fail.
 */
export function wholeResultOffer(input: {
  /** Every choosable row on the current page is ticked. */
  allOnPageChosen: boolean;
  chosen: number;
  total: number | undefined;
  narrowed: boolean;
}): { kind: 'offer'; label: string } | { kind: 'too-many'; text: string } | null {
  const { allOnPageChosen, chosen, total, narrowed } = input;
  if (total === undefined || !allOnPageChosen || total <= chosen) return null;
  if (total > MATCH_LIMIT) {
    return {
      kind: 'too-many',
      text: `${total.toLocaleString('en-US')} match. Narrow the list to ${MATCH_LIMIT.toLocaleString('en-US')} or fewer to choose them all at once.`,
    };
  }
  const n = total.toLocaleString('en-US');
  return { kind: 'offer', label: narrowed ? `Choose all ${n} that match` : `Choose all ${n}` };
}

/** What the bar says is chosen. */
export function chosenSummary(target: BulkTarget, narrowed: boolean): string {
  if (target.kind === 'ids') return `${productCount(target.productIds.length)} chosen`;
  const n = target.total.toLocaleString('en-US');
  return narrowed ? `All ${n} that match chosen` : `All ${n} products chosen`;
}

export interface CategoryBulkResult {
  changed: number;
  unchanged: number;
  skipped: number;
  categoryName: string;
}

export interface FitmentBulkResult {
  rules: number;
  productsChanged: number;
  productsUnchanged: number;
  skipped: number;
}

export interface ResultToast {
  title: string;
  description?: string;
}

function gone(skipped: number): string | null {
  return skipped > 0 ? `${were(skipped)} deleted before this ran, so nothing changed there.` : null;
}

function joined(parts: (string | null)[]): string | undefined {
  const kept = parts.filter((part): part is string => part !== null);
  return kept.length > 0 ? kept.join(' ') : undefined;
}

export function categoryAddedToast(result: CategoryBulkResult): ResultToast {
  const name = `“${result.categoryName}”`;
  return {
    title:
      result.changed > 0
        ? `${productCount(result.changed)} put in ${name}`
        : `Nothing to add: they were all in ${name} already`,
    description: joined([
      result.changed > 0 && result.unchanged > 0
        ? `${were(result.unchanged)} in it already.`
        : null,
      gone(result.skipped),
    ]),
  };
}

export function categoryRemovedToast(result: CategoryBulkResult): ResultToast {
  const name = `“${result.categoryName}”`;
  return {
    title:
      result.changed > 0
        ? `${productCount(result.changed)} taken out of ${name}`
        : `Nothing to take out: none of them were in ${name}`,
    description: joined([
      result.changed > 0 && result.unchanged > 0 ? `${were(result.unchanged)} not in it.` : null,
      gone(result.skipped),
    ]),
  };
}

export function fitmentAddedToast(result: FitmentBulkResult, what: string): ResultToast {
  return {
    title:
      result.productsChanged > 0
        ? `${productCount(result.productsChanged)} now ${fit(result.productsChanged)} ${what}`
        : `Nothing to add: they all fit ${what} already`,
    description: joined([
      result.productsChanged > 0 && result.productsUnchanged > 0
        ? `${already(result.productsUnchanged)}`
        : null,
      gone(result.skipped),
    ]),
  };
}

export function fitmentRemovedToast(result: FitmentBulkResult, what: string): ResultToast {
  // Taking off a whole list takes off everything in it, so after it they fit
  // nothing there: "no longer fit anything in Vehicle", not "everything in".
  const target = what.replace(/^everything in /i, 'anything in ');
  return {
    title:
      result.productsChanged > 0
        ? `${productCount(result.productsChanged)} no longer ${fit(result.productsChanged)} ${target}`
        : `Nothing to remove: none of them fit ${target}`,
    description: joined([
      result.productsChanged > 0 && result.productsUnchanged > 0
        ? `${were(result.productsUnchanged)} not set to fit it.`
        : null,
      gone(result.skipped),
    ]),
  };
}

/** "the L5P Duramax" / "3 entries": how a toast names what was added or removed. */
export function entriesPhrase(paths: string[]): string {
  if (paths.length === 1) return paths[0] ?? '';
  return `${paths.length.toLocaleString('en-US')} entries`;
}
