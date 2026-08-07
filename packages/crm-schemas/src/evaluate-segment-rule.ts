// evaluateSegmentRule — pure boolean evaluation of a SegmentRule tree
// against a CustomerProjection. Used by:
//   • the segment-evaluator consumer (incremental segment_members updates)
//   • segmentService.previewCount (rule-editor preview count)
//   • segmentService.recomputeFull (nightly safety-net batch)
//
// Same function, three callers — no rule-evaluation drift between dashboard
// preview and production materialization.

import type { PredicateLeaf, SegmentFieldPath, SegmentOperator, SegmentRule } from './segment-rule';

// Projection is typed loosely here so the evaluator stays a pure JS function
// — the Zod schema lives next to the field whitelist in segment-rule.ts.
// In practice the consumer passes the typed projection from the schema; the
// `unknown` boundary is just so we don't have a circular dep at import time.
export interface RuleProjection {
  customer: Record<string, unknown>;
  b2bAccount: Record<string, unknown> | null;
  email: Record<string, unknown>;
  /**
   * Tenant-declared property bags, keyed by object (docs/144 §3.4) — so
   * `custom.contact.warrantyExpires` reads `custom.contact.warrantyExpires`
   * here. Optional: a projection built before this feature existed, or for a
   * tenant that has declared nothing, simply omits it and every custom
   * predicate reads null (and so matches only `is_null`).
   */
  custom?: {
    contact?: Record<string, unknown>;
    company?: Record<string, unknown>;
    deal?: Record<string, unknown>;
  };
}

export function evaluateSegmentRule(rule: SegmentRule, projection: RuleProjection): boolean {
  switch (rule.kind) {
    case 'predicate':
      return evaluatePredicate(rule, projection);
    case 'and':
      return rule.children.every((c) => evaluateSegmentRule(c, projection));
    case 'or':
      return rule.children.some((c) => evaluateSegmentRule(c, projection));
    case 'not':
      return !evaluateSegmentRule(rule.child, projection);
    default: {
      // Exhaustiveness check — any new rule kind landing without an
      // evaluator branch fails at type-check time, not at runtime.
      const _exhaustive: never = rule;
      void _exhaustive;
      return false;
    }
  }
}

function evaluatePredicate(leaf: PredicateLeaf, projection: RuleProjection): boolean {
  const fieldValue = readField(leaf.field, projection);
  return applyOperator(leaf.op, fieldValue, leaf.value);
}

/**
 * Walk the dotted path into the projection.
 *
 * Two shapes: a two-part spine path (`customer.totalSpent`) and a three-part
 * tenant-declared one (`custom.contact.warrantyExpires`). A missing bag reads
 * null rather than throwing — a business that removed a property yesterday must
 * not have every segment referencing it start erroring today.
 */
function readField(field: SegmentFieldPath, projection: RuleProjection): unknown {
  const parts = field.split('.');

  if (parts[0] === 'custom') {
    const objectKey = parts[1] as keyof NonNullable<RuleProjection['custom']>;
    const propertyKey = parts[2] ?? '';
    const bag = projection.custom?.[objectKey];
    if (bag == null) return null;
    const raw = bag[propertyKey];
    // A `currency` property compares on its amount — "spend over 500" should
    // work without the rule author knowing money is stored as a pair.
    if (raw && typeof raw === 'object' && !Array.isArray(raw) && 'amount' in raw) {
      return raw.amount;
    }
    return raw ?? null;
  }

  const root = parts[0] as keyof RuleProjection;
  const key = parts[1] ?? '';
  // The `custom` branch above already returned, so what is left is one of the
  // flat projection groups — a bag of values keyed by property name.
  const obj: Record<string, unknown> | null | undefined =
    root === 'custom' ? null : projection[root];
  if (obj == null) return null;
  return obj[key];
}

function applyOperator(op: SegmentOperator, fieldValue: unknown, ruleValue: unknown): boolean {
  switch (op) {
    case 'eq':
      return looseEqual(fieldValue, ruleValue);
    case 'neq':
      return !looseEqual(fieldValue, ruleValue);
    case 'gt':
      return cmpNumber(fieldValue, ruleValue, (a, b) => a > b);
    case 'gte':
      return cmpNumber(fieldValue, ruleValue, (a, b) => a >= b);
    case 'lt':
      return cmpNumber(fieldValue, ruleValue, (a, b) => a < b);
    case 'lte':
      return cmpNumber(fieldValue, ruleValue, (a, b) => a <= b);
    case 'in':
      return Array.isArray(ruleValue) && ruleValue.some((v) => looseEqual(fieldValue, v));
    case 'not_in':
      return Array.isArray(ruleValue) && !ruleValue.some((v) => looseEqual(fieldValue, v));
    case 'contains': {
      // Two interpretations: text substring vs array-contains-element.
      if (Array.isArray(fieldValue)) {
        return fieldValue.some((v) => looseEqual(v, ruleValue));
      }
      if (typeof fieldValue === 'string' && typeof ruleValue === 'string') {
        return fieldValue.toLowerCase().includes(ruleValue.toLowerCase());
      }
      return false;
    }
    case 'not_contains': {
      if (Array.isArray(fieldValue)) {
        return !fieldValue.some((v) => looseEqual(v, ruleValue));
      }
      if (typeof fieldValue === 'string' && typeof ruleValue === 'string') {
        return !fieldValue.toLowerCase().includes(ruleValue.toLowerCase());
      }
      return true; // Field isn't a string/array — treat as not-contains.
    }
    case 'is_null':
      return fieldValue == null;
    case 'is_not_null':
      return fieldValue != null;
    case 'between': {
      if (!Array.isArray(ruleValue) || ruleValue.length !== 2) return false;
      const tuple = ruleValue as [unknown, unknown];
      const min = tuple[0];
      const max = tuple[1];
      return (
        cmpNumber(fieldValue, min, (a, b) => a >= b) && cmpNumber(fieldValue, max, (a, b) => a <= b)
      );
    }
    default: {
      const _exhaustive: never = op;
      void _exhaustive;
      return false;
    }
  }
}

/** Loose equality across the JSON types: strings, numbers, booleans, null.
 *  Dates are compared as their ISO string forms. */
function looseEqual(a: unknown, b: unknown): boolean {
  if (a == null || b == null) return a == null && b == null;
  if (a instanceof Date) return a.toISOString() === b;
  if (b instanceof Date) return b.toISOString() === a;
  return a === b;
}

/**
 * Coerce a value to a comparable number.
 *
 * The projection stores dates as ISO STRINGS (see CustomerProjection), so a naive
 * `Number('2026-06-15T…')` is `NaN` and every date `gt/gte/lt/lte/between` used to
 * silently fail in all three callers (dashboard preview, workbench builder, email
 * automations). This handles the three real shapes a rule can carry:
 *   • a `Date`          → its epoch ms
 *   • a `number`        → itself
 *   • a numeric string  → parsed as a number (so `daysSinceLastOrder > "365"` works)
 *   • any other string  → `Date.parse` (so an ISO date compares by timestamp)
 * Anything genuinely unparseable stays `NaN`, and `cmpNumber` treats that as false —
 * the same safety net as before.
 */
function toComparable(value: unknown): number {
  if (typeof value === 'number') return value;
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed === '') return NaN;
    // A bare integer/decimal is a number, not a date — keep numeric semantics.
    if (/^-?\d+(\.\d+)?$/.test(trimmed)) return Number(trimmed);
    return Date.parse(trimmed); // NaN when not a date either
  }
  return NaN;
}

/** Compare two values as numbers (or timestamps) under the given comparator.
 *  Returns false if either side can't be coerced to a finite number. */
function cmpNumber(a: unknown, b: unknown, op: (a: number, b: number) => boolean): boolean {
  const na = toComparable(a);
  const nb = toComparable(b);
  if (!Number.isFinite(na) || !Number.isFinite(nb)) return false;
  return op(na, nb);
}
