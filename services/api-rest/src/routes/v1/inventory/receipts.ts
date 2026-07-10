// Inventory module — Goods receipts (docs/100 P3c). Booking goods against a
// submitted PO: each line writes a `receive` movement (moving-average cost) and
// advances the PO to partial/received. Receipts are immutable once posted (a
// correction is a later adjustment/count), so the surface is POST + reads. All
// `requireInventoryModule` + `toInventoryContext` (standalone-usable).
//
//   GET  /v1/inventory/receipts                 ?purchase_order_id&take&skip
//   POST /v1/inventory/receipts                 → post a receipt against a PO
//   GET  /v1/inventory/receipts/:id

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { inventoryService } from '@sparx/inventory';
import { ok, paged } from '@sparx/api-core/envelope';
import { requireRole } from '@sparx/api-core/auth';
import { requireInventoryModule, toInventoryContext } from '../../../lib/inventory-context.js';

const PathId = z.object({ id: z.string().uuid() });

const ListQuery = z.object({
  q: z.string().trim().min(1).max(200).optional(),
  purchase_order_id: z.string().uuid().optional(),
  take: z.coerce.number().int().min(1).max(250).optional(),
  skip: z.coerce.number().int().min(0).optional(),
});

// eslint-disable-next-line @typescript-eslint/require-await -- FastifyPluginAsync signature
const inventoryReceiptRoutes: FastifyPluginAsync = async (app) => {
  app.get('/v1/inventory/receipts', async (request, reply) => {
    await requireInventoryModule(request);
    requireRole(request, 'viewer');
    const q = ListQuery.parse(request.query);
    const { items, total } = await inventoryService.listGoodsReceipts(toInventoryContext(request), {
      ...(q.q !== undefined ? { q: q.q } : {}),
      ...(q.purchase_order_id !== undefined ? { purchaseOrderId: q.purchase_order_id } : {}),
      ...(q.take !== undefined ? { take: q.take } : {}),
      ...(q.skip !== undefined ? { skip: q.skip } : {}),
    });
    return reply.send(paged(items, { total, skip: q.skip ?? 0, per_page: q.take ?? 50 }));
  });

  app.post('/v1/inventory/receipts', async (request, reply) => {
    await requireInventoryModule(request);
    requireRole(request, 'editor');
    const created = await inventoryService.createGoodsReceipt(
      toInventoryContext(request),
      request.body
    );
    return reply.status(201).send(ok(created));
  });

  app.get('/v1/inventory/receipts/:id', async (request, reply) => {
    await requireInventoryModule(request);
    requireRole(request, 'viewer');
    const { id } = PathId.parse(request.params);
    return reply.send(ok(await inventoryService.getGoodsReceipt(toInventoryContext(request), id)));
  });
};

export default inventoryReceiptRoutes;
