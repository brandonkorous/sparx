// Search Console organic reports — read aggregations over the ingested rollup
// (docs/50 §7, docs/97 §4). Read by the SEO overview's organic cards.
//
// Unlike first-party site analytics, there is NO live overlay: GSC data lags
// ~2-3 days and the nightly job writes the rollup as the source of truth, so the
// reads are a straight rollup scan (zero-filled + grain-folded). CTR and average
// position are derived: ctr = clicks / impressions, avg position = Σ(position ×
// impressions) / impressions (sum_position stores the impression-weighted
// numerator so it aggregates correctly across days).
//
// Every function takes a tenant-scoped TxClient (caller wraps withTenant); RLS
// isolates the reads. property_id scopes to the active site.

import type { TxClient } from '@wizeworks/db';

// ── UTC-day helpers ──────────────────────────────────────────────────
export function startOfUtcDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}
export function addUtcDays(d: Date, n: number): Date {
  return new Date(d.getTime() + n * 86_400_000);
}
export function utcDateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}
function eachUtcDay(from: Date, to: Date): Date[] {
  const out: Date[] = [];
  const end = startOfUtcDay(to).getTime();
  for (let d = startOfUtcDay(from); d.getTime() <= end; d = addUtcDays(d, 1)) out.push(d);
  return out;
}
function bucketStartFor(dateKey: string, grain: 'week' | 'month'): string {
  const d = new Date(`${dateKey}T00:00:00.000Z`);
  if (grain === 'month') {
    return utcDateKey(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)));
  }
  const deltaToMonday = (d.getUTCDay() + 6) % 7;
  return utcDateKey(addUtcDays(startOfUtcDay(d), -deltaToMonday));
}

export type OrganicGrain = 'day' | 'week' | 'month';

export function resolveRange(input: { from?: string; to?: string }, defaultDays = 28) {
  const to = startOfUtcDay(input.to ? new Date(input.to) : new Date());
  const from = startOfUtcDay(
    input.from ? new Date(input.from) : addUtcDays(to, -(defaultDays - 1))
  );
  return { from, to, toExclusive: addUtcDays(to, 1) };
}

function ratio(numerator: number, denominator: number, digits = 4): number {
  return denominator > 0 ? +(numerator / denominator).toFixed(digits) : 0;
}

// ── Summary ──────────────────────────────────────────────────────────
export interface OrganicSummary {
  clicks: number;
  impressions: number;
  ctr: number; // clicks / impressions (0..1)
  avgPosition: number; // impression-weighted
}

export async function summary(
  tx: TxClient,
  propertyId: string,
  from: Date,
  toExclusive: Date
): Promise<OrganicSummary> {
  const rows = await tx.rollupSearchConsoleDaily.findMany({
    where: { propertyId, bucket: { gte: from, lt: toExclusive } },
    select: { clicks: true, impressions: true, sumPosition: true },
  });
  let clicks = 0;
  let impressions = 0;
  let sumPosition = 0;
  for (const r of rows) {
    clicks += r.clicks;
    impressions += r.impressions;
    sumPosition += Number(r.sumPosition);
  }
  return {
    clicks,
    impressions,
    ctr: ratio(clicks, impressions),
    avgPosition: impressions > 0 ? +(sumPosition / impressions).toFixed(1) : 0,
  };
}

// ── Timeseries (rollup scan, zero-filled + grain-folded) ─────────────
export interface OrganicPoint {
  bucket: string;
  clicks: number;
  impressions: number;
}
export interface OrganicTimeseries {
  range: { from: string; to: string; grain: OrganicGrain };
  points: OrganicPoint[];
  totals: { clicks: number; impressions: number };
}

export async function timeseries(
  tx: TxClient,
  propertyId: string,
  range: { from: Date; to: Date; toExclusive: Date },
  grain: OrganicGrain
): Promise<OrganicTimeseries> {
  const { from, to, toExclusive } = range;
  const rollup = await tx.rollupSearchConsoleDaily.findMany({
    where: { propertyId, bucket: { gte: from, lt: toExclusive } },
    select: { bucket: true, clicks: true, impressions: true },
    orderBy: { bucket: 'asc' },
  });
  const byKey = new Map<string, { clicks: number; impressions: number }>();
  for (const r of rollup) {
    byKey.set(utcDateKey(startOfUtcDay(new Date(r.bucket))), {
      clicks: r.clicks,
      impressions: r.impressions,
    });
  }

  const daily: OrganicPoint[] = eachUtcDay(from, to).map((d) => {
    const v = byKey.get(utcDateKey(d)) ?? { clicks: 0, impressions: 0 };
    return { bucket: utcDateKey(d), clicks: v.clicks, impressions: v.impressions };
  });

  let points = daily;
  if (grain !== 'day') {
    const map = new Map<string, OrganicPoint>();
    for (const p of daily) {
      const key = bucketStartFor(p.bucket, grain);
      const cur = map.get(key);
      if (cur) {
        cur.clicks += p.clicks;
        cur.impressions += p.impressions;
      } else {
        map.set(key, { ...p, bucket: key });
      }
    }
    points = [...map.values()].sort((a, b) => (a.bucket < b.bucket ? -1 : 1));
  }

  return {
    range: { from: utcDateKey(from), to: utcDateKey(to), grain },
    points,
    totals: {
      clicks: daily.reduce((s, p) => s + p.clicks, 0),
      impressions: daily.reduce((s, p) => s + p.impressions, 0),
    },
  };
}

// ── Top queries ──────────────────────────────────────────────────────
export interface TopQueryRow {
  query: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

export async function topQueries(
  tx: TxClient,
  propertyId: string,
  limit: number
): Promise<TopQueryRow[]> {
  const rows = await tx.searchConsoleQuery.findMany({
    where: { propertyId },
    orderBy: { clicks: 'desc' },
    take: limit,
    select: { query: true, clicks: true, impressions: true, sumPosition: true },
  });
  return rows.map((r) => ({
    query: r.query,
    clicks: r.clicks,
    impressions: r.impressions,
    ctr: ratio(r.clicks, r.impressions),
    position: r.impressions > 0 ? +(Number(r.sumPosition) / r.impressions).toFixed(1) : 0,
  }));
}
