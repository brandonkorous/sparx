// Sample-data routes (Wave 5) — load / clear / status for the tenant's industry
// dataset. Like /v1/industry-starters these aren't gated to one module (the engine
// self-skips disabled modules), so they ride on auth + role. Load/clear are
// admin-only (they provision across modules + are reversible-but-bulk); status is
// viewer-readable.

import type { FastifyPluginAsync } from 'fastify';
import { ok } from '@sparx/api-core/envelope';
import { requireAuth, requireRole } from '@sparx/api-core/auth';

import {
  clearTenantSampleData,
  getSampleDataStatus,
  loadTenantSampleData,
} from '../../lib/sample-data.js';

// eslint-disable-next-line @typescript-eslint/require-await -- FastifyPluginAsync demands async; route registration is sync.
const sampleDataRoutes: FastifyPluginAsync = async (app) => {
  // What sample dataset applies + whether it's currently loaded.
  app.get('/v1/sample-data', async (request) => {
    requireRole(request, 'viewer');
    const auth = requireAuth(request);
    return ok(await getSampleDataStatus({ tenantId: auth.tenantId, userId: auth.actorId }));
  });

  // Load the industry pack (idempotent — clears prior sample rows first). 201.
  app.post('/v1/sample-data/load', async (request, reply) => {
    requireRole(request, 'admin');
    const auth = requireAuth(request);
    const result = await loadTenantSampleData({ tenantId: auth.tenantId, userId: auth.actorId });
    reply.code(201);
    return ok(result);
  });

  // Remove every sample row. Returns the counts removed.
  app.post('/v1/sample-data/clear', async (request) => {
    requireRole(request, 'admin');
    const auth = requireAuth(request);
    const counts = await clearTenantSampleData({ tenantId: auth.tenantId, userId: auth.actorId });
    return ok({ counts });
  });
};

export default sampleDataRoutes;
