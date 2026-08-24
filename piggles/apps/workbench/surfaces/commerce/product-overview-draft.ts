// The overview tab's draft: what it holds, and how it works out what moved.
//
// One shape, so "has anything changed" is one comparison rather than eight, and
// Save sends only what actually did.

import type { ProductDeposit } from './made-to-order-data';
import type { Product, ProductPatch } from './products-data';

/** Everything this tab holds, so "has anything changed" is one comparison
 *  rather than eight, and Save sends only what actually moved. */
export interface Draft {
  title: string;
  handle: string;
  description: string;
  vendor: string;
  productType: string;
  tags: string[];
  /** Empty means every site — the platform's own default. */
  propertyIds: string[];
  categoryIds: string[];
  /**
   * ONLY the collections a person picked.
   *
   * The product record also reports the ones a collection's RULE matched, and
   * they are deliberately not in the draft: the save writes this array as the
   * complete hand-picked set, so including a rule membership would re-save it
   * as a manual pin and freeze the product into a smart collection for good.
   * See product-filing.tsx.
   */
  manualCollectionIds: string[];
  /** Made to order (issue 026) — notice, deposit, and the daily allowance. */
  orderAheadDays: number | null;
  deposit: ProductDeposit;
  dailyLimit: number | null;
}

export function toDraft(product: Product): Draft {
  return {
    title: product.title,
    handle: product.handle,
    description: product.description ?? '',
    vendor: product.vendor ?? '',
    productType: product.productType ?? '',
    tags: product.tags,
    propertyIds: product.propertyIds,
    categoryIds: product.categoryIds,
    manualCollectionIds: product.collectionMemberships
      .filter((membership) => membership.addedBy === 'manual')
      .map((membership) => membership.collectionId),
    orderAheadDays: product.orderAheadDays,
    deposit: product.deposit,
    dailyLimit: product.dailyLimit,
  };
}

/** A deposit the server would refuse — a set amount of nothing — read back as
 *  no deposit. The field can reach zero on the way to a real number, and
 *  sending it would fail the save rather than describe what she meant. */
function usableDeposit(deposit: ProductDeposit): ProductDeposit {
  if (deposit.type === 'amount' && deposit.amountCents <= 0) return { type: 'none' };
  if (deposit.type === 'percent' && deposit.percent <= 0) return { type: 'none' };
  return deposit;
}

function sameDeposit(a: ProductDeposit, b: ProductDeposit): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function sameList(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

/** Order-insensitive, for the two fields where order carries no meaning a
 *  person can see. Ticking a category, unticking it and ticking it again ends
 *  up in a different array order than it started in — comparing positionally
 *  would leave the pane claiming unsaved work over a choice that did not
 *  change, and the dirty dot is only worth anything while it is honest. */
function sameSet(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const seen = new Set(b);
  return a.every((value) => seen.has(value));
}

/** Only what moved. Sending the whole form back would rewrite fields nobody
 *  touched, and `null` vs `""` is the difference between "cleared" and "blank
 *  string" on every nullable column here. */
export function buildPatch(draft: Draft, saved: Draft): ProductPatch {
  const patch: ProductPatch = {};
  if (draft.title !== saved.title) patch.title = draft.title.trim();
  if (draft.handle !== saved.handle) patch.handle = draft.handle;
  if (draft.description !== saved.description) {
    patch.description = draft.description.trim() === '' ? null : draft.description;
  }
  if (draft.vendor !== saved.vendor) {
    patch.vendor = draft.vendor.trim() === '' ? null : draft.vendor.trim();
  }
  if (draft.productType !== saved.productType) {
    patch.productType = draft.productType.trim() === '' ? null : draft.productType.trim();
  }
  if (!sameList(draft.tags, saved.tags)) patch.tags = draft.tags;
  if (!sameList(draft.propertyIds, saved.propertyIds)) patch.propertyIds = draft.propertyIds;
  if (!sameSet(draft.categoryIds, saved.categoryIds)) patch.categoryIds = draft.categoryIds;
  // `collectionIds` on the wire means "the complete HAND-PICKED set" — the
  // server replaces only the manual rows and leaves rule-driven membership to
  // the indexer. Sending the draft's manual list is therefore exactly right,
  // and sending anything wider would convert a rule match into a permanent pin.
  if (!sameSet(draft.manualCollectionIds, saved.manualCollectionIds)) {
    patch.collectionIds = draft.manualCollectionIds;
  }
  if (draft.orderAheadDays !== saved.orderAheadDays) patch.orderAheadDays = draft.orderAheadDays;
  if (draft.dailyLimit !== saved.dailyLimit) patch.dailyLimit = draft.dailyLimit;
  const deposit = usableDeposit(draft.deposit);
  if (!sameDeposit(deposit, saved.deposit)) patch.deposit = deposit;
  return patch;
}
