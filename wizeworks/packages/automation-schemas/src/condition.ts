// Conditions — the optional "run only if…" filter on an automation (docs/81 §5.3).
//
// Conditions reference RESOLVED entity fields (e.g. `customer.type`), never raw
// trigger-payload keys — the engine hydrates the referenced entity first. This
// file owns only the wire shape; the field catalog + evaluation live in the
// engine (`@wizeworks/automation`).
//
// A ConditionGroup combines leaf conditions AND/OR nested sub-groups, so a rule
// can express mixed precedence like `A AND (B OR C)`. Nesting is BOUNDED to
// `MAX_CONDITION_DEPTH` levels and built as explicit finite levels (NOT `z.lazy`)
// on purpose: the schema stays non-recursive, so it converts to a finite,
// `$ref`-free JSON-Schema that every consumer handles safely (REST validation,
// the MCP tool registration, AI SDK clients), and an over-deep tree is REJECTED
// at the boundary rather than silently accepted. A flat (all-leaf) group is the
// original shape, so existing stored automations parse unchanged.

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

/** Max nesting: the root group plus up to two levels of sub-groups. Deeper than
 *  this is unreadable in a no-code builder; a flat group is depth 1. */
export const MAX_CONDITION_DEPTH = 3;

const groupOf = (child: z.ZodTypeAny) =>
  z.object({
    logic: z.enum(['AND', 'OR']).default('AND'),
    conditions: z.array(child).max(50).default([]),
  });

// Explicit finite levels (deepest → shallowest). The deepest group accepts only
// leaf conditions; each shallower level additionally accepts the level below it.
// `Depth{n}Group ⊆ Depth{n+1}Group` structurally, so a sub-group is a valid
// ConditionGroup with no cast — the evaluator/UI recurse uniformly.
const Depth1Group = groupOf(Condition);
const Depth2Group = groupOf(z.union([Condition, Depth1Group]));
const Depth3Group = groupOf(z.union([Condition, Depth2Group]));

// Multiple conditions combine with AND (default) or OR; a child may itself be a
// nested group, giving mixed precedence up to MAX_CONDITION_DEPTH levels.
export const ConditionGroup = Depth3Group;
export type ConditionGroup = z.infer<typeof ConditionGroup>;

/** A child of a group: a leaf condition or a nested sub-group. */
export type ConditionNode = ConditionGroup['conditions'][number];

/** Runtime guard — a node is a nested group iff it carries a `conditions` array
 *  (a leaf condition never does). Works at every nesting level. */
export function isConditionGroup(node: unknown): node is ConditionGroup {
  return (
    typeof node === 'object' &&
    node !== null &&
    'conditions' in node &&
    Array.isArray((node as { conditions?: unknown }).conditions)
  );
}

/** The empty group — always passes (no filter). */
export const EMPTY_CONDITION_GROUP: ConditionGroup = { logic: 'AND', conditions: [] };
