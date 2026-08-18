// Scheduling analytics (docs/79 §12) — the dashboard Reports read. One range query
// returns booking volume + outcome mix, no-show rate, completed revenue, upcoming
// load, how full the diary runs, when it is busiest, and the busiest services.
//
//   GET /v1/scheduling/reports?from=&to=[&property=]  → the report
//
// SITE-SCOPED (docs/131 §3.7): absence of `?property=` reports the ACTIVE site
// (the `x-sparx-property-id` header), so switching sites in the chrome re-scopes
// the whole report. `?property=all` widens to every site this member may reach —
// a report must never silently merge two businesses under one billing account.

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { ok } from '@wizeworks/api-core/envelope';
import { requireRole } from '@wizeworks/api-core/auth';
import { getSchedulingReport } from '@wizeworks/scheduling';

import { requireSchedulingModule, toSchedulingContext } from '../../../lib/scheduling-context.js';
import { resolveListScopeIds } from '../../../lib/property.js';

const ReportQuery = z.object({
  from: z.string().datetime(),
  to: z.string().datetime(),
  // A site id, the literal `all` for a cross-site report, or absent for the
  // active site (docs/131 §3.7).
  property: z.string().min(1).max(64).optional(),
});

// eslint-disable-next-line @typescript-eslint/require-await -- FastifyPluginAsync type demands async; route registration is sync.
const schedulingReportRoutes: FastifyPluginAsync = async (app) => {
  app.get('/v1/scheduling/reports', async (request) => {
    const auth = requireRole(request, 'viewer');
    await requireSchedulingModule(request);
    const { tenantId } = toSchedulingContext(request);
    const q = ReportQuery.parse(request.query);
    // undefined = genuinely unscoped (unrestricted caller asking for `all`);
    // otherwise a one-or-more-site set the report is confined to.
    const propertyIds = await resolveListScopeIds(
      auth,
      q.property,
      request.headers['x-sparx-property-id']
    );
    return ok(
      await getSchedulingReport(tenantId, { from: q.from, to: q.to, propertyIds }, Date.now())
    );
  });
};

export default schedulingReportRoutes;
