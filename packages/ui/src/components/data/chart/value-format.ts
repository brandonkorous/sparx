// Pure value-formatting helpers for the data-viz primitives. Deliberately NOT
// a `'use client'` module: it holds no React, just functions + types, so BOTH
// the client chart components AND server components (e.g. BarList) can import
// and call it. The serializable `ValueFormat` is what lets a Server Component
// format chart/bar values without passing a function across the RSC boundary.

export type ValueFormatter = (value: number) => string;

/**
 * Serializable formatting spec. Pass this (a string or plain object) from a
 * Server Component instead of a `valueFormatter` function — functions can't
 * cross the RSC → Client boundary, and the chart components are `'use client'`.
 * The consumer resolves it to a `ValueFormatter` internally. A `valueFormatter`
 * prop, when given, always wins (for client callers needing bespoke formatting).
 *
 *  - `'number'`   → `1,234`
 *  - `'compact'`  → `1.2K`
 *  - `'currency'` → `$1,234` (USD, no fraction)
 *  - `'percent'`  → `12%` (the value is already a percentage)
 *  - object form  → same kinds plus `{ currency, digits }` overrides
 */
export type ValueFormatKind = 'number' | 'compact' | 'currency' | 'percent';
export type ValueFormat =
  | ValueFormatKind
  | { kind: ValueFormatKind; currency?: string; digits?: number };

/** Turn a serializable `ValueFormat` into a `ValueFormatter`. */
export function resolveValueFormat(spec: ValueFormat | undefined): ValueFormatter | undefined {
  if (!spec) return undefined;
  const { kind, currency = 'USD', digits } = typeof spec === 'string' ? { kind: spec } : spec;
  switch (kind) {
    case 'currency':
      return (v) =>
        new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency,
          maximumFractionDigits: digits ?? 0,
        }).format(v);
    case 'percent':
      return (v) => `${digits != null ? v.toFixed(digits) : v}%`;
    case 'compact':
      return (v) =>
        new Intl.NumberFormat('en-US', {
          notation: 'compact',
          maximumFractionDigits: digits ?? 1,
        }).format(v);
    case 'number':
    default:
      return (v) =>
        new Intl.NumberFormat('en-US', { maximumFractionDigits: digits ?? 0 }).format(v);
  }
}

/** A function formatter always wins; otherwise resolve the serializable spec. */
export function resolveFormatter(
  valueFormatter: ValueFormatter | undefined,
  valueFormat: ValueFormat | undefined
): ValueFormatter | undefined {
  return valueFormatter ?? resolveValueFormat(valueFormat);
}
