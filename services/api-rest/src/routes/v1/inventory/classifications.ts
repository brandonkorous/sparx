// Inventory classification API (docs/146 Phase 7.8) — ABC by value, XYZ by
// predictability, and the sticky override a buyer sets when they know something
// the ledger does not.
//
//   GET /v1/inventory/classifications                       — the ranked list
//   GET /v1/inventory/classifications/:variant_id/:warehouse_id
//   PUT /v1/inventory/classifications                       — set/clear an override
//
// Setting an override is `editor`, not `admin`: it changes how often something
// gets counted and how much cushion it carries, and the person who knows the
// washer stops a production line is the person on the floor.

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { queryBool } from '@sparx/api-core/query';
import { inventoryService } from '@sparx/inventory';
import { ok, paged } from '@sparx/api-core/envelope';
import { requireRole } from '@sparx/api-core/auth';
import { requireInventoryModule, toInventoryContext } from '../../../lib/inventory-context.js';

const ListQuery = z.object({
  warehouse_id: z.string().uuid().optional(),
  abc_class: z.enum(['A', 'B', 'C']).optional(),
  // `unknown` selects the levels whose steadiness could not be judged yet. On a
  // young catalogue that is most of them, so it has to be selectable rather than
  // only reachable by looking at everything.
  xyz_class: z.enum(['X', 'Y', 'Z', 'unknown']).optional(),
  overridden_only: queryBool.optional(),
  q: z.string().trim().max(120).optional(),
  take: z.coerce.number().int().min(1).max(250).optional(),
  skip: z.coerce.number().int().min(0).optional(),
});

const LevelPath = z.object({
  variant_id: z.string().uuid(),
  warehouse_id: z.string().uuid(),
});

// eslint-disable-next-line @typescript-eslint/require-await -- FastifyPluginAsync signature
const inventoryClassificationRoutes: FastifyPluginAsync = async (app) => {
  app.get('/v1/inventory/classifications', async (request, reply) => {
    await requireInventoryModule(request);
    requireRole(request, 'viewer');
    const q = ListQuery.parse(request.query);
    const result = await inventoryService.listClassifications(toInventoryContext(request), {
      ...(q.warehouse_id ? { warehouseId: q.warehouse_id } : {}),
      ...(q.abc_class ? { abcClass: q.abc_class } : {}),
      ...(q.xyz_class ? { xyzClass: q.xyz_class } : {}),
      ...(q.overridden_only !== undefined ? { overriddenOnly: q.overridden_only } : {}),
      ...(q.q ? { q: q.q } : {}),
      ...(q.take !== undefined ? { take: q.take } : {}),
      ...(q.skip !== undefined ? { skip: q.skip } : {}),
    });
    return reply.send(
      paged(result.items, { total: result.total, skip: q.skip ?? 0, per_page: q.take ?? 50 })
    );
  });

  app.get('/v1/inventory/classifications/:variant_id/:warehouse_id', async (request, reply) => {
    await requireInventoryModule(request);
    requireRole(request, 'viewer');
    const p = LevelPath.parse(request.params);
    return reply.send(
      ok(
        await inventoryService.getClassification(toInventoryContext(request), {
          variantId: p.variant_id,
          warehouseId: p.warehouse_id,
        })
      )
    );
  });

  // PUT rather than PATCH: the pair is set together. Sending null for a class
  // CLEARS that override and hands the item back to the measurement, which is a
  // different act from setting it to whatever the measurement says today.
  app.put('/v1/inventory/classifications', async (request, reply) => {
    await requireInventoryModule(request);
    requireRole(request, 'editor');
    return reply.send(
      ok(
        await inventoryService.setClassificationOverride(toInventoryContext(request), request.body)
      )
    );
  });
};

export default inventoryClassificationRoutes;
