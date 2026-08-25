// The conditions a person can add, in their words.
//
// The audience is a shop owner, so a field is named for what it IS to them and
// an operator is a whole English phrase. The engineering vocabulary (vendor,
// product_type, predicate, between-tuple) stays entirely off-screen.

import type { CollectionPredicate } from './collections-data';

/* ── The fields a person can add, in their words ────────────────────────── */

export type AddableField = 'title' | 'vendor' | 'product_type' | 'tag' | 'price' | 'inventory';

export const FIELD_LABELS: Record<AddableField, string> = {
  title: 'Product name',
  vendor: 'Brand',
  product_type: 'Kind of product',
  tag: 'Label',
  price: 'Price',
  inventory: 'Stock',
};

export const FIELD_ORDER: AddableField[] = [
  'title',
  'vendor',
  'product_type',
  'tag',
  'price',
  'inventory',
];

/** Operator → the English phrase shown for it, per field. Exactly the ops the
 *  schema's discriminated union allows for each field — nothing invented. */
export const OP_LABELS: Record<AddableField, Record<string, string>> = {
  title: {
    contains: 'contains',
    equals: 'is exactly',
    starts_with: 'starts with',
    ends_with: 'ends with',
  },
  vendor: { equals: 'is', in: 'is any of' },
  product_type: { equals: 'is', in: 'is any of' },
  tag: {
    equals: 'has the label',
    any_of: 'has any of these labels',
    all_of: 'has all of these labels',
    none_of: 'has none of these labels',
  },
  price: {
    lt: 'is less than',
    lte: 'is at most',
    gt: 'is more than',
    gte: 'is at least',
    between: 'is between',
  },
  inventory: {
    in_stock: 'is in stock',
    out_of_stock: 'is out of stock',
    low_stock: 'is running low',
  },
};

/** A fresh condition for a field, valid enough to render — its value may still be
 *  empty, which the save-time schema check catches with a friendly message. */
export function defaultPredicate(field: AddableField): CollectionPredicate {
  switch (field) {
    case 'title':
      return { field: 'title', op: 'contains', value: '' };
    case 'vendor':
      return { field: 'vendor', op: 'equals', value: '' };
    case 'product_type':
      return { field: 'product_type', op: 'equals', value: '' };
    case 'tag':
      return { field: 'tag', op: 'any_of', value: [] };
    case 'price':
      return { field: 'price', op: 'gte', value: 0 };
    case 'inventory':
      return { field: 'inventory', op: 'in_stock', value: true };
  }
}

/** Whether a value should be a list (multi) or a single string, for the fields
 *  whose value type depends on the operator. */
export function opWantsList(field: AddableField, op: string): boolean {
  if (field === 'vendor' || field === 'product_type') return op === 'in';
  if (field === 'tag') return op !== 'equals';
  return false;
}

export function isFitment(predicate: CollectionPredicate): boolean {
  return predicate.field === 'fitment';
}
