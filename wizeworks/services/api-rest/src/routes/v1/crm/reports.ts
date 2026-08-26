// CRM reporting — read-only metrics for the dashboard reports page and the
// MCP get_crm_metrics tool. Live queries today; rollup table comes later.
//
//   GET /v1/crm/reports/snapshot                  → tenant KPI snapshot
//   GET /v1/crm/reports/pipeline-funnel?pipeline_id  → funnel by stage
//   GET /v1/crm/reports/win-loss?pipeline_id&since   → win/loss by rep
//   GET /v1/crm/reports/acquisition?months           → new customers per month
//   GET /v1/crm/reports/lead-response                → who is still waiting

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { leadClock, reportingService } from '@wizeworks/crm';
import { ok } from '@wizeworks/api-core/envelope';
import { requireRole } from '@wizeworks/api-core/auth';
import { requireCrmModule, toCrmContext } from '../../../lib/crm-context.js';

const FunnelQuery = z.object({ pipeline_id: z.string().uuid() });
const WinLossQuery = z.object({
  pipeline_id: z.string().uuid().optional(),
  since: z.string().datetime().optional(),
});
const AcquisitionQuery = z.object({ months: z.coerce.number().int().min(1).max(36).optional() });
const RangeQuery = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});
const LeadResponseQuery = z.object({
  limit: z.coerce.number().int().min(1).max(200).optional(),
});
const SegmentSummaryQuery = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

const reportRoutes: FastifyPluginAsync = (app) => {
  app.get('/v1/crm/reports/snapshot', async (request) => {
    requireRole(request, 'viewer');
    await requireCrmModule(request);
    const snapshot = await reportingService.tenantSnapshot(toCrmContext(request));
    return ok(snapshot);
  });

  // The lead response clock (docs/152 D2). Two numbers and a queue, because
  // "12 waiting" and "12 waiting, 4 of them late" are different mornings — and
  // because a clock nobody can look at is a number in a report afterwards
  // rather than a thing that prevents the miss.
  app.get('/v1/crm/reports/lead-response', async (request) => {
    requireRole(request, 'viewer');
    await requireCrmModule(request);
    const ctx = toCrmContext(request);
    const { limit } = LeadResponseQuery.parse(request.query);
    const [counts, waiting] = await Promise.all([
      leadClock.leadResponseCounts(ctx),
      leadClock.leadsAwaitingResponse(ctx, limit ? { limit } : {}),
    ]);
    return ok({ ...counts, waiting });
  });

  app.get('/v1/crm/reports/pipeline-funnel', async (request) => {
    requireRole(request, 'viewer');
    await requireCrmModule(request);
    const q = FunnelQuery.parse(request.query);
    const rows = await reportingService.pipelineFunnel(toCrmContext(request), q.pipeline_id);
    return ok(rows);
  });

  app.get('/v1/crm/reports/win-loss', async (request) => {
    requireRole(request, 'viewer');
    await requireCrmModule(request);
    const q = WinLossQuery.parse(request.query);
    const rows = await reportingService.winLossByRep(toCrmContext(request), {
      pipelineId: q.pipeline_id,
      since: q.since ? new Date(q.since) : undefined,
    });
    return ok(rows);
  });

  app.get('/v1/crm/reports/acquisition', async (request) => {
    requireRole(request, 'viewer');
    await requireCrmModule(request);
    const q = AcquisitionQuery.parse(request.query);
    const rows = await reportingService.acquisitionByMonth(toCrmContext(request), {
      months: q.months,
    });
    return ok(rows);
  });

  // New customers grouped by their derived acquisition source (first-order
  // channel, falling back to b2b/direct). Defaults to the last 90 days.
  app.get('/v1/crm/reports/leads-by-source', async (request) => {
    requireRole(request, 'viewer');
    await requireCrmModule(request);
    const q = RangeQuery.parse(request.query);
    const range =
      q.from !== undefined && q.to !== undefined ? { from: q.from, to: q.to } : undefined;
    return ok(
      await reportingService.leadsBySource(toCrmContext(request), range ? { range } : undefined)
    );
  });

  // Aggregate task health: open / overdue / due-today / completed-30d + the
  // open-task priority mix.
  app.get('/v1/crm/reports/tasks', async (request) => {
    requireRole(request, 'viewer');
    await requireCrmModule(request);
    return ok(await reportingService.taskMetrics(toCrmContext(request)));
  });

  // Every active segment with its member count in one call.
  app.get('/v1/crm/reports/segments', async (request) => {
    requireRole(request, 'viewer');
    await requireCrmModule(request);
    const limit = SegmentSummaryQuery.parse(request.query).limit;
    return ok(
      await reportingService.segmentSummary(
        toCrmContext(request),
        limit !== undefined ? { limit } : undefined
      )
    );
  });

  return Promise.resolve();
};

export default reportRoutes;
