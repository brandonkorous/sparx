// Inventory module — Units of measure (docs/146 Phase 6.1–6.3). Buy a case,
// stock each, sell a pair. All `requireInventoryModule` + `toInventoryContext`
// (standalone-usable). Reads are `viewer` because a warehouse screen has to be
// able to say "4 cases"; writes are `editor`, because a wrong factor is a stock
// number that is twelve times wrong.
//
//   GET    /v1/inventory/units                    ?include_inactive
//   POST   /v1/inventory/units
//   PATCH  /v1/inventory/units/:id
//   DELETE /v1/inventory/units/:id
//   GET    /v1/inventory/variants/:variantId/units
//   PUT    /v1/inventory/variants/:variantId/units

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { inventoryService } from '@sparx/inventory';
import { ok } from '@sparx/api-core/envelope';
import { requireRole } from '@sparx/api-core/auth';
import { requireInventoryModule, toInventoryContext } from '../../../lib/inventory-context.js';

const PathId = z.object({ id: z.string().uuid() });
const PathVariant = z.object({ variantId: z.string().uuid() });
const ListQuery = z.object({
  include_inactive: z.coerce.boolean().optional(),
});

// eslint-disable-next-line @typescript-eslint/require-await -- FastifyPluginAsync signature
const inventoryUomRoutes: FastifyPluginAsync = async (app) => {
  app.get('/v1/inventory/units', async (request, reply) => {
    await requireInventoryModule(request);
    requireRole(request, 'viewer');
    const q = ListQuery.parse(request.query);
    return reply.send(
      ok(
        await inventoryService.listUnitsOfMeasure(toInventoryContext(request), {
          ...(q.include_inactive !== undefined ? { includeInactive: q.include_inactive } : {}),
        })
      )
    );
  });

  app.post('/v1/inventory/units', async (request, reply) => {
    await requireInventoryModule(request);
    requireRole(request, 'editor');
    const created = await inventoryService.createUnitOfMeasure(
      toInventoryContext(request),
      request.body
    );
    return reply.status(201).send(ok(created));
  });

  app.patch('/v1/inventory/units/:id', async (request, reply) => {
    await requireInventoryModule(request);
    requireRole(request, 'editor');
    const { id } = PathId.parse(request.params);
    return reply.send(
      ok(await inventoryService.updateUnitOfMeasure(toInventoryContext(request), id, request.body))
    );
  });

  app.delete('/v1/inventory/units/:id', async (request, reply) => {
    await requireInventoryModule(request);
    requireRole(request, 'editor');
    const { id } = PathId.parse(request.params);
    return reply.send(
      ok(await inventoryService.deleteUnitOfMeasure(toInventoryContext(request), id))
    );
  });

  app.get('/v1/inventory/variants/:variantId/units', async (request, reply) => {
    await requireInventoryModule(request);
    requireRole(request, 'viewer');
    const { variantId } = PathVariant.parse(request.params);
    return reply.send(
      ok(await inventoryService.getVariantUoms(toInventoryContext(request), variantId))
    );
  });

  // PUT rather than PATCH: the defaults are a property of the SET. "Usually
  // bought by the case" is one fact across every conversion, and setting it row
  // by row leaves a moment where two rows claim it and the database refuses.
  app.put('/v1/inventory/variants/:variantId/units', async (request, reply) => {
    await requireInventoryModule(request);
    requireRole(request, 'editor');
    const { variantId } = PathVariant.parse(request.params);
    const body = request.body as Record<string, unknown> | null;
    return reply.send(
      ok(
        await inventoryService.setVariantUoms(toInventoryContext(request), {
          ...(body ?? {}),
          // The path wins: an id in two places is an id that can disagree.
          variantId,
        })
      )
    );
  });
};

export default inventoryUomRoutes;
