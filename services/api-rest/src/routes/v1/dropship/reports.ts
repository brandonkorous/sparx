// Dropship — reporting reads (docs/97 §5).
//
//   GET /v1/dropship/reports/orders-timeseries?from=&to=&grain=day|week|month
//     → daily/weekly/monthly routed-order count + revenue + cost series
//
// Backed by the `rollup_dropship_daily_orders` rollup: closed days are read
// pre-aggregated, the most recent open day(s) are recomputed live so "today" is
// fresh. Powers the Dropship overview's "order volume" chart. The timeseries
// reporting logic lives on the commerce service spine (reportingService owns the
// dropship margin/timeseries aggregation), so the read is sourced from
// @sparx/commerce while staying gated on the dropship module. Admin-gated to
// match the sibling /v1/dropship/analytics surface — same supplier cost/margin
// sensitivity.

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { reportingService } from '@sparx/commerce';
import { ok } from '@sparx/api-core/envelope';
import { requireRole } from '@sparx/api-core/auth';
import { requireDropshipModule, toDropshipContext } from '../../../lib/dropship-context.js';

// Accepts ?from=&to= (ISO 8601) and defaults to the last 30 days when both are
// omitted — matches the dashboard's presets so the surface is forgiving.
const TimeseriesQuery = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  grain: z.enum(['day', 'week', 'month']).optional(),
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
    return ok(
      await reportingService.dropshipOrdersTimeseries(toDropshipContext(request), {
        range,
        ...(q.grain ? { grain: q.grain } : {}),
      })
    );
  });

  return Promise.resolve();
};

export default reportRoutes;
