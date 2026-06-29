// Dashboard command-center date range (docs/97 §7, docs/34). The home dashboard
// is a force-dynamic server component; the active range is URL-driven (?range=)
// so picking a range is a normal navigation that re-renders the whole screen
// with fresh reads — no client data layer. Every reporting endpoint we call
// takes ISO `from`/`to` (commerce, traffic, email, b2b, finance) or a derived
// `days`/`months`; this module resolves one range into all the shapes those
// endpoints want, plus the matching previous-period window for deltas.

export const RANGE_KEYS = ['today', '7d', '30d', '90d', '12mo'] as const;
export type RangeKey = (typeof RANGE_KEYS)[number];

export type Grain = 'day' | 'week' | 'month';

export interface DashboardRange {
  key: RangeKey;
  /** Short control label, e.g. "Last 30 days". */
  label: string;
  /** Even shorter chip label, e.g. "30D". */
  short: string;
  from: Date;
  /** Exclusive upper bound — "now". */
  to: Date;
  grain: Grain;
  /** Whole-day length of the window (drives the previous-period window). */
  days: number;
  /** Months of history, for endpoints that bucket by month (CRM acquisition). */
  months: number;
  /** Immediately-preceding window of equal length, for delta-vs-previous. */
  prev: { from: Date; to: Date };
  /** Whether to overlay/show the previous-period comparison. */
  compare: boolean;
}

const RANGE_META: Record<RangeKey, { label: string; short: string; days: number; grain: Grain }> = {
  today: { label: 'Today', short: '1D', days: 1, grain: 'day' },
  '7d': { label: 'Last 7 days', short: '7D', days: 7, grain: 'day' },
  '30d': { label: 'Last 30 days', short: '30D', days: 30, grain: 'day' },
  '90d': { label: 'Last 90 days', short: '90D', days: 90, grain: 'week' },
  '12mo': { label: 'Last 12 months', short: '12M', days: 365, grain: 'month' },
};

export const DEFAULT_RANGE: RangeKey = '30d';

/** Range choices for the control, in display order. Pure data — safe to import
 *  from the client control without pulling the date math into the bundle. */
export const RANGE_OPTIONS: { key: RangeKey; short: string; label: string }[] = RANGE_KEYS.map(
  (k) => ({ key: k, short: RANGE_META[k].short, label: RANGE_META[k].label })
);

function isRangeKey(v: string | undefined): v is RangeKey {
  return v != null && (RANGE_KEYS as readonly string[]).includes(v);
}

/** Midnight (local) at the start of `d`'s day. */
function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

/**
 * Resolve the active dashboard range from URL search params.
 *
 *   const range = resolveRange(searchParams);
 *   api.get(`/v1/commerce/reports/revenue-summary?${rangeQs(range)}`)
 *
 * `now` is injectable for tests; in the live server component it defaults to the
 * per-request clock (the page is force-dynamic, so this is evaluated fresh).
 */
export function resolveRange(
  params: { range?: string; compare?: string } | undefined,
  now: Date = new Date()
): DashboardRange {
  const key = isRangeKey(params?.range) ? params.range : DEFAULT_RANGE;
  const meta = RANGE_META[key];
  const to = now;
  // "today" starts at local midnight; every other window is a rolling N-day span.
  const from = key === 'today' ? startOfDay(now) : new Date(now.getTime() - meta.days * 86_400_000);
  const spanMs = to.getTime() - from.getTime();
  const prev = { from: new Date(from.getTime() - spanMs), to: from };
  return {
    key,
    label: meta.label,
    short: meta.short,
    from,
    to,
    grain: meta.grain,
    days: meta.days,
    months: Math.max(1, Math.round(meta.days / 30)),
    prev,
    // Compare defaults ON — a number without context is the amateur tell the
    // command center exists to avoid. Opt out with ?compare=0.
    compare: params?.compare !== '0',
  };
}

/** `from=…&to=…` querystring for the current window. */
export function rangeQs(range: DashboardRange): string {
  return new URLSearchParams({
    from: range.from.toISOString(),
    to: range.to.toISOString(),
  }).toString();
}

/** `from=…&to=…` querystring for the previous (comparison) window. */
export function prevRangeQs(range: DashboardRange): string {
  return new URLSearchParams({
    from: range.prev.from.toISOString(),
    to: range.prev.to.toISOString(),
  }).toString();
}
