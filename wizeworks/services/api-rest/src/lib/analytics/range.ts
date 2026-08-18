// The one range contract every analytics metric obeys (docs/130 §1.1).
//
// Reporting endpoints across the platform grew a mix of `from`/`to`, `days`,
// `since`, `months` and no-range-at-all. A dashboard has ONE date range that
// every tile on it must honour, and that cannot be expressed while each metric
// speaks a different dialect. Rather than normalise sixty route handlers
// (docs/130 §1.4), the batch query layer resolves the range ONCE, here, and
// every metric resolver receives the canonical `{ from, to, toExclusive, grain }`.
//
// Rules that stop the variance recurring:
//   • `from` and `to` are independently optional; each defaults on its own.
//   • `to` is EXCLUSIVE — half-open [from, toExclusive) is the only way month
//     boundaries and DST transitions stop producing off-by-one-day bugs. This
//     matches the existing builder analytics (`toExclusive`).
//   • Buckets are UTC days (docs/130 §1.2). A tenant-timezone override is a
//     future change with exactly one place to land: this resolver.

import { startOfUtcDay, addUtcDays } from '../site-analytics-reports.js';

export type Grain = 'day' | 'week' | 'month';

/** The resolved window handed to every resolver. */
export interface ResolvedRange {
  /** UTC-day-aligned lower bound (inclusive). */
  from: Date;
  /** The last day the window covers (inclusive) — for labels and `eachUtcDay`. */
  to: Date;
  /** Half-open upper bound: the window is [from, toExclusive). */
  toExclusive: Date;
  grain: Grain;
}

/** The wire shape a caller may send — every field optional, nothing else accepted. */
export interface RangeInput {
  from?: string;
  to?: string;
  grain?: Grain;
}

// The default window when a caller sends no dates. Thirty days is long enough to
// survive a quiet week and short enough to still describe "now".
const DEFAULT_WINDOW_DAYS = 30;

/**
 * Resolve a wire range into the canonical window.
 *
 * `to` is treated as an EXCLUSIVE upper bound. When omitted it defaults to the
 * start of tomorrow (UTC), so the default window includes all of today. When a
 * caller passes a mid-day `to`, it is floored to that UTC day's start — the
 * exclusive boundary is always a day edge, which is what keeps buckets aligned.
 */
export function resolveRange(input: RangeInput, defaultDays = DEFAULT_WINDOW_DAYS): ResolvedRange {
  const now = new Date();
  const toExclusive = input.to
    ? startOfUtcDay(new Date(input.to))
    : addUtcDays(startOfUtcDay(now), 1);
  const from = input.from
    ? startOfUtcDay(new Date(input.from))
    : addUtcDays(toExclusive, -defaultDays);
  // The inclusive last day is one day inside the half-open bound — but never
  // before `from`, so a zero-width window degrades to a single day rather than
  // an inverted range.
  const to = new Date(Math.max(from.getTime(), addUtcDays(toExclusive, -1).getTime()));
  return { from, to, toExclusive, grain: input.grain ?? 'day' };
}

/**
 * The immediately-preceding window of the same length — for `compare:
 * previous_period`. A number with no baseline is not an answer (docs/129 §6), so
 * every headline figure is resolved twice: once for the range, once for the span
 * of equal length ending where the range begins.
 */
export function previousRange(range: ResolvedRange): ResolvedRange {
  const spanMs = range.toExclusive.getTime() - range.from.getTime();
  const toExclusive = range.from;
  const from = new Date(toExclusive.getTime() - spanMs);
  const to = new Date(Math.max(from.getTime(), addUtcDays(toExclusive, -1).getTime()));
  return { from, to, toExclusive, grain: range.grain };
}
