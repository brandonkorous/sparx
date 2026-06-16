// Builder — site analytics reporting reads (docs/97 §5, docs/08).
//
//   GET /v1/builder/analytics/summary?from=&to=
//     → visitors, pageviews, sessions, signups, pages/visit, top referrer
//   GET /v1/builder/analytics/timeseries?from=&to=&grain=day|week|month
//     → visitors + pageviews per bucket (rollup + live-overlay, docs/97 §5)
//   GET /v1/builder/analytics/top-pages?from=&to=&limit=
//     → most-viewed paths with their unique-visitor count
//   GET /v1/builder/analytics/sources?from=&to=
//     → visit mix by source class (search | direct | social | referral)
//
// LIVE first-party analytics over `site_analytics_events` (captured cookieless
// by POST /v1/public/site/collect), scoped to the ACTIVE property (the site
// switcher's x-sparx-property-id). Builder-module-gated, viewer-read,
// tenant-scoped via withTenant. The aggregation lives in lib/site-analytics-
// reports.ts (shared with the nightly rollup reconcile).

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { withTenant } from '@sparx/db';
import { ok } from '@sparx/api-core/envelope';
import { requireRole } from '@sparx/api-core/auth';

import { requireBuilderModule, toBuilderContext } from '../../../lib/builder-context.js';
import * as reports from '../../../lib/site-analytics-reports.js';

const RangeQuery = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});
const TimeseriesQuery = RangeQuery.extend({
  grain: z.enum(['day', 'week', 'month']).optional(),
});
const TopPagesQuery = RangeQuery.extend({
  limit: z.coerce.number().int().min(1).max(50).optional(),
});

const builderAnalyticsRoutes: FastifyPluginAsync = (app) => {
  app.get('/v1/builder/analytics/summary', async (request) => {
    requireRole(request, 'viewer');
    await requireBuilderModule(request);
    const { tenantId, propertyId } = await toBuilderContext(request);
    const { from, toExclusive } = reports.resolveRange(RangeQuery.parse(request.query));
    return ok(
      await withTenant({ tenantId }, (tx) => reports.summary(tx, propertyId, from, toExclusive))
    );
  });

  app.get('/v1/builder/analytics/timeseries', async (request) => {
    requireRole(request, 'viewer');
    await requireBuilderModule(request);
    const { tenantId, propertyId } = await toBuilderContext(request);
    const q = TimeseriesQuery.parse(request.query);
    const range = reports.resolveRange(q);
    return ok(
      await withTenant({ tenantId }, (tx) =>
        reports.timeseries(tx, propertyId, range, q.grain ?? 'day')
      )
    );
  });

  app.get('/v1/builder/analytics/top-pages', async (request) => {
    requireRole(request, 'viewer');
    await requireBuilderModule(request);
    const { tenantId, propertyId } = await toBuilderContext(request);
    const q = TopPagesQuery.parse(request.query);
    const { from, toExclusive } = reports.resolveRange(q);
    return ok(
      await withTenant({ tenantId }, (tx) =>
        reports.topPages(tx, propertyId, from, toExclusive, q.limit ?? 8)
      )
    );
  });

  app.get('/v1/builder/analytics/sources', async (request) => {
    requireRole(request, 'viewer');
    await requireBuilderModule(request);
    const { tenantId, propertyId } = await toBuilderContext(request);
    const { from, toExclusive } = reports.resolveRange(RangeQuery.parse(request.query));
    return ok(
      await withTenant({ tenantId }, (tx) => reports.sources(tx, propertyId, from, toExclusive))
    );
  });

  return Promise.resolve();
};

export default builderAnalyticsRoutes;
