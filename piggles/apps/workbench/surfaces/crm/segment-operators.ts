'use client';

// THE OPERATOR VOCABULARY — how a field is compared, in plain language.
//
// A field's ValueKind decides which operators it offers, and the LABEL is tuned
// per kind: the same `gt` reads "is after" on a date and "is more than" on a
// number, because those are the words a person would use.
//
// Each function keeps the stored operator in the list even when the builder
// would not offer it, so a rule authored elsewhere still renders.

import type { SegmentFieldPath, SegmentOperator } from '@wizeworks/crm-schemas';
import { fieldMeta, type CustomFieldIndex, type ValueKind } from './segment-fields';

const OPERATORS_BY_KIND: Record<ValueKind, SegmentOperator[]> = {
  enum: ['eq', 'neq'],
  boolean: ['eq', 'neq'],
  text: ['eq', 'neq', 'contains', 'not_contains', 'is_null', 'is_not_null'],
  number: ['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'between', 'is_null', 'is_not_null'],
  date: ['gt', 'gte', 'lt', 'lte', 'between', 'is_null', 'is_not_null'],
  tags: ['contains', 'not_contains'],
  rep: ['eq', 'neq', 'is_null', 'is_not_null'],
  account: ['eq', 'neq', 'is_null', 'is_not_null'],
};

/** The operators offered for a field, always including `current` so a stored
 *  operator the builder would not offer still renders. */
export function operatorOptionsIncluding(
  field: SegmentFieldPath,
  current: SegmentOperator,
  custom: CustomFieldIndex = {}
): { value: SegmentOperator; label: string }[] {
  const kind = fieldMeta(field, custom).kind;
  const base = OPERATORS_BY_KIND[kind];
  const ops = base.includes(current) ? base : [...base, current];
  return ops.map((op) => ({ value: op, label: operatorLabel(op, kind) }));
}

export function defaultOperator(
  field: SegmentFieldPath,
  custom: CustomFieldIndex = {}
): SegmentOperator {
  return OPERATORS_BY_KIND[fieldMeta(field, custom).kind][0] ?? 'eq';
}

/** Plain-language operator label, tuned per value kind (a date reads "is after",
 *  a number reads "is more than"). */
export function operatorLabel(op: SegmentOperator, kind: ValueKind): string {
  const dateLabels: Partial<Record<SegmentOperator, string>> = {
    gt: 'is after',
    gte: 'is on or after',
    lt: 'is before',
    lte: 'is on or before',
    between: 'is between',
  };
  const dateLabel = dateLabels[op];
  if (kind === 'date' && dateLabel) return dateLabel;
  switch (op) {
    case 'eq':
      return 'is';
    case 'neq':
      return 'is not';
    case 'gt':
      return 'is more than';
    case 'gte':
      return 'is at least';
    case 'lt':
      return 'is less than';
    case 'lte':
      return 'is at most';
    case 'in':
      return 'is one of';
    case 'not_in':
      return 'is not one of';
    case 'contains':
      return kind === 'tags' ? 'includes' : 'contains';
    case 'not_contains':
      return kind === 'tags' ? 'does not include' : 'does not contain';
    case 'is_null':
      return 'is empty';
    case 'is_not_null':
      return 'is set';
    case 'between':
      return 'is between';
  }
}

/** Whether this operator needs a value control at all. */
export function operatorTakesValue(op: SegmentOperator): boolean {
  return op !== 'is_null' && op !== 'is_not_null';
}

export function operatorIsRange(op: SegmentOperator): boolean {
  return op === 'between';
}

export function operatorIsList(op: SegmentOperator): boolean {
  return op === 'in' || op === 'not_in';
}
