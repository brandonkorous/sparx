// Scheduling analytics (docs/79 §12) — the dashboard Reports read. One range query
// returns booking volume + outcome mix, no-show rate, completed revenue, upcoming
// load, and the busiest services.
//
//   GET /v1/scheduling/reports?from=&to=  → the report

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { ok } from '@sparx/api-core/envelope';
import { getSchedulingReport } from '@sparx/scheduling';

import { requireSchedulingModule, toSchedulingContext } from '../../../lib/scheduling-context.js';

const ReportQuery = z.object({
  from: z.string().datetime(),
  to: z.string().datetime(),
});

// eslint-disable-next-line @typescript-eslint/require-await -- FastifyPluginAsync type demands async; route registration is sync.
const schedulingReportRoutes: FastifyPluginAsync = async (app) => {
  app.get('/v1/scheduling/reports', async (request) => {
    await requireSchedulingModule(request);
    const { tenantId } = toSchedulingContext(request);
    const q = ReportQuery.parse(request.query);
    return ok(await getSchedulingReport(tenantId, q, Date.now()));
  });
};

export default schedulingReportRoutes;
