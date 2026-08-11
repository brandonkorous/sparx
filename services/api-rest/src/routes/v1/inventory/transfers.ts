// Inventory module — Transfers (docs/100 P4). Move stock between two warehouses
// through a system in-transit holding location: a draft is composed of variant
// lines, shipping leaves the source and lands in-transit, receiving moves it to
// the destination, and cancelling an in-transit transfer returns the goods to
// source. Each leg writes a ledger movement so total stock is conserved. All
// `requireInventoryModule` + `toInventoryContext` (standalone-usable); reads are
// `viewer`, mutations `editor`.
//
//   GET    /v1/inventory/transfers                   ?status&warehouse_id&take&skip
//   POST   /v1/inventory/transfers                   → start a transfer (draft)
//   GET    /v1/inventory/transfers/:id
//   POST   /v1/inventory/transfers/:id/lines         → add a variant (draft)
//   PATCH  /v1/inventory/transfers/:id/lines/:lineId → change quantity (draft)
//   DELETE /v1/inventory/transfers/:id/lines/:lineId
//   DELETE /v1/inventory/transfers/:id               → delete a draft
//   POST   /v1/inventory/transfers/:id/ship          → source → in-transit
//   POST   /v1/inventory/transfers/:id/receive       → in-transit → destination
//   POST   /v1/inventory/transfers/:id/cancel

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { inventoryService } from '@sparx/inventory';
import { InventoryTransferStatus } from '@sparx/commerce-schemas';
import { ok, paged } from '@sparx/api-core/envelope';
import { requireRole } from '@sparx/api-core/auth';
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
  status: InventoryTransferStatus.optional(),
  warehouse_id: z.string().uuid().optional(),
  take: z.coerce.number().int().min(1).max(250).optional(),
  skip: z.coerce.number().int().min(0).optional(),
});

// eslint-disable-next-line @typescript-eslint/require-await -- FastifyPluginAsync signature
const inventoryTransferRoutes: FastifyPluginAsync = async (app) => {
  app.get('/v1/inventory/transfers', async (request, reply) => {
    await requireInventoryModule(request);
    requireRole(request, 'viewer');
    const q = ListQuery.parse(request.query);
    const { items, total } = await inventoryService.listInventoryTransfers(
      toInventoryContext(request),
      {
        ...(q.q !== undefined ? { q: q.q } : {}),
        ...(q.status !== undefined ? { status: q.status } : {}),
        ...(q.warehouse_id !== undefined ? { warehouseId: q.warehouse_id } : {}),
        ...(q.take !== undefined ? { take: q.take } : {}),
        ...(q.skip !== undefined ? { skip: q.skip } : {}),
      }
    );
    return reply.send(paged(items, { total, skip: q.skip ?? 0, per_page: q.take ?? 50 }));
  });

  app.post('/v1/inventory/transfers', async (request, reply) => {
    await requireInventoryModule(request);
    requireRole(request, 'editor');
    const created = await inventoryService.createInventoryTransfer(
      toInventoryContext(request),
      request.body
    );
    return reply.status(201).send(ok(created));
  });

  app.get('/v1/inventory/transfers/:id', async (request, reply) => {
    await requireInventoryModule(request);
    requireRole(request, 'viewer');
    const { id } = PathId.parse(request.params);
    return reply.send(
      ok(await inventoryService.getInventoryTransfer(toInventoryContext(request), id))
    );
  });

  app.post('/v1/inventory/transfers/:id/lines', async (request, reply) => {
    await requireInventoryModule(request);
    requireRole(request, 'editor');
    const { id } = PathId.parse(request.params);
    const updated = await inventoryService.addTransferLine(
      toInventoryContext(request),
      id,
      request.body
    );
    return reply.send(ok(updated));
  });

  app.patch('/v1/inventory/transfers/:id/lines/:lineId', async (request, reply) => {
    await requireInventoryModule(request);
    requireRole(request, 'editor');
    const { id, lineId } = PathLine.parse(request.params);
    const updated = await inventoryService.updateTransferLine(
      toInventoryContext(request),
      id,
      lineId,
      request.body
    );
    return reply.send(ok(updated));
  });

  app.delete('/v1/inventory/transfers/:id/lines/:lineId', async (request, reply) => {
    await requireInventoryModule(request);
    requireRole(request, 'editor');
    const { id, lineId } = PathLine.parse(request.params);
    const updated = await inventoryService.removeTransferLine(
      toInventoryContext(request),
      id,
      lineId
    );
    return reply.send(ok(updated));
  });

  app.delete('/v1/inventory/transfers/:id', async (request, reply) => {
    await requireInventoryModule(request);
    requireRole(request, 'editor');
    const { id } = PathId.parse(request.params);
    await inventoryService.deleteInventoryTransfer(toInventoryContext(request), id);
    return reply.status(204).send();
  });

  // Shipping and receiving a transfer are physical acts performed on the floor
  // (docs/146 Phase 1) — scan-capable rather than the ranked `editor` gate.
  // Creating, editing and cancelling a transfer stay `editor`: deciding that
  // stock should move is a different job from moving it.
  app.post('/v1/inventory/transfers/:id/ship', async (request, reply) => {
    await requireInventoryModule(request);
    requireScanCapable(request);
    const { id } = PathId.parse(request.params);
    return reply.send(
      ok(
        redactCosts(
          request,
          await inventoryService.shipInventoryTransfer(toInventoryContext(request), id)
        )
      )
    );
  });

  app.post('/v1/inventory/transfers/:id/receive', async (request, reply) => {
    await requireInventoryModule(request);
    requireScanCapable(request);
    const { id } = PathId.parse(request.params);
    return reply.send(
      ok(
        redactCosts(
          request,
          await inventoryService.receiveInventoryTransfer(
            toInventoryContext(request),
            id,
            request.body
          )
        )
      )
    );
  });

  app.post('/v1/inventory/transfers/:id/cancel', async (request, reply) => {
    await requireInventoryModule(request);
    requireRole(request, 'editor');
    const { id } = PathId.parse(request.params);
    return reply.send(
      ok(await inventoryService.cancelInventoryTransfer(toInventoryContext(request), id))
    );
  });
};

export default inventoryTransferRoutes;
