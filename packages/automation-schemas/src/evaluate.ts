// Condition evaluator (docs/81 §5.3).
//
// Pure: a `ConditionGroup` + a flat resolved-field map → boolean. No DB, no side
// effects. An empty group always passes (no filter). Combines with AND (default)
// or OR, and a child may itself be a nested sub-group (mixed precedence like
// `A AND (B OR C)`) — recursed here.
//
// WHY THIS LIVES IN THE SCHEMA PACKAGE AND NOT IN THE ENGINE.
//
// `ConditionGroup` is now the filter language of THREE things — automations, the
// report builder (docs/144 §8) and scoring (§10) — which was the whole point of
// reusing it: a business that has written one automation condition already knows
// how to filter a report and how to write a scoring rule.
//
// That only holds if all three AGREE on what a condition means. When the
// evaluator sat inside `@sparx/automation`, the packages that could not depend on
// the engine had exactly two options — take the engine as a dependency for one
// pure function, or write their own comparison semantics. The second is how
// `contains` comes to mean something subtly different in scoring than in
// automations, and nobody finds out until a customer's numbers disagree with
// their rules. The shape and its meaning ship together.

import { type Condition, type ConditionGroup, isConditionGroup } from './condition';

/**
 * Flat, resolver-exposed field map keyed by dotted path (e.g. `customer.type`,
 * `order.total`). Conditions reference these resolved fields, never raw
 * trigger-payload keys.
 */
export type ResolvedFields = Record<string, unknown>;

export function evaluateConditions(group: ConditionGroup, fields: ResolvedFields): boolean {
  if (group.conditions.length === 0) return true;
  const verdicts = group.conditions.map((node) =>
    // A child is either a nested sub-group (recurse) or a leaf condition. The
    // guard narrows the group case; the leaf cast is sound (guard ruled out a group).
    isConditionGroup(node)
      ? evaluateConditions(node, fields)
      : evaluateOne(node as Condition, fields)
  );
  return group.logic === 'OR' ? verdicts.some(Boolean) : verdicts.every(Boolean);
}

function evaluateOne(c: Condition, fields: ResolvedFields): boolean {
  const actual = fields[c.field];
  switch (c.operator) {
    case 'is_set':
      return actual !== undefined && actual !== null;
    case 'is_not_set':
      return actual === undefined || actual === null;
    case 'eq':
      return looseEq(actual, c.value);
    case 'neq':
      return !looseEq(actual, c.value);
    case 'gt':
      return compare(actual, c.value) > 0;
    case 'gte':
      return compare(actual, c.value) >= 0;
    case 'lt':
      return compare(actual, c.value) < 0;
    case 'lte':
      return compare(actual, c.value) <= 0;
    case 'contains':
      return contains(actual, c.value);
    case 'not_contains':
      return !contains(actual, c.value);
    case 'in':
      return inList(actual, c.value);
    case 'not_in':
      return !inList(actual, c.value);
    default:
      return assertNever(c.operator);
  }
}

// ─── comparison helpers ────────────────────────────────────────────────────

/** Coerce to a number for `eq`/`in` membership — numbers + numeric strings only
 *  (never date parsing, so the string "2020" doesn't accidentally match epoch). */
function asNumber(v: unknown): number | null {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v === 'bigint') return Number(v);
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/** Coerce to an orderable scalar for `gt`/`lt` — numbers, dates, ISO date strings. */
function asOrderable(v: unknown): number | null {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v === 'bigint') return Number(v);
  if (v instanceof Date) return v.getTime();
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
    const t = Date.parse(v);
    return Number.isNaN(t) ? null : t;
  }
  return null;
}

/** Strict-ish equality with numeric coercion (so `total = '100'` matches 100). */
function looseEq(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  const na = asNumber(a);
  const nb = asNumber(b);
  if (na !== null && nb !== null) return na === nb;
  return false;
}

/** Returns NaN when either side isn't orderable → every >/< comparison is false. */
function compare(a: unknown, b: unknown): number {
  const x = asOrderable(a);
  const y = asOrderable(b);
  if (x === null || y === null) return Number.NaN;
  return x - y;
}

function contains(actual: unknown, value: unknown): boolean {
  if (typeof actual === 'string') return actual.includes(String(value));
  if (Array.isArray(actual)) return actual.some((el) => looseEq(el, value));
  return false;
}

function inList(actual: unknown, value: unknown): boolean {
  if (!Array.isArray(value)) return false;
  return value.some((el) => looseEq(actual, el));
}

function assertNever(x: never): never {
  throw new Error(`unhandled condition operator: ${String(x)}`);
}
