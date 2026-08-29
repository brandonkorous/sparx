'use client';

// One row's worth of edits, and what to send when it is saved.

import type { Variant, VariantPatch } from '../products-data';

export interface VariantDraft {
  sku: string;
  barcode: string;
  /** In whole currency units — what the operator types. Cents on the wire. */
  price: number;
  compareAt: number | null;
  cost: number | null;
  weightGrams: number | null;
  lengthMm: number | null;
  widthMm: number | null;
  heightMm: number | null;
  inventoryPolicy: string;
  requiresShipping: boolean;
  /** null means "whatever the product says". */
  fulfillmentType: string | null;
}

export function toDraft(variant: Variant): VariantDraft {
  return {
    sku: variant.sku,
    barcode: variant.barcode ?? '',
    price: variant.priceCents / 100,
    compareAt: variant.compareAtPriceCents === null ? null : variant.compareAtPriceCents / 100,
    cost: variant.costCents === null ? null : variant.costCents / 100,
    weightGrams: variant.weightGrams,
    lengthMm: variant.lengthMm,
    widthMm: variant.widthMm,
    heightMm: variant.heightMm,
    inventoryPolicy: variant.inventoryPolicy,
    requiresShipping: variant.requiresShipping,
    fulfillmentType: variant.fulfillmentType,
  };
}

export function cents(value: number): number {
  return Math.round(value * 100);
}

/** Only what moved. Sending the whole row back would rewrite fields nobody
 *  touched, and on a nullable column `undefined` and `null` are the difference
 *  between "leave it alone" and "clear it". */
export function buildPatch(draft: VariantDraft, saved: VariantDraft): VariantPatch {
  const patch: VariantPatch = {};
  if (draft.price !== saved.price) patch.priceCents = cents(draft.price);
  if (draft.compareAt !== saved.compareAt) {
    patch.compareAtPriceCents = draft.compareAt === null ? null : cents(draft.compareAt);
  }
  if (draft.cost !== saved.cost) {
    patch.costCents = draft.cost === null ? null : cents(draft.cost);
  }
  if (draft.barcode.trim() !== saved.barcode.trim()) {
    patch.barcode = draft.barcode.trim() === '' ? null : draft.barcode.trim();
  }
  if (draft.weightGrams !== saved.weightGrams) patch.weight = draft.weightGrams;
  if (
    draft.lengthMm !== saved.lengthMm ||
    draft.widthMm !== saved.widthMm ||
    draft.heightMm !== saved.heightMm
  ) {
    patch.dimensions =
      draft.lengthMm && draft.widthMm && draft.heightMm
        ? { lengthMm: draft.lengthMm, widthMm: draft.widthMm, heightMm: draft.heightMm }
        : null;
  }
  if (draft.inventoryPolicy !== saved.inventoryPolicy)
    patch.inventoryPolicy = draft.inventoryPolicy;
  if (draft.requiresShipping !== saved.requiresShipping) {
    patch.requiresShipping = draft.requiresShipping;
  }
  if (draft.fulfillmentType !== saved.fulfillmentType)
    patch.fulfillmentType = draft.fulfillmentType;
  return patch;
}

export function changed(draft: VariantDraft, saved: VariantDraft): boolean {
  return draft.sku.trim() !== saved.sku || Object.keys(buildPatch(draft, saved)).length > 0;
}

/** All three measurements or none — the server rejects a partial set, and
 *  half a parcel size is not a measurement of anything. */
function dimensionProblem(draft: VariantDraft): string | null {
  const given = [draft.lengthMm, draft.widthMm, draft.heightMm].filter(
    (value) => value !== null && value > 0
  ).length;
  if (given === 0 || given === 3) return null;
  return 'Give all three measurements, or leave all three blank.';
}

/** Codes are unique across the whole business, and the server says so with a
 *  clear conflict — but a clash WITHIN this one save is worth catching before
 *  half the rows are written. */
export function draftProblem(draft: VariantDraft): string | null {
  if (draft.sku.trim() === '') return 'Give this version a code.';
  if (!/^[A-Za-z0-9._\-/]+$/.test(draft.sku.trim())) {
    return 'A code can use letters, digits, dots, dashes, underscores and slashes — no spaces.';
  }
  if (draft.barcode.trim() !== '' && !/^[0-9]{8,14}$/.test(draft.barcode.trim())) {
    return 'A barcode is 8 to 14 digits, with nothing else in it.';
  }
  return dimensionProblem(draft);
}
