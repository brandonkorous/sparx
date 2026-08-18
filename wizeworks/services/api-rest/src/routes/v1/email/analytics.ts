// Email analytics — engagement rollups from the EmailEvent log.
//
//   GET /v1/email/analytics/overview?days=30           → counts + suppressions + recent
//   GET /v1/email/analytics/subscriber-growth?from&to&grain → list growth + current size

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { analyticsService } from '@wizeworks/email-platform';
import { ok } from '@wizeworks/api-core/envelope';
import { requireRole } from '@wizeworks/api-core/auth';
import { requireEmailModule, toEmailContext } from '../../../lib/email-context.js';

const OverviewQuery = z.object({ days: z.coerce.number().int().min(1).max(365).optional() });

const GrowthQuery = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  grain: z.enum(['day', 'week', 'month']).optional(),
});

const emailAnalyticsRoutes: FastifyPluginAsync = (app) => {
  app.get('/v1/email/analytics/overview', async (request) => {
    requireRole(request, 'viewer');
    await requireEmailModule(request);
    const q = OverviewQuery.parse(request.query);
    return ok(await analyticsService.overview(toEmailContext(request), q.days ?? 30));
  });

  // Subscriber / list growth: contacts added (customers w/ email) minus removed
  // (marketing suppressions) per bucket, plus the current mailable list size.
  app.get('/v1/email/analytics/subscriber-growth', async (request) => {
    requireRole(request, 'viewer');
    await requireEmailModule(request);
    const q = GrowthQuery.parse(request.query);
    const range =
      q.from !== undefined && q.to !== undefined ? { from: q.from, to: q.to } : undefined;
    return ok(
      await analyticsService.subscriberGrowth(toEmailContext(request), {
        ...(range ? { range } : {}),
        ...(q.grain ? { grain: q.grain } : {}),
      })
    );
  });

  return Promise.resolve();
};

export default emailAnalyticsRoutes;
