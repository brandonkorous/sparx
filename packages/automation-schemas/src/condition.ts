// Conditions — the optional "run only if…" filter on an automation (docs/81 §5.3).
//
// Conditions reference RESOLVED entity fields (e.g. `customer.type`), never raw
// trigger-payload keys — the engine hydrates the referenced entity first. This
// file owns only the wire shape; the field catalog + evaluation live in the
// engine (`@sparx/automation`).

import { z } from 'zod';

export const ConditionOperator = z.enum([
  'eq',
  'neq',
  'gt',
  'lt',
  'gte',
  'lte',
  'contains',
  'not_contains',
  'in',
  'not_in',
  'is_set',
  'is_not_set',
]);
export type ConditionOperator = z.infer<typeof ConditionOperator>;

// Operators that take no right-hand value (presence checks).
const VALUELESS_OPERATORS: ReadonlySet<ConditionOperator> = new Set(['is_set', 'is_not_set']);

export const Condition = z
  .object({
    /** Resolver-exposed field path, e.g. 'customer.type' | 'order.total'. */
    field: z.string().min(1).max(255),
    operator: ConditionOperator,
    /**
     * Required for every operator except is_set / is_not_set (enforced by the
     * refine below). `.optional()` because zod v4 treats a bare `z.unknown()` as
     * non-optional — a missing key would error before the refine runs.
     */
    value: z.unknown().optional(),
  })
  .refine((c) => VALUELESS_OPERATORS.has(c.operator) || c.value !== undefined, {
    message: 'this operator requires a value',
    path: ['value'],
  });
export type Condition = z.infer<typeof Condition>;

// Multiple conditions combine with AND by default; OR is supported. A single
// flat group is the MVP shape (docs/81 §5.3) — nested groups are a Phase 6 item.
export const ConditionGroup = z.object({
  logic: z.enum(['AND', 'OR']).default('AND'),
  conditions: z.array(Condition).max(50).default([]),
});
export type ConditionGroup = z.infer<typeof ConditionGroup>;

/** The empty group — always passes (no filter). */
export const EMPTY_CONDITION_GROUP: ConditionGroup = { logic: 'AND', conditions: [] };
