// Commerce — storefront settings + reporting (revenue, top products, etc).

import type { FastifyPluginAsync, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { reportingService, commerceSiteService } from '@sparx/commerce';
import { ok } from '@sparx/api-core/envelope';
import { requireAuth, requireRole } from '@sparx/api-core/auth';
import { requireCommerceModule, toCommerceContext } from '../../../lib/commerce-context.js';
import { resolveListScope, resolvePropertyId, type SiteActor } from '../../../lib/property.js';

/** The active site (docs/49 Phase 6): the `x-sparx-property-id` the dashboard
 *  switcher sets, else the tenant's primary. */
function resolveRequestProperty(request: FastifyRequest, actor: SiteActor) {
  const requested = request.headers['x-sparx-property-id'];
  return resolvePropertyId(actor, typeof requested === 'string' ? requested : null);
}

// Reporting endpoints accept ?from=&to= (ISO 8601) and default to the
// last 30 days when both are omitted — matches the dashboard's "last
// 30d" preset so the surface is forgiving for staff browsing the API.
const RangeQuery = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});

const LimitedRangeQuery = RangeQuery.extend({
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

const TimeseriesQuery = RangeQuery.extend({
  grain: z.enum(['day', 'week', 'month']).optional(),
  // docs/131 §6: which business's figures. A site id → that site; `all` → the
  // tenant-wide total (revenue whose site was deleted included, member-access
  // gated); absent → the active site (x-sparx-property-id). Resolved by
  // resolveListScope, which returns undefined for the all-sites total.
  property: z.string().min(1).max(63).optional(),
});

// `channel` is a derived channel key — a bucket (storefront, b2b_portal, …) or a
// marketplace source slug (tiktok_shop, etsy, …).
const ChannelTopProductsQuery = LimitedRangeQuery.extend({
  channel: z.string().min(1).max(63),
});

function resolveRange(input: { from?: string; to?: string }): { from: string; to: string } {
  const to = input.to ?? new Date().toISOString();
  const from = input.from ?? new Date(new Date(to).getTime() - 30 * 24 * 60 * 60_000).toISOString();
  return { from, to };
}

// eslint-disable-next-line @typescript-eslint/require-await -- FastifyPluginAsync type demands async; no top-level await needed because route registration is sync.
const siteCommerceRoutes: FastifyPluginAsync = async (app) => {
  // Storefront settings
  app.get('/v1/commerce/site/settings', async (request) => {
    requireRole(request, 'viewer');
    await requireCommerceModule(request);
    const ctx = toCommerceContext(request);
    const propertyId = await resolveRequestProperty(request, requireAuth(request));
    return ok(await commerceSiteService.getSettings(ctx, propertyId));
  });

  app.patch('/v1/commerce/site/settings', async (request) => {
    requireRole(request, 'admin');
    await requireCommerceModule(request);
    const ctx = toCommerceContext(request);
    const propertyId = await resolveRequestProperty(request, requireAuth(request));
    await commerceSiteService.updateSettings(ctx, propertyId, request.body);
    return ok({ updated: true });
  });

  app.get('/v1/commerce/site/theme', async (request) => {
    requireRole(request, 'viewer');
    await requireCommerceModule(request);
    const ctx = toCommerceContext(request);
    const propertyId = await resolveRequestProperty(request, requireAuth(request));
    return ok(await commerceSiteService.getTheme(ctx, propertyId));
  });

  app.patch('/v1/commerce/site/theme', async (request) => {
    requireRole(request, 'admin');
    await requireCommerceModule(request);
    const ctx = toCommerceContext(request);
    const propertyId = await resolveRequestProperty(request, requireAuth(request));
    await commerceSiteService.updateTheme(ctx, propertyId, request.body);
    return ok({ updated: true });
  });

  // Reporting
  app.get('/v1/commerce/reports/revenue-summary', async (request) => {
    requireRole(request, 'viewer');
    await requireCommerceModule(request);
    const range = resolveRange(RangeQuery.parse(request.query));
    return ok(await reportingService.revenueSummary(toCommerceContext(request), range));
  });

  // Daily/weekly/monthly revenue timeseries from the rollup (docs/97). Closed
  // days come from rollup_commerce_daily_revenue; the most recent open day(s)
  // are recomputed live so "today" is fresh. Powers the overview's revenue chart.
  app.get('/v1/commerce/reports/revenue-timeseries', async (request) => {
    requireRole(request, 'viewer');
    await requireCommerceModule(request);
    const q = TimeseriesQuery.parse(request.query);
    const range = resolveRange(q);
    const propertyId = await resolveListScope(
      requireAuth(request),
      q.property,
      request.headers['x-sparx-property-id']
    );
    return ok(
      await reportingService.revenueTimeseries(toCommerceContext(request), {
        range,
        ...(q.grain ? { grain: q.grain } : {}),
        ...(propertyId ? { propertyId } : {}),
      })
    );
  });

  app.get('/v1/commerce/reports/top-products', async (request) => {
    requireRole(request, 'viewer');
    await requireCommerceModule(request);
    const q = LimitedRangeQuery.parse(request.query);
    const range = resolveRange(q);
    return ok(
      await reportingService.topProducts(toCommerceContext(request), {
        range,
        ...(q.limit ? { limit: q.limit } : {}),
      })
    );
  });

  app.get('/v1/commerce/reports/top-customers', async (request) => {
    requireRole(request, 'viewer');
    await requireCommerceModule(request);
    const q = LimitedRangeQuery.parse(request.query);
    const range = resolveRange(q);
    return ok(
      await reportingService.topCustomers(toCommerceContext(request), {
        range,
        ...(q.limit ? { limit: q.limit } : {}),
      })
    );
  });

  app.get('/v1/commerce/reports/conversion-funnel', async (request) => {
    requireRole(request, 'viewer');
    await requireCommerceModule(request);
    const range = resolveRange(RangeQuery.parse(request.query));
    return ok(await reportingService.conversionFunnel(toCommerceContext(request), range));
  });

  app.get('/v1/commerce/reports/abandoned-carts', async (request) => {
    requireRole(request, 'viewer');
    await requireCommerceModule(request);
    const range = resolveRange(RangeQuery.parse(request.query));
    return ok(await reportingService.abandonedCarts(toCommerceContext(request), range));
  });

  app.get('/v1/commerce/reports/subscription-metrics', async (request) => {
    requireRole(request, 'viewer');
    await requireCommerceModule(request);
    const range = resolveRange(RangeQuery.parse(request.query));
    return ok(await reportingService.subscriptionMetrics(toCommerceContext(request), range));
  });

  app.get('/v1/commerce/reports/inventory-valuation', async (request) => {
    requireRole(request, 'viewer');
    await requireCommerceModule(request);
    return ok(await reportingService.inventoryValuation(toCommerceContext(request)));
  });

  // Per-discount redemption economics over a window (defaults to last 90 days).
  app.get('/v1/commerce/reports/discount-performance', async (request) => {
    requireRole(request, 'viewer');
    await requireCommerceModule(request);
    const q = LimitedRangeQuery.parse(request.query);
    const hasRange = q.from !== undefined && q.to !== undefined;
    return ok(
      await reportingService.discountPerformance(toCommerceContext(request), {
        ...(hasRange ? { range: resolveRange(q) } : {}),
        ...(q.limit ? { limit: q.limit } : {}),
      })
    );
  });

  // Orders + revenue split by channel (the derivable half of traffic sources).
  app.get('/v1/commerce/reports/channel-breakdown', async (request) => {
    requireRole(request, 'viewer');
    await requireCommerceModule(request);
    const q = RangeQuery.parse(request.query);
    const hasRange = q.from !== undefined && q.to !== undefined;
    return ok(
      await reportingService.channelBreakdown(
        toCommerceContext(request),
        hasRange ? resolveRange(q) : undefined
      )
    );
  });

  // Consolidated revenue across every channel — native + each marketplace split by
  // source, with channel fees + net-after-fees (docs/27 §8). The richer sibling of
  // channel-breakdown that powers the channel-performance surface + MCP tools.
  app.get('/v1/commerce/reports/channel-revenue', async (request) => {
    requireRole(request, 'viewer');
    await requireCommerceModule(request);
    const q = RangeQuery.parse(request.query);
    const hasRange = q.from !== undefined && q.to !== undefined;
    return ok(
      await reportingService.channelComparison(
        toCommerceContext(request),
        hasRange ? resolveRange(q) : undefined
      )
    );
  });

  // Top products sold through one channel over the window (docs/27 §8).
  app.get('/v1/commerce/reports/channel-top-products', async (request) => {
    requireRole(request, 'viewer');
    await requireCommerceModule(request);
    const q = ChannelTopProductsQuery.parse(request.query);
    const hasRange = q.from !== undefined && q.to !== undefined;
    return ok(
      await reportingService.channelTopProducts(toCommerceContext(request), {
        channel: q.channel,
        ...(hasRange ? { range: resolveRange(q) } : {}),
        ...(q.limit ? { limit: q.limit } : {}),
      })
    );
  });
};

export default siteCommerceRoutes;
