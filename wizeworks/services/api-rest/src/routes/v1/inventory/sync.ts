// Inventory module — sync health + the unmapped-SKU review queue (docs/100 P5
// Tier C). The READ side of external sync: a source's recent ingest runs, the
// health rollup the dashboard's connection detail page shows, the pending-unmapped
// queue (with a suggested variant when an external SKU matches one of ours), and
// the two queue actions — map an unmapped SKU to a (variant, warehouse) (mints a
// link + clears the row) or ignore it. Source administration is `admin`-gated, so
// these are too. All `requireInventoryModule` (standalone-usable).
//
//   GET  /v1/inventory/sources/:id/runs                          ?take&skip
//   GET  /v1/inventory/sources/:id/health
//   GET  /v1/inventory/sources/:id/unmapped                      ?status&take&skip
//   POST /v1/inventory/sources/:id/unmapped/:unmappedId/map      → mint a link
//   POST /v1/inventory/sources/:id/unmapped/:unmappedId/ignore

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { inventoryService } from '@wizeworks/inventory';
import { MapUnmappedSkuInput } from '@wizeworks/commerce-schemas';
import { ok, paged } from '@wizeworks/api-core/envelope';
import { requireRole } from '@wizeworks/api-core/auth';
import { requireInventoryModule, toInventoryContext } from '../../../lib/inventory-context.js';

const PathId = z.object({ id: z.string().uuid() });
const PathUnmapped = z.object({ id: z.string().uuid(), unmappedId: z.string().uuid() });

const RunsQuery = z.object({
  take: z.coerce.number().int().min(1).max(100).default(20),
  skip: z.coerce.number().int().min(0).default(0),
});

const UnmappedQuery = z.object({
  status: z.enum(['pending', 'ignored']).default('pending'),
  take: z.coerce.number().int().min(1).max(500).default(100),
  skip: z.coerce.number().int().min(0).default(0),
});

// eslint-disable-next-line @typescript-eslint/require-await -- FastifyPluginAsync signature
const inventorySyncRoutes: FastifyPluginAsync = async (app) => {
  // ── Recent runs ───────────────────────────────────────────────────────────────
  app.get('/v1/inventory/sources/:id/runs', async (request, reply) => {
    await requireInventoryModule(request);
    requireRole(request, 'admin');
    const { id } = PathId.parse(request.params);
    const q = RunsQuery.parse(request.query);
    const { rows, total } = await inventoryService.listSyncRuns(toInventoryContext(request), {
      sourceId: id,
      take: q.take,
      skip: q.skip,
    });
    return reply.send(paged(rows, { total, skip: q.skip, per_page: q.take }));
  });

  // ── Health rollup ───────────────────────────────────────────────────────────────
  app.get('/v1/inventory/sources/:id/health', async (request, reply) => {
    await requireInventoryModule(request);
    requireRole(request, 'admin');
    const { id } = PathId.parse(request.params);
    const health = await inventoryService.getSyncHealth(toInventoryContext(request), id);
    return reply.send(ok(health));
  });

  // ── Unmapped-SKU queue ───────────────────────────────────────────────────────────
  app.get('/v1/inventory/sources/:id/unmapped', async (request, reply) => {
    await requireInventoryModule(request);
    requireRole(request, 'admin');
    const { id } = PathId.parse(request.params);
    const q = UnmappedQuery.parse(request.query);
    const { rows, total } = await inventoryService.listUnmappedSkus(toInventoryContext(request), {
      sourceId: id,
      status: q.status,
      take: q.take,
      skip: q.skip,
    });
    return reply.send(paged(rows, { total, skip: q.skip, per_page: q.take }));
  });

  // ── Map an unmapped SKU → mint a link ─────────────────────────────────────────────
  app.post('/v1/inventory/sources/:id/unmapped/:unmappedId/map', async (request, reply) => {
    await requireInventoryModule(request);
    requireRole(request, 'admin');
    const { unmappedId } = PathUnmapped.parse(request.params);
    const body = MapUnmappedSkuInput.parse(request.body);
    const result = await inventoryService.mapUnmappedSku(
      toInventoryContext(request),
      unmappedId,
      body
    );
    return reply.status(201).send(ok(result));
  });

  // ── Ignore an unmapped SKU ────────────────────────────────────────────────────────
  app.post('/v1/inventory/sources/:id/unmapped/:unmappedId/ignore', async (request, reply) => {
    await requireInventoryModule(request);
    requireRole(request, 'admin');
    const { unmappedId } = PathUnmapped.parse(request.params);
    await inventoryService.ignoreUnmappedSku(toInventoryContext(request), unmappedId);
    return reply.status(204).send();
  });
};

export default inventorySyncRoutes;
