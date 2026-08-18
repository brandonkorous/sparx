// Live Chat — analytics / reporting reads (docs/56, docs/97 §5).
//
//   GET /v1/chat/analytics/summary?from=&to=
//     → started / resolved / open counts, avg first-response latency, the
//       AI-vs-human resolution split, status + channel distributions
//   GET /v1/chat/analytics/timeseries?from=&to=&grain=day|week|month
//     → conversations started + resolved per bucket
//   GET /v1/chat/analytics/agents?from=&to=
//     → per first-responder (staff + AI): conversations handled + avg response
//   GET /v1/chat/analytics/activity?limit=
//     → most recent messages with contact name (lifecycle feed)
//
// LIVE aggregates over chat_conversations + chat_messages (analyticsService).
// Viewer-read, chat-module-gated, tenant-scoped. CSAT has no backing model yet
// and stays sample on the overview (workload B, docs/97 §4).

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { ok } from '@wizeworks/api-core/envelope';
import { requireRole } from '@wizeworks/api-core/auth';

import { requireChatModule, toChatContext } from '../../../lib/chat-context.js';
import { analyticsService } from '../../../lib/chat/index.js';

const RangeQuery = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});

const TimeseriesQuery = RangeQuery.extend({
  grain: z.enum(['day', 'week', 'month']).optional(),
});

const ActivityQuery = z.object({
  limit: z.coerce.number().int().min(1).max(50).optional(),
});

const chatAnalyticsRoutes: FastifyPluginAsync = (app) => {
  app.get('/v1/chat/analytics/summary', async (request) => {
    requireRole(request, 'viewer');
    await requireChatModule(request);
    const q = RangeQuery.parse(request.query);
    return ok(await analyticsService.summary(toChatContext(request), q));
  });

  app.get('/v1/chat/analytics/timeseries', async (request) => {
    requireRole(request, 'viewer');
    await requireChatModule(request);
    const q = TimeseriesQuery.parse(request.query);
    return ok(
      await analyticsService.timeseries(toChatContext(request), {
        from: q.from,
        to: q.to,
        ...(q.grain ? { grain: q.grain } : {}),
      })
    );
  });

  app.get('/v1/chat/analytics/agents', async (request) => {
    requireRole(request, 'viewer');
    await requireChatModule(request);
    const q = RangeQuery.parse(request.query);
    return ok(await analyticsService.agentPerformance(toChatContext(request), q));
  });

  app.get('/v1/chat/analytics/activity', async (request) => {
    requireRole(request, 'viewer');
    await requireChatModule(request);
    const limit = ActivityQuery.parse(request.query).limit ?? 12;
    return ok(await analyticsService.activity(toChatContext(request), limit));
  });

  return Promise.resolve();
};

export default chatAnalyticsRoutes;
