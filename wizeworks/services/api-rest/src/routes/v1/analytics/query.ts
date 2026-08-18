// POST /v1/analytics/query — one request per dashboard (docs/129 §5).
//
// A dashboard's whole metric list resolves in one round trip. POST, because the
// body is a QUERY, not an addressable resource — and a dashboard's metric list
// overruns a querystring quickly. The heavy lifting (partial success, module
// gating, bounded concurrency, caching, compare) is in lib/analytics/execute.ts;
// this route validates, enforces the hard cap, and resolves the site.

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { ok } from '@wizeworks/api-core/envelope';
import { requireAuth, requireRole } from '@wizeworks/api-core/auth';

import { executeQuery } from '../../../lib/analytics/execute.js';
import { resolveRange } from '../../../lib/analytics/range.js';
import { resolvePropertyId, requireTenantProperty } from '../../../lib/property.js';

// A hard cap so a malformed or hostile request cannot fan out unbounded
// (docs/129 §5). A real dashboard is well under this.
const MAX_METRICS = 24;

const TileShape = z.enum(['scalar', 'kpi', 'timeseries', 'breakdown', 'list']);

const QueryBody = z.object({
  range: z
    .object({
      from: z.string().datetime().optional(),
      to: z.string().datetime().optional(),
      grain: z.enum(['day', 'week', 'month']).optional(),
    })
    .optional(),
  // undefined → the site you are working in (header); null → the whole business
  // (all sites); a uuid → that specific site.
  property: z.string().uuid().nullable().optional(),
  metrics: z
    .array(
      z.object({
        key: z.string().min(1).max(64),
        metric: z.string().min(1).max(120),
        shape: TileShape,
        limit: z.coerce.number().int().min(1).max(100).optional(),
        compare: z.literal('previous_period').optional(),
      })
    )
    .min(1)
    .max(MAX_METRICS),
});

const analyticsQueryRoutes: FastifyPluginAsync = (app) => {
  app.post('/v1/analytics/query', async (request) => {
    requireRole(request, 'viewer');
    const actor = requireAuth(request);
    const body = QueryBody.parse(request.body);

    // Resolve which site the figures cover.
    //   • an explicit null asks for the whole business (all sites);
    //   • a named uuid is an explicit target, so it 404s on an unknown/foreign id
    //     rather than silently falling back — a report attributed to the wrong
    //     site is worse than an error;
    //   • absent falls back to the active site header, the ordinary case.
    let propertyId: string | null;
    if (body.property === null) {
      propertyId = null;
    } else if (typeof body.property === 'string') {
      propertyId = await requireTenantProperty(actor, body.property);
    } else {
      const header = request.headers['x-sparx-property-id'];
      propertyId = await resolvePropertyId(actor, typeof header === 'string' ? header : null);
    }

    const range = resolveRange(body.range ?? {});
    const results = await executeQuery({
      tenantId: actor.tenantId,
      propertyId,
      range,
      metrics: body.metrics,
    });

    return ok({
      range: {
        from: range.from.toISOString(),
        to: range.toExclusive.toISOString(),
        grain: range.grain,
      },
      property: propertyId,
      results,
    });
  });

  return Promise.resolve();
};

export default analyticsQueryRoutes;
