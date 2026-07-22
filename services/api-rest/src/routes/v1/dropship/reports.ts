// Dropship — reporting reads (docs/97 §5).
//
//   GET /v1/dropship/reports/orders-timeseries?from=&to=&grain=day|week|month
//     → daily/weekly/monthly routed-order count + revenue + cost series
//   GET /v1/dropship/reports/supplier-sla?from=&to=
//     → fulfillment timeliness (ship/delivery durations, on-time %, fulfillment
//       & failure rates) overall and per supplier, from order lifecycle stamps
//   GET /v1/dropship/reports/activity?limit=
//     → most recently-touched routed orders (a lifecycle feed)
//
// The order-volume series is backed by the `rollup_dropship_daily_orders`
// rollup: closed days are read pre-aggregated, the most recent open day(s) are
// recomputed live so "today" is fresh. SLA + activity aggregate live over
// dropship_orders. All reporting logic lives on the commerce service spine
// (reportingService owns the dropship margin/timeseries/SLA aggregation), so the
// reads are sourced from @sparx/commerce while staying gated on the dropship
// module. Admin-gated to match the sibling /v1/dropship/analytics surface — same
// supplier cost/margin/performance sensitivity.

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { reportingService } from '@sparx/commerce';
import { ok } from '@sparx/api-core/envelope';
import { requireAuth, requireRole } from '@sparx/api-core/auth';
import { requireDropshipModule, toDropshipContext } from '../../../lib/dropship-context.js';
import { resolveListScope } from '../../../lib/property.js';

// Accepts ?from=&to= (ISO 8601) and defaults to the last 30 days when both are
// omitted — matches the dashboard's presets so the surface is forgiving.
const RangeQuery = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});

const TimeseriesQuery = RangeQuery.extend({
  grain: z.enum(['day', 'week', 'month']).optional(),
  // docs/131 §6: a site id → that site; `all` → tenant-wide (member-gated);
  // absent → active site. resolveListScope returns undefined for the all total.
  property: z.string().min(1).max(63).optional(),
});

const ActivityQuery = z.object({
  limit: z.coerce.number().int().min(1).max(50).optional(),
});

function resolveRange(input: { from?: string; to?: string }): { from: string; to: string } {
  const to = input.to ?? new Date().toISOString();
  const from = input.from ?? new Date(Date.now() - 30 * 86_400_000).toISOString();
  return { from, to };
}

const reportRoutes: FastifyPluginAsync = (app) => {
  app.get('/v1/dropship/reports/orders-timeseries', async (request) => {
    await requireDropshipModule(request);
    requireRole(request, 'admin');
    const q = TimeseriesQuery.parse(request.query);
    const range = resolveRange(q);
    const propertyId = await resolveListScope(
      requireAuth(request),
      q.property,
      request.headers['x-sparx-property-id']
    );
    return ok(
      await reportingService.dropshipOrdersTimeseries(toDropshipContext(request), {
        range,
        ...(q.grain ? { grain: q.grain } : {}),
        ...(propertyId ? { propertyId } : {}),
      })
    );
  });

  app.get('/v1/dropship/reports/supplier-sla', async (request) => {
    await requireDropshipModule(request);
    requireRole(request, 'admin');
    const range = resolveRange(RangeQuery.parse(request.query));
    return ok(await reportingService.dropshipSupplierSla(toDropshipContext(request), range));
  });

  app.get('/v1/dropship/reports/activity', async (request) => {
    await requireDropshipModule(request);
    requireRole(request, 'admin');
    const limit = ActivityQuery.parse(request.query).limit ?? 12;
    return ok(await reportingService.dropshipActivity(toDropshipContext(request), limit));
  });

  return Promise.resolve();
};

export default reportRoutes;
