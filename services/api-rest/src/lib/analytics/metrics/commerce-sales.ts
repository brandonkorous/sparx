// Sales metrics — the commerce dashboard's measures (docs/129 §8).
//
// Every metric delegates to the commerce `reportingService` — the same functions
// MCP read-tools and the GraphQL resolvers already call (docs/130 §1.4) — so this
// is a façade, not a reimplementation. `reportingService` runs its own
// `withTenant`, and because `ServiceContext = TenantContext` we pass our reporting
// transaction as `{ tenantId, tx }` so it composes onto the connection that
// already carries the statement timeout.
//
// Commerce revenue is not yet in a per-site rollup (docs/130 §2.4 is the migration
// that changes this), so these are `scope: 'tenant'` — a Sales dashboard reads
// across the whole business, labelled as such, until per-site revenue lands.

import { reportingService } from '@sparx/commerce';
import type { TxClient } from '@sparx/db';
import type { MetricContext, MetricData, MetricDefinition } from '../types.js';

const ALL_GRAINS = ['day', 'week', 'month'] as const;

// A sales channel's plain-language name — an owner does not know "b2b_portal".
const CHANNEL_LABEL: Record<string, string> = {
  storefront: 'Your website',
  b2b_portal: 'Wholesale portal',
  admin: 'Added by your team',
  subscription: 'Subscriptions',
  mcp: 'AI assistant',
  import: 'Imported',
  sparx_market: 'sparx.market',
  marketplace: 'Marketplaces',
  unknown: 'Other',
};

function channelLabel(channel: string): string {
  return CHANNEL_LABEL[channel] ?? channel;
}

/** The service range from the resolved window — commerce's `DateRange` is ISO
 *  strings and treats `to` as inclusive, which is exactly our inclusive `to`. */
function serviceRange(ctx: MetricContext): { from: string; to: string } {
  return { from: ctx.range.from.toISOString(), to: ctx.range.to.toISOString() };
}

/** The commerce ServiceContext that composes onto our reporting transaction —
 *  `ServiceContext = TenantContext`, so passing our open `tx` makes the service's
 *  own `withTenant` reuse this connection rather than opening a fresh one. */
function svc(ctx: MetricContext, tx: TxClient) {
  return { tenantId: ctx.tenantId, tx };
}

export const COMMERCE_SALES_METRICS: readonly MetricDefinition[] = [
  {
    id: 'commerce.revenue.net',
    module: 'commerce',
    label: 'Revenue',
    unit: 'currency',
    grains: ALL_GRAINS,
    shapes: ['kpi', 'timeseries', 'scalar'],
    // Net revenue after refunds sums across buckets.
    additive: true,
    scope: 'tenant',
    async resolve(ctx): Promise<MetricData> {
      if (ctx.shape === 'timeseries') {
        const series = await ctx.run((tx) =>
          reportingService.revenueTimeseries(svc(ctx, tx), {
            range: serviceRange(ctx),
            grain: ctx.range.grain,
          })
        );
        return {
          grain: ctx.range.grain,
          series: [{ key: 'net', label: 'Revenue' }],
          points: series.points.map((p) => ({ bucket: p.bucket, net: p.netCents })),
        };
      }
      const [summary, spark] = await Promise.all([
        ctx.run((tx) => reportingService.revenueSummary(svc(ctx, tx), serviceRange(ctx))),
        ctx.shape === 'kpi'
          ? ctx
              .run((tx) =>
                reportingService.revenueTimeseries(svc(ctx, tx), {
                  range: serviceRange(ctx),
                  grain: 'day',
                })
              )
              .then((s) => s.points.map((p) => p.netCents))
          : Promise.resolve(undefined),
      ]);
      return { value: summary.netRevenueCents, spark };
    },
  },
  {
    id: 'commerce.orders.count',
    module: 'commerce',
    label: 'Orders',
    unit: 'count',
    grains: ALL_GRAINS,
    shapes: ['kpi', 'scalar'],
    additive: true,
    scope: 'tenant',
    async resolve(ctx): Promise<MetricData> {
      const [summary, spark] = await Promise.all([
        ctx.run((tx) => reportingService.revenueSummary(svc(ctx, tx), serviceRange(ctx))),
        ctx.shape === 'kpi'
          ? ctx
              .run((tx) =>
                reportingService.revenueTimeseries(svc(ctx, tx), {
                  range: serviceRange(ctx),
                  grain: 'day',
                })
              )
              .then((s) => s.points.map((p) => p.ordersCount))
          : Promise.resolve(undefined),
      ]);
      return { value: summary.ordersCount, spark };
    },
  },
  {
    id: 'commerce.orders.aov',
    module: 'commerce',
    label: 'Average order value',
    unit: 'currency',
    grains: ALL_GRAINS,
    shapes: ['kpi', 'scalar'],
    // An average is not additive across buckets.
    additive: false,
    scope: 'tenant',
    async resolve(ctx): Promise<MetricData> {
      const summary = await ctx.run((tx) =>
        reportingService.revenueSummary(svc(ctx, tx), serviceRange(ctx))
      );
      return { value: summary.averageOrderValueCents };
    },
  },
  {
    id: 'commerce.revenue.by_channel',
    module: 'commerce',
    label: 'Revenue by channel',
    unit: 'currency',
    grains: ALL_GRAINS,
    shapes: ['breakdown'],
    additive: true,
    scope: 'tenant',
    async resolve(ctx): Promise<MetricData> {
      const breakdown = await ctx.run((tx) =>
        reportingService.channelBreakdown(svc(ctx, tx), serviceRange(ctx))
      );
      const rows = ctx.limit ? breakdown.byChannel.slice(0, ctx.limit) : breakdown.byChannel;
      return {
        rows: rows.map((r) => ({
          key: r.channel,
          label: channelLabel(r.channel),
          value: r.revenueCents,
          sharePct: r.sharePct,
        })),
      };
    },
  },
  {
    id: 'commerce.products.top',
    module: 'commerce',
    label: 'Best sellers',
    unit: 'currency',
    grains: ALL_GRAINS,
    shapes: ['list'],
    additive: true,
    scope: 'tenant',
    async resolve(ctx): Promise<MetricData> {
      const rows = await ctx.run((tx) =>
        reportingService.topProducts(svc(ctx, tx), {
          range: serviceRange(ctx),
          limit: ctx.limit ?? 10,
        })
      );
      return {
        rows: rows.map((r) => ({
          id: r.productId,
          label: r.productTitle,
          value: r.revenueCents,
          secondary:
            r.unitsSold === 1 ? '1 sold' : `${new Intl.NumberFormat().format(r.unitsSold)} sold`,
          drillParams: { id: r.productId },
        })),
      };
    },
  },
];
