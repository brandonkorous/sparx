// Pure template evaluation (docs/handoffs/sitebuilder-custom-section-template-spec.md §4).
//
// The render-time half of the custom-section interpreter that DOESN'T need
// React: resolve a value-expression against a scope, evaluate a condition,
// resolve a (possibly-bound) variant prop to a valid token. Kept here (zod-only,
// React-free) so it is unit-testable and shared by the storefront interpreter
// AND the dashboard preview. The storefront layer only adds JSX emission, media
// URL resolution, the icon subset, and RichText sanitization on top of these.
//
// Everything here is a pure function over data — no I/O, no side effects, no
// code execution. Resolution is total: an absent/illegal path yields '' (or the
// declared default), never throws.

import type { BindExpr, Condition, ValueExpr, ValueFormat } from './section-template';

/** Read-only render context (the tenant frame the storefront already has). */
export interface EvalContext {
  currency: string;
  locale: string;
  tenantSlug: string;
}

/** The data a template resolves against at a given point in the walk. */
export interface EvalScope {
  /** The section's validated config (`field.*`). */
  field: Record<string, unknown>;
  /** The current Repeater item (`item.*`), when inside one. */
  item?: Record<string, unknown>;
  /** The current Repeater index (`index`), when inside one. */
  index?: number;
  /** The bound product (`product.*`), for product-scoped sections. */
  product?: Record<string, unknown>;
  /** The bound collection (`collection.*`), for collection-scoped sections. */
  collection?: Record<string, unknown>;
}

/** Walk a dotted path (object keys + numeric array indices). Total: missing → undefined. */
function getIn(obj: unknown, path: string): unknown {
  if (!path) return obj;
  let cur: unknown = obj;
  for (const key of path.split('.')) {
    if (cur == null) return undefined;
    if (Array.isArray(cur)) {
      const idx = Number(key);
      cur = Number.isInteger(idx) ? cur[idx] : undefined;
    } else if (typeof cur === 'object') {
      cur = (cur as Record<string, unknown>)[key];
    } else {
      return undefined;
    }
  }
  return cur;
}

/** Resolve a scope path (`field.x`, `item.y`, `index`, `ctx.currency`,
 *  `product.*`, `collection.*`) to its raw value, or undefined. */
export function lookupPath(path: string, scope: EvalScope, ctx: EvalContext): unknown {
  if (path === 'index') return scope.index;
  const dot = path.indexOf('.');
  const root = dot === -1 ? path : path.slice(0, dot);
  const rest = dot === -1 ? '' : path.slice(dot + 1);
  switch (root) {
    case 'field':
      return getIn(scope.field, rest);
    case 'item':
      return scope.item ? getIn(scope.item, rest) : undefined;
    case 'product':
      return scope.product ? getIn(scope.product, rest) : undefined;
    case 'collection':
      return scope.collection ? getIn(scope.collection, rest) : undefined;
    case 'ctx':
      if (rest === 'currency') return ctx.currency;
      if (rest === 'locale') return ctx.locale;
      if (rest === 'tenantSlug') return ctx.tenantSlug;
      return undefined;
    default:
      return undefined;
  }
}

/** Coerce a resolved scalar to display text. Objects/arrays are not renderable
 *  text, so they yield '' rather than `[object Object]`. */
function toText(v: unknown): string {
  if (v == null) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'boolean' || typeof v === 'bigint') return String(v);
  if (v instanceof Date) return v.toISOString();
  return '';
}

/** Apply a closed formatter to a resolved value. Falls back to plain text on a
 *  non-numeric/undated input so a misconfigured format never throws. */
export function formatValue(v: unknown, format: ValueFormat | undefined, ctx: EvalContext): string {
  if (v == null) return '';
  switch (format) {
    case 'money': {
      const n = typeof v === 'number' ? v : Number(v);
      if (!Number.isFinite(n)) return toText(v);
      try {
        return new Intl.NumberFormat(ctx.locale, {
          style: 'currency',
          currency: ctx.currency,
        }).format(n);
      } catch {
        return toText(v);
      }
    }
    case 'number': {
      const n = typeof v === 'number' ? v : Number(v);
      if (!Number.isFinite(n)) return toText(v);
      return new Intl.NumberFormat(ctx.locale).format(n);
    }
    case 'date': {
      const d = v instanceof Date ? v : typeof v === 'number' ? new Date(v) : new Date(toText(v));
      if (Number.isNaN(d.getTime())) return toText(v);
      return d.toLocaleDateString(ctx.locale);
    }
    case 'none':
    case undefined:
    default:
      return toText(v);
  }
}

/** Resolve a value-expression (literal | $bind | $concat) to a string. */
export function resolveValue(expr: ValueExpr, scope: EvalScope, ctx: EvalContext): string {
  if (typeof expr === 'string') return expr;
  if ('$bind' in expr) {
    const v = lookupPath(expr.$bind, scope, ctx);
    if (v == null || v === '') return expr.default ?? '';
    return formatValue(v, expr.format, ctx);
  }
  return expr.$concat.map((part) => resolveValue(part, scope, ctx)).join('');
}

/** Evaluate an `If` condition. `$exists` is truthy/non-empty; `$eq` compares by
 *  string coercion so a select value ("3") matches a literal. */
export function evalCondition(cond: Condition, scope: EvalScope, ctx: EvalContext): boolean {
  if ('$exists' in cond) {
    const v = lookupPath(cond.$exists, scope, ctx);
    if (v == null || v === '') return false;
    if (Array.isArray(v)) return v.length > 0;
    return true;
  }
  const [path, expected] = cond.$eq;
  return toText(lookupPath(path, scope, ctx)) === toText(expected);
}

/** Resolve a variant prop that may be a literal token OR a binding, to a member
 *  of `allowed` — falling back to `fallback` when the resolved value isn't one
 *  (the render-time guarantee that a bound variant can never emit a bad token). */
export function resolveEnum(
  value: string | BindExpr | undefined,
  allowed: readonly string[],
  fallback: string,
  scope: EvalScope,
  ctx: EvalContext
): string {
  if (value == null) return fallback;
  const raw = typeof value === 'string' ? value : resolveValue(value, scope, ctx);
  return allowed.includes(raw) ? raw : fallback;
}
