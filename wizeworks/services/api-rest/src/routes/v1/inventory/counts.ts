// Inventory module — Counts (docs/100 P4). A counting session reconciles recorded
// stock against a physical count; on post each line writes a `recount` movement
// (absolute setOnHand) through the ledger. Variance value over the per-count
// threshold gates the post behind an admin approval — so `approve` requires the
// `admin` role while the rest is `editor`/`viewer`. All `requireInventoryModule`
// + `toInventoryContext` (standalone-usable).
//
//   GET  /v1/inventory/counts                  ?status&warehouse_id&take&skip
//   POST /v1/inventory/counts                  → start a count (cycle/full)
//   GET  /v1/inventory/counts/:id
//   POST /v1/inventory/counts/:id/lines        → add a variant (counting)
//   DEL  /v1/inventory/counts/:id/lines/:lineId
//   POST /v1/inventory/counts/:id/entries      → record counted quantities
//   POST /v1/inventory/counts/:id/submit       → submit for review
//   POST /v1/inventory/counts/:id/approve      → admin sign-off (over threshold)
//   POST /v1/inventory/counts/:id/post         → apply the recount movements
//   POST /v1/inventory/counts/:id/cancel

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { inventoryService } from '@wizeworks/inventory';
import { InventoryCountStatus } from '@wizeworks/commerce-schemas';
import { ok, paged } from '@wizeworks/api-core/envelope';
import { requireRole } from '@wizeworks/api-core/auth';
import {
  redactCosts,
  requireInventoryModule,
  requireScanCapable,
  toInventoryContext,
} from '../../../lib/inventory-context.js';

const PathId = z.object({ id: z.string().uuid() });
const PathLine = z.object({ id: z.string().uuid(), lineId: z.string().uuid() });

const ListQuery = z.object({
  q: z.string().trim().min(1).max(200).optional(),
  status: InventoryCountStatus.optional(),
  warehouse_id: z.string().uuid().optional(),
  take: z.coerce.number().int().min(1).max(250).optional(),
  skip: z.coerce.number().int().min(0).optional(),
});

// eslint-disable-next-line @typescript-eslint/require-await -- FastifyPluginAsync signature
const inventoryCountRoutes: FastifyPluginAsync = async (app) => {
  app.get('/v1/inventory/counts', async (request, reply) => {
    await requireInventoryModule(request);
    requireRole(request, 'viewer');
    const q = ListQuery.parse(request.query);
    const { items, total } = await inventoryService.listInventoryCounts(
      toInventoryContext(request),
      {
        ...(q.q !== undefined ? { q: q.q } : {}),
        ...(q.status !== undefined ? { status: q.status } : {}),
        ...(q.warehouse_id !== undefined ? { warehouseId: q.warehouse_id } : {}),
        ...(q.take !== undefined ? { take: q.take } : {}),
        ...(q.skip !== undefined ? { skip: q.skip } : {}),
      }
    );
    return reply.send(
      paged(redactCosts(request, items), { total, skip: q.skip ?? 0, per_page: q.take ?? 50 })
    );
  });

  app.post('/v1/inventory/counts', async (request, reply) => {
    await requireInventoryModule(request);
    requireRole(request, 'editor');
    const created = await inventoryService.createInventoryCount(
      toInventoryContext(request),
      request.body
    );
    return reply.status(201).send(ok(created));
  });

  app.get('/v1/inventory/counts/:id', async (request, reply) => {
    await requireInventoryModule(request);
    requireRole(request, 'viewer');
    const { id } = PathId.parse(request.params);
    // A count detail carries the variance VALUE, which is a cost figure — the one
    // number a scanner is promised they cannot see.
    return reply.send(
      ok(
        redactCosts(
          request,
          await inventoryService.getInventoryCount(toInventoryContext(request), id)
        )
      )
    );
  });

  app.post('/v1/inventory/counts/:id/lines', async (request, reply) => {
    await requireInventoryModule(request);
    requireRole(request, 'editor');
    const { id } = PathId.parse(request.params);
    const updated = await inventoryService.addCountLine(
      toInventoryContext(request),
      id,
      request.body
    );
    return reply.send(ok(updated));
  });

  app.delete('/v1/inventory/counts/:id/lines/:lineId', async (request, reply) => {
    await requireInventoryModule(request);
    requireRole(request, 'editor');
    const { id, lineId } = PathLine.parse(request.params);
    const updated = await inventoryService.removeCountLine(toInventoryContext(request), id, lineId);
    return reply.send(ok(updated));
  });

  // Entering counts IS the warehouse floor's job (docs/146 Phase 1), so this uses
  // the scan-capable allow-list rather than the ranked `editor` gate — which the
  // lateral `scanner` role would fail. POSTING the count stays `editor`: the
  // person who counts a shelf is not necessarily the person who should sign off
  // on the stock correction it implies, and keeping those apart is most of what
  // makes a floor login safe to hand out.
  app.post('/v1/inventory/counts/:id/entries', async (request, reply) => {
    await requireInventoryModule(request);
    requireScanCapable(request);
    const { id } = PathId.parse(request.params);
    const updated = await inventoryService.enterCounts(
      toInventoryContext(request),
      id,
      request.body
    );
    return reply.send(ok(redactCosts(request, updated)));
  });

  app.post('/v1/inventory/counts/:id/submit', async (request, reply) => {
    await requireInventoryModule(request);
    requireScanCapable(request);
    const { id } = PathId.parse(request.params);
    return reply.send(
      ok(
        redactCosts(
          request,
          await inventoryService.submitInventoryCount(toInventoryContext(request), id)
        )
      )
    );
  });

  app.post('/v1/inventory/counts/:id/approve', async (request, reply) => {
    await requireInventoryModule(request);
    requireRole(request, 'admin');
    const { id } = PathId.parse(request.params);
    return reply.send(
      ok(await inventoryService.approveInventoryCount(toInventoryContext(request), id))
    );
  });

  app.post('/v1/inventory/counts/:id/post', async (request, reply) => {
    await requireInventoryModule(request);
    requireRole(request, 'editor');
    const { id } = PathId.parse(request.params);
    return reply.send(
      ok(await inventoryService.postInventoryCount(toInventoryContext(request), id))
    );
  });

  app.post('/v1/inventory/counts/:id/cancel', async (request, reply) => {
    await requireInventoryModule(request);
    requireRole(request, 'editor');
    const { id } = PathId.parse(request.params);
    return reply.send(
      ok(await inventoryService.cancelInventoryCount(toInventoryContext(request), id))
    );
  });
};

export default inventoryCountRoutes;
