import type { Delta, Trend } from './types';

// Formatting + delta helpers for the command center. Money helpers mirror
// overview-bits (cents → display), but the command center leans on deltas
// (period-over-period change) far more, so those live here.

const DASH = '—';

export function fmtMoneyCents(cents?: number | null, currency = 'USD'): string {
  if (cents == null || Number.isNaN(cents)) return DASH;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

/** Compact money for tight tiles: $1.2k, $48k, $1.3M. */
export function fmtMoneyCompact(cents?: number | null, currency = 'USD'): string {
  if (cents == null || Number.isNaN(cents)) return DASH;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(cents / 100);
}

export function fmtNumber(value?: number | null): string {
  if (value == null || Number.isNaN(value)) return DASH;
  return new Intl.NumberFormat('en-US').format(value);
}

export function fmtCompact(value?: number | null): string {
  if (value == null || Number.isNaN(value)) return DASH;
  return new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(
    value
  );
}

export function fmtPercent(value?: number | null, digits = 1): string {
  if (value == null || Number.isNaN(value)) return DASH;
  return `${value.toFixed(digits)}%`;
}

/**
 * Period-over-period delta. Returns a signed, percentage-labelled Delta with a
 * trend for coloring — paired with an arrow + sign in the tile so color is never
 * the only signal. `invert` flips the good/bad sense for "lower is better"
 * metrics (overdue $, abandonment), so a decrease reads green.
 */
export function computeDelta(
  current?: number | null,
  previous?: number | null,
  opts?: { invert?: boolean }
): Delta | undefined {
  if (current == null || previous == null || Number.isNaN(current) || Number.isNaN(previous)) {
    return undefined;
  }
  if (previous === 0) {
    if (current === 0) return undefined;
    return { value: 'New', trend: opts?.invert ? 'down' : 'up' };
  }
  const pct = ((current - previous) / Math.abs(previous)) * 100;
  const rounded = Math.abs(pct) < 0.05 ? 0 : pct;
  const rising = rounded > 0;
  let trend: Trend = 'neutral';
  if (rounded !== 0) trend = (rising ? !opts?.invert : opts?.invert) ? 'up' : 'down';
  const arrow = rounded > 0 ? '↑' : rounded < 0 ? '↓' : '→';
  return { value: `${arrow} ${Math.abs(rounded).toFixed(1)}%`, trend };
}

/** Safe division → 0 when the denominator is missing/zero. */
export function ratio(numerator?: number | null, denominator?: number | null): number {
  if (!numerator || !denominator) return 0;
  return numerator / denominator;
}

/** Compact relative time ("3h ago"). Evaluated per request (force-dynamic). */
export function timeAgo(iso: string | null | undefined): string {
  if (!iso) return DASH;
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return DASH;
  const secs = Math.max(0, Math.round((Date.now() - then) / 1000));
  if (secs < 60) return 'just now';
  const mins = Math.round(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.round(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.round(months / 12)}y ago`;
}
