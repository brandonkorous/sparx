// Commerce — storefront settings + reporting (revenue, top products, etc).

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { reportingService, storefrontService } from '@sparx/commerce';
import { ok } from '@sparx/api-core/envelope';
import { requireRole } from '@sparx/api-core/auth';
import { requireCommerceModule, toCommerceContext } from '../../../lib/commerce-context.js';
import { resolvePropertyId } from '../../../lib/property.js';

/** The active site (docs/49 Phase 6): the `x-sparx-property-id` the dashboard
 *  switcher sets, else the tenant's primary. */
function resolveRequestProperty(request: { headers: Record<string, unknown> }, tenantId: string) {
  const requested = request.headers['x-sparx-property-id'];
  return resolvePropertyId(tenantId, typeof requested === 'string' ? requested : null);
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

function resolveRange(input: { from?: string; to?: string }): { from: string; to: string } {
  const to = input.to ?? new Date().toISOString();
  const from = input.from ?? new Date(new Date(to).getTime() - 30 * 24 * 60 * 60_000).toISOString();
  return { from, to };
}

// eslint-disable-next-line @typescript-eslint/require-await -- FastifyPluginAsync type demands async; no top-level await needed because route registration is sync.
const storefrontRoutes: FastifyPluginAsync = async (app) => {
  // Storefront settings
  app.get('/v1/commerce/storefront/settings', async (request) => {
    requireRole(request, 'viewer');
    await requireCommerceModule(request);
    const ctx = toCommerceContext(request);
    const propertyId = await resolveRequestProperty(request, ctx.tenantId);
    return ok(await storefrontService.getSettings(ctx, propertyId));
  });

  app.patch('/v1/commerce/storefront/settings', async (request) => {
    requireRole(request, 'admin');
    await requireCommerceModule(request);
    const ctx = toCommerceContext(request);
    const propertyId = await resolveRequestProperty(request, ctx.tenantId);
    await storefrontService.updateSettings(ctx, propertyId, request.body);
    return ok({ updated: true });
  });

  app.get('/v1/commerce/storefront/theme', async (request) => {
    requireRole(request, 'viewer');
    await requireCommerceModule(request);
    const ctx = toCommerceContext(request);
    const propertyId = await resolveRequestProperty(request, ctx.tenantId);
    return ok(await storefrontService.getTheme(ctx, propertyId));
  });

  app.patch('/v1/commerce/storefront/theme', async (request) => {
    requireRole(request, 'admin');
    await requireCommerceModule(request);
    const ctx = toCommerceContext(request);
    const propertyId = await resolveRequestProperty(request, ctx.tenantId);
    await storefrontService.updateTheme(ctx, propertyId, request.body);
    return ok({ updated: true });
  });

  // Reporting
  app.get('/v1/commerce/reports/revenue-summary', async (request) => {
    requireRole(request, 'viewer');
    await requireCommerceModule(request);
    const range = resolveRange(RangeQuery.parse(request.query));
    return ok(await reportingService.revenueSummary(toCommerceContext(request), range));
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
};

export default storefrontRoutes;
