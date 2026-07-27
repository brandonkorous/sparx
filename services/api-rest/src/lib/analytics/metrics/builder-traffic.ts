// Traffic metrics — the first default dashboard's measures (docs/129 §8, §10).
//
// Site traffic is the most complete analytics we have and the only fully
// property-scoped set, so it ships first. Every metric here delegates to
// `site-analytics-reports.ts` — the same aggregation the builder overview and the
// nightly rollup already use — so this registers a façade, it does not recompute.
//
// All of these are `scope: 'property'`: a visitor count is a per-site figure, and
// the executor resolves the dashboard's site before calling these, so `propertyId`
// is always present here.

import type { MetricContext, MetricData, MetricDefinition } from '../types.js';
import * as reports from '../../site-analytics-reports.js';

// Every grain the site timeseries supports.
const ALL_GRAINS = ['day', 'week', 'month'] as const;

// A source class's plain-language name — an owner does not think in "referral".
const SOURCE_LABEL: Record<string, string> = {
  search: 'Search engines',
  direct: 'Typed in or bookmarked',
  social: 'Social media',
  referral: 'Other websites',
  email: 'Email',
  unknown: 'Other',
};

function sourceLabel(source: string): string {
  return SOURCE_LABEL[source] ?? source;
}

/** Property-scoped resolvers can assume a site — the executor guarantees it — but
 *  a guard keeps the assumption honest rather than reaching for a non-null cast. */
function siteOf(ctx: MetricContext): string {
  if (!ctx.propertyId) {
    throw new Error('A per-site traffic metric was resolved without a site.');
  }
  return ctx.propertyId;
}

/** The per-day series for one traffic dimension, used as a KPI's inline sparkline.
 *  Always day-grain — a sparkline wants the finest shape, regardless of the
 *  dashboard's chart grain. */
async function daySpark(
  ctx: MetricContext,
  propertyId: string,
  pick: (p: { visitors: number; pageviews: number }) => number
): Promise<number[]> {
  const { from, to, toExclusive } = ctx.range;
  const series = await ctx.run((tx) =>
    reports.timeseries(tx, propertyId, { from, to, toExclusive }, 'day')
  );
  return series.points.map(pick);
}

export const BUILDER_TRAFFIC_METRICS: readonly MetricDefinition[] = [
  {
    id: 'builder.traffic.visitors',
    module: 'builder',
    label: 'Visitors',
    unit: 'count',
    grains: ALL_GRAINS,
    shapes: ['kpi', 'scalar'],
    // A distinct count: the same person across two days is one visitor. Summing
    // per-day buckets double-counts, so the windowed total comes from the summary
    // resolver, never from adding the series up.
    additive: false,
    scope: 'property',
    async resolve(ctx): Promise<MetricData> {
      const propertyId = siteOf(ctx);
      const { from, toExclusive } = ctx.range;
      const [s, spark] = await Promise.all([
        ctx.run((tx) => reports.summary(tx, propertyId, from, toExclusive)),
        ctx.shape === 'kpi'
          ? daySpark(ctx, propertyId, (p) => p.visitors)
          : Promise.resolve(undefined),
      ]);
      return { value: s.visitors, spark };
    },
  },
  {
    id: 'builder.traffic.pageviews',
    module: 'builder',
    label: 'Page views',
    unit: 'count',
    grains: ALL_GRAINS,
    shapes: ['kpi', 'scalar'],
    // Pageviews are events, not people: adding buckets is correct.
    additive: true,
    scope: 'property',
    async resolve(ctx): Promise<MetricData> {
      const propertyId = siteOf(ctx);
      const { from, toExclusive } = ctx.range;
      const [s, spark] = await Promise.all([
        ctx.run((tx) => reports.summary(tx, propertyId, from, toExclusive)),
        ctx.shape === 'kpi'
          ? daySpark(ctx, propertyId, (p) => p.pageviews)
          : Promise.resolve(undefined),
      ]);
      return { value: s.pageviews, spark };
    },
  },
  {
    id: 'builder.traffic.sessions',
    module: 'builder',
    label: 'Visits',
    unit: 'count',
    grains: ALL_GRAINS,
    shapes: ['kpi', 'scalar'],
    additive: false,
    scope: 'property',
    async resolve(ctx): Promise<MetricData> {
      const propertyId = siteOf(ctx);
      const { from, toExclusive } = ctx.range;
      const s = await ctx.run((tx) => reports.summary(tx, propertyId, from, toExclusive));
      return { value: s.sessions };
    },
  },
  {
    id: 'builder.traffic.pages_per_visit',
    module: 'builder',
    label: 'Pages per visit',
    unit: 'ratio',
    grains: ALL_GRAINS,
    shapes: ['kpi', 'scalar'],
    additive: false,
    scope: 'property',
    async resolve(ctx): Promise<MetricData> {
      const propertyId = siteOf(ctx);
      const { from, toExclusive } = ctx.range;
      const s = await ctx.run((tx) => reports.summary(tx, propertyId, from, toExclusive));
      return { value: s.pagesPerVisit };
    },
  },
  {
    id: 'builder.traffic.avg_load',
    module: 'builder',
    label: 'Average load time',
    unit: 'duration',
    grains: ALL_GRAINS,
    shapes: ['kpi', 'scalar'],
    additive: false,
    scope: 'property',
    async resolve(ctx): Promise<MetricData> {
      const propertyId = siteOf(ctx);
      const { from, toExclusive } = ctx.range;
      const v = await ctx.run((tx) => reports.vitals(tx, propertyId, from, toExclusive));
      // Milliseconds; 0 stands in for "no samples yet", which the tile renders as
      // an empty state rather than a suspiciously instant page.
      return { value: v.load ?? 0 };
    },
  },
  {
    id: 'builder.traffic.overview',
    module: 'builder',
    label: 'Visitors and page views',
    unit: 'count',
    grains: ALL_GRAINS,
    shapes: ['timeseries'],
    additive: true,
    scope: 'property',
    // The hero chart: two series over time on one axis. Visitors leads (the
    // module hue), page views trails — the classic "how busy, and how deep".
    async resolve(ctx): Promise<MetricData> {
      const propertyId = siteOf(ctx);
      const { from, to, toExclusive, grain } = ctx.range;
      const series = await ctx.run((tx) =>
        reports.timeseries(tx, propertyId, { from, to, toExclusive }, grain)
      );
      return {
        grain,
        series: [
          { key: 'visitors', label: 'Visitors' },
          { key: 'pageviews', label: 'Page views' },
        ],
        points: series.points.map((p) => ({
          bucket: p.bucket,
          visitors: p.visitors,
          pageviews: p.pageviews,
        })),
      };
    },
  },
  {
    id: 'builder.traffic.sources',
    module: 'builder',
    label: 'Where visits came from',
    unit: 'count',
    grains: ALL_GRAINS,
    shapes: ['breakdown'],
    additive: true,
    scope: 'property',
    async resolve(ctx): Promise<MetricData> {
      const propertyId = siteOf(ctx);
      const { from, toExclusive } = ctx.range;
      const rows = await ctx.run((tx) => reports.sources(tx, propertyId, from, toExclusive));
      const total = rows.reduce((sum, r) => sum + r.visits, 0);
      const limited = ctx.limit ? rows.slice(0, ctx.limit) : rows;
      return {
        rows: limited.map((r) => ({
          key: r.source,
          label: sourceLabel(r.source),
          value: r.visits,
          sharePct: total > 0 ? Math.round((r.visits / total) * 100) : 0,
        })),
      };
    },
  },
  {
    id: 'builder.traffic.email_campaigns',
    module: 'builder',
    label: 'Visits from your emails',
    unit: 'count',
    grains: ALL_GRAINS,
    shapes: ['breakdown'],
    additive: true,
    scope: 'property',
    async resolve(ctx): Promise<MetricData> {
      const propertyId = siteOf(ctx);
      const { from, toExclusive } = ctx.range;
      const rows = await ctx.run((tx) => reports.emailCampaigns(tx, propertyId, from, toExclusive));
      const total = rows.reduce((sum, r) => sum + r.visits, 0);
      const limited = ctx.limit ? rows.slice(0, ctx.limit) : rows;
      return {
        rows: limited.map((r) => ({
          key: r.campaign,
          label: r.campaign,
          value: r.visits,
          sharePct: total > 0 ? Math.round((r.visits / total) * 100) : 0,
        })),
      };
    },
  },
  {
    id: 'builder.traffic.top_pages',
    module: 'builder',
    label: 'Most-read pages',
    unit: 'count',
    grains: ALL_GRAINS,
    shapes: ['list'],
    additive: true,
    scope: 'property',
    async resolve(ctx): Promise<MetricData> {
      const propertyId = siteOf(ctx);
      const { from, toExclusive } = ctx.range;
      const rows = await ctx.run((tx) =>
        reports.topPages(tx, propertyId, from, toExclusive, ctx.limit ?? 8)
      );
      return {
        rows: rows.map((r) => ({
          id: r.path,
          label: r.path,
          value: r.views,
          secondary:
            r.visitors === 1
              ? '1 visitor'
              : `${new Intl.NumberFormat().format(r.visitors)} visitors`,
          drillParams: { path: r.path },
        })),
      };
    },
  },
];
