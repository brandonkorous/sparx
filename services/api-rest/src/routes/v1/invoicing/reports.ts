// Invoicing — reporting reads (docs/87 §8, docs/97 §5).
//
//   GET /v1/invoicing/reports/collected-timeseries?from=&to=&grain=day|week|month
//     → daily/weekly/monthly collected (net cash) + billed series
//
// Backed by the `rollup_invoicing_daily_collected` rollup: closed days are read
// pre-aggregated, the most recent open day(s) are recomputed live so "today" is
// fresh. Powers the Invoicing overview's "collected over time" chart. Gated on
// the invoicing module — which B2B/Commerce tenants satisfy for free via the
// BUNDLED_FREE graph, so they reach it without a standalone purchase.

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { invoicingReportingService } from '@sparx/crm';
import { ok } from '@sparx/api-core/envelope';
import { requireRole } from '@sparx/api-core/auth';
import { requireInvoicingModule, toInvoicingContext } from '../../../lib/invoicing-context.js';

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
  app.get('/v1/invoicing/reports/collected-timeseries', async (request) => {
    requireRole(request, 'viewer');
    await requireInvoicingModule(request);
    const q = TimeseriesQuery.parse(request.query);
    const range = resolveRange(q);
    return ok(
      await invoicingReportingService.collectedTimeseries(toInvoicingContext(request), {
        range,
        ...(q.grain ? { grain: q.grain } : {}),
      })
    );
  });

  return Promise.resolve();
};

export default reportRoutes;
