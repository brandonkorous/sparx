// Inventory module — Reorder engine (docs/100 P3d). Items at/below their reorder
// point become reorder suggestions grouped by (supplier, warehouse); the buyer
// drafts one PO per group to the preferred supplier. The same drafting logic is
// driven automatically by the `inventory.low` automation action. All
// `requireInventoryModule` + `toInventoryContext` (standalone-usable, no commerce).
//
//   GET  /v1/inventory/reorder/suggestions   ?warehouse_id&take
//   POST /v1/inventory/reorder/draft         → draft PO(s) from selected lines

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { inventoryService } from '@sparx/inventory';
import { ok } from '@sparx/api-core/envelope';
import { requireRole } from '@sparx/api-core/auth';
import { requireInventoryModule, toInventoryContext } from '../../../lib/inventory-context.js';

const SuggestionsQuery = z.object({
  warehouse_id: z.string().uuid().optional(),
  take: z.coerce.number().int().min(1).max(500).optional(),
});

// eslint-disable-next-line @typescript-eslint/require-await -- FastifyPluginAsync signature
const inventoryReorderRoutes: FastifyPluginAsync = async (app) => {
  app.get('/v1/inventory/reorder/suggestions', async (request, reply) => {
    await requireInventoryModule(request);
    requireRole(request, 'viewer');
    const q = SuggestionsQuery.parse(request.query);
    const suggestions = await inventoryService.listReorderSuggestions(toInventoryContext(request), {
      ...(q.warehouse_id !== undefined ? { warehouseId: q.warehouse_id } : {}),
      ...(q.take !== undefined ? { take: q.take } : {}),
    });
    return reply.send(ok(suggestions));
  });

  app.post('/v1/inventory/reorder/draft', async (request, reply) => {
    await requireInventoryModule(request);
    requireRole(request, 'editor');
    const result = await inventoryService.draftReorderPurchaseOrders(
      toInventoryContext(request),
      request.body
    );
    return reply.status(201).send(ok(result));
  });
};

export default inventoryReorderRoutes;
