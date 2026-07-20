// Inventory module — Movement / audit-log viewer (docs/100 P4, docs/99 D5). A
// read-only, filterable, paginated view over the append-only `inventory_movements`
// ledger: who moved stock, when, why, by how much. No mutations here — every
// stock change already records a row via `applyMovement`. Filter by variant,
// warehouse, reason, actor, reference, and a created-at date range.
// `requireInventoryModule` + viewer (standalone-usable).
//
//   GET /v1/inventory/movements
//     ?variant_id&product_id&warehouse_id&reason&actor_type&actor_id
//     &reference_type&reference_id&from&to&take&skip
//
// `product_id` answers "what happened to THIS product's stock" in one request
// across every variant it has — the read a product-scoped stock pane makes.
// Without it that view is one request per variant, and the merged result is
// still wrong (each page is the newest 50 of its own variant, not of the whole).

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { inventoryService } from '@sparx/inventory';
import { InventoryActorType, InventoryAdjustReason } from '@sparx/commerce-schemas';
import { paged } from '@sparx/api-core/envelope';
import { requireRole } from '@sparx/api-core/auth';
import { requireInventoryModule, toInventoryContext } from '../../../lib/inventory-context.js';

const ListQuery = z.object({
  variant_id: z.string().uuid().optional(),
  product_id: z.string().uuid().optional(),
  warehouse_id: z.string().uuid().optional(),
  reason: InventoryAdjustReason.optional(),
  actor_type: InventoryActorType.optional(),
  actor_id: z.string().max(127).optional(),
  reference_type: z.string().max(63).optional(),
  reference_id: z.string().uuid().optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  take: z.coerce.number().int().min(1).max(250).optional(),
  skip: z.coerce.number().int().min(0).optional(),
});

// eslint-disable-next-line @typescript-eslint/require-await -- FastifyPluginAsync signature
const inventoryMovementRoutes: FastifyPluginAsync = async (app) => {
  app.get('/v1/inventory/movements', async (request, reply) => {
    await requireInventoryModule(request);
    requireRole(request, 'viewer');
    const q = ListQuery.parse(request.query);
    const { items, total } = await inventoryService.listMovements(toInventoryContext(request), {
      ...(q.variant_id !== undefined ? { variantId: q.variant_id } : {}),
      ...(q.product_id !== undefined ? { productId: q.product_id } : {}),
      ...(q.warehouse_id !== undefined ? { warehouseId: q.warehouse_id } : {}),
      ...(q.reason !== undefined ? { reason: q.reason } : {}),
      ...(q.actor_type !== undefined ? { actorType: q.actor_type } : {}),
      ...(q.actor_id !== undefined ? { actorId: q.actor_id } : {}),
      ...(q.reference_type !== undefined ? { referenceType: q.reference_type } : {}),
      ...(q.reference_id !== undefined ? { referenceId: q.reference_id } : {}),
      ...(q.from !== undefined ? { from: q.from } : {}),
      ...(q.to !== undefined ? { to: q.to } : {}),
      ...(q.take !== undefined ? { take: q.take } : {}),
      ...(q.skip !== undefined ? { skip: q.skip } : {}),
    });
    return reply.send(paged(items, { total, skip: q.skip ?? 0, per_page: q.take ?? 50 }));
  });
};

export default inventoryMovementRoutes;
