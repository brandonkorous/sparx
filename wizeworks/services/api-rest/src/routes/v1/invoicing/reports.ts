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
import { invoicingReportingService } from '@wizeworks/crm';
import { ok } from '@wizeworks/api-core/envelope';
import { requireAuth, requireRole } from '@wizeworks/api-core/auth';
import { requireInvoicingModule, toInvoicingContext } from '../../../lib/invoicing-context.js';
import { resolveListScope } from '../../../lib/property.js';

// Accepts ?from=&to= (ISO 8601) and defaults to the last 30 days when both are
// omitted — matches the dashboard's presets so the surface is forgiving.
const TimeseriesQuery = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  grain: z.enum(['day', 'week', 'month']).optional(),
  // docs/131 §6: which business's figures. A site id → that site; `all` → the
  // tenant-wide total (member-access gated); absent → the active site
  // (x-sparx-property-id). resolveListScope returns undefined for the all-sites
  // total.
  property: z.string().min(1).max(63).optional(),
});

const CustomerBreakdownQuery = z.object({
  limit: z.coerce.number().int().min(1).max(50).optional(),
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
    const propertyId = await resolveListScope(
      requireAuth(request),
      q.property,
      request.headers['x-sparx-property-id']
    );
    return ok(
      await invoicingReportingService.collectedTimeseries(toInvoicingContext(request), {
        range,
        ...(q.grain ? { grain: q.grain } : {}),
        ...(propertyId ? { propertyId } : {}),
      })
    );
  });

  // Collections summary — collected this/last month, paid-in-full, deposits,
  // days-to-pay, and the open-balance-by-stage split (live aggregates).
  app.get('/v1/invoicing/reports/collections', async (request) => {
    requireRole(request, 'viewer');
    await requireInvoicingModule(request);
    return ok(await invoicingReportingService.collectionsSummary(toInvoicingContext(request)));
  });

  // Who owes you — top customers by outstanding balance.
  app.get('/v1/invoicing/reports/customer-breakdown', async (request) => {
    requireRole(request, 'viewer');
    await requireInvoicingModule(request);
    const limit = CustomerBreakdownQuery.parse(request.query).limit;
    return ok(
      await invoicingReportingService.customerBreakdown(
        toInvoicingContext(request),
        limit !== undefined ? { limit } : undefined
      )
    );
  });

  return Promise.resolve();
};

export default reportRoutes;
