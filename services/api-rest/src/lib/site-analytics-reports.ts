// First-party site analytics — report aggregations + rollup reconcile
// (docs/97 §5, docs/08). Read by the Builder overview's traffic cards.
//
// The hybrid (docs/97 §5): the per-day visitors/pageviews series reads the
// `rollup_site_daily` table for closed days and live-aggregates the open day(s)
// from `site_analytics_events`, with a cold-start that live-aggregates the whole
// window before the first reconcile runs. The window-unique figures, top pages,
// and sources read the raw events directly (bounded by the query window).
//
// Every function takes a tenant-scoped TxClient (the caller wraps withTenant),
// so RLS isolates all reads/writes. property_id scopes to the active site.

import type { TxClient } from '@sparx/db';

// How many trailing days the read live-aggregates instead of trusting the
// rollup, so "today" (and a just-closed yesterday) stay fresh.
const OVERLAY_DAYS = 1;

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
export function eachUtcDay(from: Date, to: Date): Date[] {
  const out: Date[] = [];
  const end = startOfUtcDay(to).getTime();
  for (let d = startOfUtcDay(from); d.getTime() <= end; d = addUtcDays(d, 1)) out.push(d);
  return out;
}
export function bucketStartFor(dateKey: string, grain: 'week' | 'month'): string {
  const d = new Date(`${dateKey}T00:00:00.000Z`);
  if (grain === 'month') {
    return utcDateKey(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)));
  }
  const deltaToMonday = (d.getUTCDay() + 6) % 7;
  return utcDateKey(addUtcDays(startOfUtcDay(d), -deltaToMonday));
}

export type SiteGrain = 'day' | 'week' | 'month';

export function resolveRange(input: { from?: string; to?: string }, defaultDays = 30) {
  const to = startOfUtcDay(input.to ? new Date(input.to) : new Date());
  const from = startOfUtcDay(
    input.from ? new Date(input.from) : addUtcDays(to, -(defaultDays - 1))
  );
  return { from, to, toExclusive: addUtcDays(to, 1) };
}

// ── Summary ──────────────────────────────────────────────────────────
export interface SiteSummary {
  visitors: number;
  pageviews: number;
  sessions: number;
  signups: number;
  pagesPerVisit: number;
  topReferrerHost: string | null;
  topReferrerVisits: number;
}

interface RawSummary {
  visitors: number;
  pageviews: number;
  sessions: number;
  signups: number;
}
interface RawReferrer {
  referrer_host: string | null;
  visits: number;
}

export async function summary(
  tx: TxClient,
  propertyId: string,
  from: Date,
  toExclusive: Date
): Promise<SiteSummary> {
  const [rows, refs] = await Promise.all([
    tx.$queryRaw<RawSummary[]>`
      SELECT
        COUNT(DISTINCT visitor_hash) FILTER (WHERE type = 'pageview')::int AS visitors,
        COUNT(*) FILTER (WHERE type = 'pageview')::int                     AS pageviews,
        COUNT(DISTINCT session_hash) FILTER (WHERE type = 'pageview')::int AS sessions,
        COUNT(*) FILTER (WHERE type = 'signup')::int                       AS signups
      FROM site_analytics_events
      WHERE property_id = ${propertyId}::uuid
        AND created_at >= ${from} AND created_at < ${toExclusive}
    `,
    tx.$queryRaw<RawReferrer[]>`
      SELECT referrer_host, COUNT(DISTINCT visitor_hash)::int AS visits
      FROM site_analytics_events
      WHERE property_id = ${propertyId}::uuid
        AND type = 'pageview' AND referrer_host IS NOT NULL
        AND created_at >= ${from} AND created_at < ${toExclusive}
      GROUP BY referrer_host ORDER BY visits DESC LIMIT 1
    `,
  ]);

  const r = rows[0] ?? { visitors: 0, pageviews: 0, sessions: 0, signups: 0 };
  const visitors = Number(r.visitors);
  const pageviews = Number(r.pageviews);
  const top = refs[0];
  return {
    visitors,
    pageviews,
    sessions: Number(r.sessions),
    signups: Number(r.signups),
    pagesPerVisit: visitors > 0 ? +(pageviews / visitors).toFixed(2) : 0,
    topReferrerHost: top?.referrer_host ?? null,
    topReferrerVisits: top ? Number(top.visits) : 0,
  };
}

// ── Timeseries (rollup + live-overlay + cold-start) ──────────────────
export interface SitePoint {
  bucket: string;
  visitors: number;
  pageviews: number;
}
export interface SiteTimeseries {
  range: { from: string; to: string; grain: SiteGrain };
  points: SitePoint[];
  totals: { visitors: number; pageviews: number };
}

interface RawDay {
  bucket: Date;
  visitors: number;
  pageviews: number;
}

// One GROUP-BY-day pass over raw events in [from, toExclusive) — the shared body
// of the live overlay, the cold-start, and the reconcile.
async function aggregateByDay(
  tx: TxClient,
  propertyId: string,
  from: Date,
  toExclusive: Date
): Promise<RawDay[]> {
  return tx.$queryRaw<RawDay[]>`
    SELECT
      (created_at AT TIME ZONE 'UTC')::date                              AS bucket,
      COUNT(DISTINCT visitor_hash) FILTER (WHERE type = 'pageview')::int AS visitors,
      COUNT(*) FILTER (WHERE type = 'pageview')::int                     AS pageviews
    FROM site_analytics_events
    WHERE property_id = ${propertyId}::uuid
      AND created_at >= ${from} AND created_at < ${toExclusive}
    GROUP BY 1 ORDER BY 1
  `;
}

export async function timeseries(
  tx: TxClient,
  propertyId: string,
  range: { from: Date; to: Date; toExclusive: Date },
  grain: SiteGrain
): Promise<SiteTimeseries> {
  const { from, to, toExclusive } = range;
  const overlayStart = addUtcDays(startOfUtcDay(new Date()), -OVERLAY_DAYS);
  const closedToExclusive = new Date(Math.min(toExclusive.getTime(), overlayStart.getTime()));
  const byKey = new Map<string, { visitors: number; pageviews: number }>();

  // Closed days from the rollup, with a cold-start fallback so a fresh deploy
  // serves real history before the first reconcile runs.
  if (closedToExclusive.getTime() > from.getTime()) {
    const rollup = await tx.rollupSiteDaily.findMany({
      where: { propertyId, bucket: { gte: from, lt: closedToExclusive } },
      orderBy: { bucket: 'asc' },
    });
    if (rollup.length > 0) {
      for (const row of rollup) {
        byKey.set(utcDateKey(startOfUtcDay(new Date(row.bucket))), {
          visitors: row.visitors,
          pageviews: row.pageviews,
        });
      }
    } else {
      for (const d of await aggregateByDay(tx, propertyId, from, closedToExclusive)) {
        byKey.set(utcDateKey(startOfUtcDay(new Date(d.bucket))), {
          visitors: Number(d.visitors),
          pageviews: Number(d.pageviews),
        });
      }
    }
  }

  // Live overlay of the most recent open day(s).
  const overlayFrom = new Date(Math.max(from.getTime(), overlayStart.getTime()));
  if (toExclusive.getTime() > overlayFrom.getTime()) {
    for (const d of await aggregateByDay(tx, propertyId, overlayFrom, toExclusive)) {
      byKey.set(utcDateKey(startOfUtcDay(new Date(d.bucket))), {
        visitors: Number(d.visitors),
        pageviews: Number(d.pageviews),
      });
    }
  }

  const daily: SitePoint[] = eachUtcDay(from, to).map((d) => {
    const v = byKey.get(utcDateKey(d)) ?? { visitors: 0, pageviews: 0 };
    return { bucket: utcDateKey(d), visitors: v.visitors, pageviews: v.pageviews };
  });

  let points = daily;
  if (grain !== 'day') {
    const map = new Map<string, SitePoint>();
    for (const p of daily) {
      const key = bucketStartFor(p.bucket, grain);
      const cur = map.get(key);
      if (cur) {
        cur.visitors += p.visitors;
        cur.pageviews += p.pageviews;
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
      visitors: daily.reduce((s, p) => s + p.visitors, 0),
      pageviews: daily.reduce((s, p) => s + p.pageviews, 0),
    },
  };
}

// ── Top pages ────────────────────────────────────────────────────────
export interface TopPageRow {
  path: string;
  views: number;
  visitors: number;
}
interface RawTopPage {
  path: string;
  views: number;
  visitors: number;
}

export async function topPages(
  tx: TxClient,
  propertyId: string,
  from: Date,
  toExclusive: Date,
  limit: number
): Promise<TopPageRow[]> {
  const rows = await tx.$queryRaw<RawTopPage[]>`
    SELECT
      path,
      COUNT(*)::int                      AS views,
      COUNT(DISTINCT visitor_hash)::int  AS visitors
    FROM site_analytics_events
    WHERE property_id = ${propertyId}::uuid
      AND type = 'pageview'
      AND created_at >= ${from} AND created_at < ${toExclusive}
    GROUP BY path ORDER BY views DESC LIMIT ${limit}
  `;
  return rows.map((r) => ({
    path: r.path,
    views: Number(r.views),
    visitors: Number(r.visitors),
  }));
}

// ── Sources ──────────────────────────────────────────────────────────
export interface SourceRow {
  source: string;
  visits: number;
}
interface RawSource {
  source: string;
  visits: number;
}

export async function sources(
  tx: TxClient,
  propertyId: string,
  from: Date,
  toExclusive: Date
): Promise<SourceRow[]> {
  const rows = await tx.$queryRaw<RawSource[]>`
    SELECT source, COUNT(DISTINCT visitor_hash)::int AS visits
    FROM site_analytics_events
    WHERE property_id = ${propertyId}::uuid
      AND type = 'pageview'
      AND created_at >= ${from} AND created_at < ${toExclusive}
    GROUP BY source ORDER BY visits DESC
  `;
  return rows.map((r) => ({ source: r.source, visits: Number(r.visits) }));
}

// ── Web vitals (avg per metric over the window) ──────────────────────
export interface SiteVitals {
  load: number | null; // avg page load time, ms (rounded)
  lcp: number | null; // avg Largest Contentful Paint, ms
  cls: number | null; // avg Cumulative Layout Shift, unitless
  samples: number; // total vital rows in the window
}

interface RawVital {
  metric: string;
  avg: number;
  samples: number;
}

export async function vitals(
  tx: TxClient,
  propertyId: string,
  from: Date,
  toExclusive: Date
): Promise<SiteVitals> {
  const rows = await tx.$queryRaw<RawVital[]>`
    SELECT metric, AVG(value)::float8 AS avg, COUNT(*)::int AS samples
    FROM site_analytics_events
    WHERE property_id = ${propertyId}::uuid
      AND type = 'vital'
      AND metric IS NOT NULL AND value IS NOT NULL
      AND created_at >= ${from} AND created_at < ${toExclusive}
    GROUP BY metric
  `;
  const avgByMetric = new Map(rows.map((r) => [r.metric, Number(r.avg)]));
  const ms = (m: string): number | null => {
    const v = avgByMetric.get(m);
    return v == null ? null : Math.round(v);
  };
  const cls = avgByMetric.get('cls');
  return {
    load: ms('load'),
    lcp: ms('lcp'),
    cls: cls == null ? null : Math.round(cls * 1000) / 1000,
    samples: rows.reduce((s, r) => s + Number(r.samples), 0),
  };
}

// ── Rollup reconcile (nightly) ───────────────────────────────────────
// Recompute a trailing window from the raw events and overwrite the rollup, for
// every property that has events in the window. Delete-window-then-insert keeps
// it idempotent (also the one-shot backfill). Sessions/signups are recomputed
// alongside visitors/pageviews in a single GROUP BY.
export interface SiteRollupReconcileResult {
  rows: number;
}

interface RawReconcileRow {
  property_id: string;
  bucket: Date;
  pageviews: number;
  visitors: number;
  sessions: number;
  signups: number;
}

export async function reconcileSiteDaily(
  tx: TxClient,
  tenantId: string,
  windowStart: Date,
  toExclusive: Date
): Promise<SiteRollupReconcileResult> {
  // RLS already scopes the raw read to `tenantId`, so every grouped row belongs
  // to this tenant — we stamp it back onto the rollup rows.
  const rows = await tx.$queryRaw<RawReconcileRow[]>`
    SELECT
      property_id,
      (created_at AT TIME ZONE 'UTC')::date                              AS bucket,
      COUNT(*) FILTER (WHERE type = 'pageview')::int                     AS pageviews,
      COUNT(DISTINCT visitor_hash) FILTER (WHERE type = 'pageview')::int AS visitors,
      COUNT(DISTINCT session_hash) FILTER (WHERE type = 'pageview')::int AS sessions,
      COUNT(*) FILTER (WHERE type = 'signup')::int                       AS signups
    FROM site_analytics_events
    WHERE property_id IS NOT NULL
      AND created_at >= ${windowStart} AND created_at < ${toExclusive}
    GROUP BY property_id, 2
  `;

  await tx.rollupSiteDaily.deleteMany({ where: { bucket: { gte: windowStart } } });
  if (rows.length > 0) {
    await tx.rollupSiteDaily.createMany({
      data: rows.map((r) => ({
        tenantId,
        propertyId: r.property_id,
        bucket: startOfUtcDay(new Date(r.bucket)),
        pageviews: Number(r.pageviews),
        visitors: Number(r.visitors),
        sessions: Number(r.sessions),
        signups: Number(r.signups),
      })),
    });
  }
  return { rows: rows.length };
}
