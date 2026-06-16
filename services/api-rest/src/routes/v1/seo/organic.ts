// SEO — organic-search reports from Search Console (docs/50 §7, docs/97 §4).
//
//   GET /v1/seo/organic/summary?from=&to=
//     → clicks, impressions, ctr, avg position for the window
//   GET /v1/seo/organic/timeseries?from=&to=&grain=day|week|month
//     → clicks + impressions per bucket
//   GET /v1/seo/organic/top-queries?limit=
//     → top search queries by clicks (clicks/impressions/ctr/position)
//
// Reads the ingested rollup (lib/search-console/reports.ts), scoped to the
// active web property. Viewer-read, tenant-scoped via withTenant. Returns zeros
// until the tenant connects Search Console and the nightly job has run — the
// dashboard treats an all-zero/empty result as "not yet connected".

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { withTenant } from '@sparx/db';
import { ok } from '@sparx/api-core/envelope';
import { requireRole } from '@sparx/api-core/auth';

import { toSeoContext } from '../../../lib/seo-context.js';
import * as reports from '../../../lib/search-console/reports.js';

const RangeQuery = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});
const TimeseriesQuery = RangeQuery.extend({
  grain: z.enum(['day', 'week', 'month']).optional(),
});
const TopQueriesQuery = z.object({
  limit: z.coerce.number().int().min(1).max(50).optional(),
});

const organicRoutes: FastifyPluginAsync = (app) => {
  app.get('/v1/seo/organic/summary', async (request) => {
    requireRole(request, 'viewer');
    const { tenantId, propertyId } = await toSeoContext(request);
    const { from, toExclusive } = reports.resolveRange(RangeQuery.parse(request.query));
    return ok(
      await withTenant({ tenantId }, (tx) => reports.summary(tx, propertyId, from, toExclusive))
    );
  });

  app.get('/v1/seo/organic/timeseries', async (request) => {
    requireRole(request, 'viewer');
    const { tenantId, propertyId } = await toSeoContext(request);
    const q = TimeseriesQuery.parse(request.query);
    const range = reports.resolveRange(q);
    return ok(
      await withTenant({ tenantId }, (tx) =>
        reports.timeseries(tx, propertyId, range, q.grain ?? 'day')
      )
    );
  });

  app.get('/v1/seo/organic/top-queries', async (request) => {
    requireRole(request, 'viewer');
    const { tenantId, propertyId } = await toSeoContext(request);
    const { limit } = TopQueriesQuery.parse(request.query);
    return ok(
      await withTenant({ tenantId }, (tx) => reports.topQueries(tx, propertyId, limit ?? 8))
    );
  });

  return Promise.resolve();
};

export default organicRoutes;
