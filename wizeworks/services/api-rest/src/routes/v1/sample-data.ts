// Sample-data routes (Wave 5) — load / clear / status for the tenant's industry
// dataset. Like /v1/industry-starters these aren't gated to one module (the engine
// self-skips disabled modules), so they ride on auth + role. Load/clear are
// admin-only (they provision across modules + are reversible-but-bulk); status is
// viewer-readable.

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { ok } from '@wizeworks/api-core/envelope';
import { requireAuth, requireRole } from '@wizeworks/api-core/auth';

import {
  clearTenantSampleData,
  countTenantOwnRecords,
  getSampleDataStatus,
  loadTenantSampleData,
} from '../../lib/sample-data.js';
import { requestSearchRebuild } from '../../lib/search-rebuild.js';

const ownQuery = z.object({ kind: z.enum(['product', 'customer', 'invoice', 'article']) });

// eslint-disable-next-line @typescript-eslint/require-await -- FastifyPluginAsync demands async; route registration is sync.
const sampleDataRoutes: FastifyPluginAsync = async (app) => {
  // What sample dataset applies + whether it's currently loaded.
  app.get('/v1/sample-data', async (request) => {
    requireRole(request, 'viewer');
    const auth = requireAuth(request);
    return ok(await getSampleDataStatus({ tenantId: auth.tenantId, userId: auth.actorId }));
  });

  // How many products, customers or invoices are the business's OWN: not a
  // practice row, not a design's example product. A list total cannot say, once
  // a pack has loaded a hundred of each, and the Home checklist that read those
  // totals ticked itself off before a new owner saw it (Piggles persona issue
  // 935). One kind per request so each answer can sit under the cache key of the
  // list whose writes should refresh it.
  app.get('/v1/sample-data/own', async (request) => {
    requireRole(request, 'viewer');
    const auth = requireAuth(request);
    const { kind } = ownQuery.parse(request.query);
    return ok({
      total: await countTenantOwnRecords({ tenantId: auth.tenantId, userId: auth.actorId }, kind),
    });
  });

  // Load the industry pack (idempotent — clears prior sample rows first). 201.
  app.post('/v1/sample-data/load', async (request, reply) => {
    requireRole(request, 'admin');
    const auth = requireAuth(request);
    const result = await loadTenantSampleData({ tenantId: auth.tenantId, userId: auth.actorId });
    await requestSearchRebuild(request.log, auth.tenantId, auth.actorId, false);
    reply.code(201);
    return ok(result);
  });

  // Remove every sample row. Returns the counts removed.
  app.post('/v1/sample-data/clear', async (request) => {
    requireRole(request, 'admin');
    const auth = requireAuth(request);
    const counts = await clearTenantSampleData({ tenantId: auth.tenantId, userId: auth.actorId });
    await requestSearchRebuild(request.log, auth.tenantId, auth.actorId, true);
    return ok({ counts });
  });
};

export default sampleDataRoutes;
