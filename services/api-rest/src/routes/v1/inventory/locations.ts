// Stock locations = warehouses. The inventory module's stock-holding places are
// Warehouses (the unified model — docs/100 P1c); "location" is just the module's
// user-facing word for one. These endpoints delegate to the one warehouse
// service (@sparx/inventory), inventory-module-gated so a tenant running
// Inventory standalone (no commerce) manages locations here.
//
//   GET    /v1/inventory/locations
//   POST   /v1/inventory/locations
//   GET    /v1/inventory/locations/:id
//   PATCH  /v1/inventory/locations/:id
//   DELETE /v1/inventory/locations/:id            → archive
//   GET    /v1/inventory/locations/:id/levels     → inventory levels at this warehouse

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { inventoryService } from '@sparx/inventory';
import { ok, paged } from '@sparx/api-core/envelope';
import { requireRole } from '@sparx/api-core/auth';
import { requireInventoryModule, toInventoryContext } from '../../../lib/inventory-context.js';

const PathId = z.object({ id: z.string().uuid() });

const ListQuery = z.object({
  include_archived: z.coerce.boolean().optional(),
  take: z.coerce.number().int().min(1).max(250).optional(),
  skip: z.coerce.number().int().min(0).optional(),
});

const LevelsQuery = z.object({
  take: z.coerce.number().int().min(1).max(500).optional(),
  skip: z.coerce.number().int().min(0).optional(),
  low_stock_only: z.coerce.boolean().optional(),
});

// eslint-disable-next-line @typescript-eslint/require-await -- FastifyPluginAsync signature
const inventoryLocationRoutes: FastifyPluginAsync = async (app) => {
  app.get('/v1/inventory/locations', async (request, reply) => {
    await requireInventoryModule(request);
    requireRole(request, 'viewer');
    const q = ListQuery.parse(request.query);
    const { items, total } = await inventoryService.listWarehouses(toInventoryContext(request), {
      includeInactive: q.include_archived === true,
      ...(q.take !== undefined ? { take: q.take } : {}),
      ...(q.skip !== undefined ? { skip: q.skip } : {}),
    });
    return reply.send(paged(items, { total, skip: q.skip ?? 0, per_page: q.take ?? 50 }));
  });

  app.post('/v1/inventory/locations', async (request, reply) => {
    await requireInventoryModule(request);
    requireRole(request, 'editor');
    const created = await inventoryService.createWarehouse(
      toInventoryContext(request),
      request.body
    );
    return reply.status(201).send(ok(created));
  });

  app.get('/v1/inventory/locations/:id', async (request, reply) => {
    await requireInventoryModule(request);
    requireRole(request, 'viewer');
    const { id } = PathId.parse(request.params);
    return reply.send(ok(await inventoryService.getWarehouse(toInventoryContext(request), id)));
  });

  app.patch('/v1/inventory/locations/:id', async (request, reply) => {
    await requireInventoryModule(request);
    requireRole(request, 'editor');
    const { id } = PathId.parse(request.params);
    return reply.send(
      ok(await inventoryService.updateWarehouse(toInventoryContext(request), id, request.body))
    );
  });

  app.delete('/v1/inventory/locations/:id', async (request, reply) => {
    await requireInventoryModule(request);
    requireRole(request, 'editor');
    const { id } = PathId.parse(request.params);
    await inventoryService.archiveWarehouse(toInventoryContext(request), id);
    return reply.status(204).send();
  });

  app.get('/v1/inventory/locations/:id/levels', async (request, reply) => {
    await requireInventoryModule(request);
    requireRole(request, 'viewer');
    const { id } = PathId.parse(request.params);
    const q = LevelsQuery.parse(request.query);
    const { items, total } = await inventoryService.levelsForWarehouse(
      toInventoryContext(request),
      id,
      {
        ...(q.take !== undefined ? { take: q.take } : {}),
        ...(q.skip !== undefined ? { skip: q.skip } : {}),
        ...(q.low_stock_only === true ? { lowStockOnly: true } : {}),
      }
    );
    return reply.send(paged(items, { total, skip: q.skip ?? 0, per_page: q.take ?? 100 }));
  });
};

export default inventoryLocationRoutes;
