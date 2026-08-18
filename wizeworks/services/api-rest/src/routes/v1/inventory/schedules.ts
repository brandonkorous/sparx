// Cycle-count schedule API (docs/146 Phase 7.9) — counting as a standing
// instruction rather than something somebody remembers.
//
//   GET    /v1/inventory/count-schedules
//   POST   /v1/inventory/count-schedules
//   GET    /v1/inventory/count-schedules/:id
//   PATCH  /v1/inventory/count-schedules/:id
//   DELETE /v1/inventory/count-schedules/:id
//   POST   /v1/inventory/count-schedules/generate       — run the due ones now
//   POST   /v1/inventory/count-schedules/:id/run        — run this one now
//
// Generating counts is `editor`, not `viewer`, because it creates work for real
// people. Deleting a schedule is `admin`: the schedule is the thing that keeps
// counting happening, and its counts survive the deletion, so the only thing
// lost is the discipline — which is exactly the sort of quiet loss that should
// need a second pair of hands.

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { queryBool } from '@wizeworks/api-core/query';
import { inventoryService } from '@wizeworks/inventory';
import { ok, paged } from '@wizeworks/api-core/envelope';
import { requireRole } from '@wizeworks/api-core/auth';
import { requireInventoryModule, toInventoryContext } from '../../../lib/inventory-context.js';

const PathId = z.object({ id: z.string().uuid() });

const ListQuery = z.object({
  warehouse_id: z.string().uuid().optional(),
  include_inactive: queryBool.optional(),
});

// eslint-disable-next-line @typescript-eslint/require-await -- FastifyPluginAsync signature
const inventoryScheduleRoutes: FastifyPluginAsync = async (app) => {
  app.get('/v1/inventory/count-schedules', async (request, reply) => {
    await requireInventoryModule(request);
    requireRole(request, 'viewer');
    const q = ListQuery.parse(request.query);
    const result = await inventoryService.listCountSchedules(toInventoryContext(request), {
      ...(q.warehouse_id ? { warehouseId: q.warehouse_id } : {}),
      ...(q.include_inactive !== undefined ? { includeInactive: q.include_inactive } : {}),
    });
    // A schedule list is short by nature — a business runs three of these, not
    // three hundred — so it comes back whole rather than paged.
    return reply.send(paged(result.items, { total: result.total, per_page: result.total }));
  });

  app.post('/v1/inventory/count-schedules', async (request, reply) => {
    await requireInventoryModule(request);
    requireRole(request, 'editor');
    const created = await inventoryService.createCountSchedule(
      toInventoryContext(request),
      request.body
    );
    return reply.status(201).send(ok(created));
  });

  app.get('/v1/inventory/count-schedules/:id', async (request, reply) => {
    await requireInventoryModule(request);
    requireRole(request, 'viewer');
    const { id } = PathId.parse(request.params);
    return reply.send(ok(await inventoryService.getCountSchedule(toInventoryContext(request), id)));
  });

  app.patch('/v1/inventory/count-schedules/:id', async (request, reply) => {
    await requireInventoryModule(request);
    requireRole(request, 'editor');
    const { id } = PathId.parse(request.params);
    return reply.send(
      ok(await inventoryService.updateCountSchedule(toInventoryContext(request), id, request.body))
    );
  });

  app.delete('/v1/inventory/count-schedules/:id', async (request, reply) => {
    await requireInventoryModule(request);
    requireRole(request, 'admin');
    const { id } = PathId.parse(request.params);
    return reply.send(
      ok(await inventoryService.deleteCountSchedule(toInventoryContext(request), id))
    );
  });

  app.post('/v1/inventory/count-schedules/generate', async (request, reply) => {
    await requireInventoryModule(request);
    requireRole(request, 'editor');
    return reply.send(ok(await inventoryService.generateDueCounts(toInventoryContext(request))));
  });

  // `force` so "run it now" means now — a schedule due next Tuesday still
  // generates, and its next date still moves forward from the date that was due.
  app.post('/v1/inventory/count-schedules/:id/run', async (request, reply) => {
    await requireInventoryModule(request);
    requireRole(request, 'editor');
    const { id } = PathId.parse(request.params);
    return reply.send(
      ok(
        await inventoryService.generateDueCounts(toInventoryContext(request), {
          scheduleId: id,
          force: true,
        })
      )
    );
  });
};

export default inventoryScheduleRoutes;
