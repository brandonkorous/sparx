// Sample-data routes (Wave 5) — load / clear / status for the tenant's industry
// dataset. Like /v1/industry-starters these aren't gated to one module (the engine
// self-skips disabled modules), so they ride on auth + role. Load/clear are
// admin-only (they provision across modules + are reversible-but-bulk); status is
// viewer-readable.

import crypto from 'node:crypto';

import type { FastifyBaseLogger, FastifyPluginAsync } from 'fastify';
import { ok } from '@wizeworks/api-core/envelope';
import { requireAuth, requireRole } from '@wizeworks/api-core/auth';
import { publish } from '@wizeworks/api-core/pubsub';

import {
  clearTenantSampleData,
  getSampleDataStatus,
  loadTenantSampleData,
} from '../../lib/sample-data.js';

/**
 * Ask the search worker to rebuild this tenant's index from its real records.
 *
 * The engine writes every sample customer, order and product in one bulk
 * transaction, and none of them is announced one at a time, so without this the
 * console's search box answered "Nothing in your records matches" about sample
 * customers in plain view, and went on finding cleared ones that no longer
 * existed (sparx persona issue 086). One request covers a whole load. A clear
 * drops the tenant's entries first, because a rebuild from what is left cannot
 * remove an entry for a row that is gone. Never fails the load or the clear: the
 * search box's own "Put them back" still heals a missed rebuild.
 */
async function requestSearchRebuild(
  logger: FastifyBaseLogger,
  tenantId: string,
  actorId: string | null,
  dropStale: boolean
): Promise<void> {
  try {
    await publish(logger, 'search.reindex.requested', tenantId, actorId, {
      runId: `reindex_${crypto.randomUUID().replace(/-/g, '')}`,
      dropStale,
    });
  } catch (err) {
    logger.error({ err, tenantId }, 'sample data: search rebuild request failed');
  }
}

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
