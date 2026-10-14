import type { ConditionOperatorDef } from './types';

export const CONDITION_OPERATORS: readonly ConditionOperatorDef[] = [
  { value: 'eq', label: 'is exactly' },
  { value: 'neq', label: 'is not' },
  { value: 'gt', label: 'is more than' },
  { value: 'lt', label: 'is less than' },
  { value: 'gte', label: 'is at least' },
  { value: 'lte', label: 'is at most' },
  { value: 'contains', label: 'contains' },
  { value: 'not_contains', label: 'does not contain' },
  { value: 'in', label: 'is one of', list: true },
  { value: 'not_in', label: 'is none of', list: true },
  { value: 'is_set', label: 'has any value', valueless: true },
  { value: 'is_not_set', label: 'is empty', valueless: true },
];

export function operatorDef(op: string): ConditionOperatorDef | undefined {
  return CONDITION_OPERATORS.find((o) => o.value === op);
}

// The details a condition can check, in words, live in `../condition-fields.ts`.
