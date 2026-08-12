// Advance ship notice API (docs/146 Phase 8.6) — what the supplier says is on
// the way.
//
//   GET    /v1/inventory/advance-ship-notices           — the inbound pipeline
//   POST   /v1/inventory/advance-ship-notices           — record one
//   GET    /v1/inventory/advance-ship-notices/:id       — detail + discrepancies
//   PATCH  /v1/inventory/advance-ship-notices/:id       — header edits
//   POST   /v1/inventory/advance-ship-notices/:id/cancel
//   GET    /v1/inventory/advance-ship-notices/:id/prefill — receiving pre-fill
//
// `prefill` is a READ that returns a suggestion, never a write that books a
// receipt. The receiver is the one with the pallet in front of them, and the
// entire value of a notice evaporates if the software books what the supplier
// claimed without anyone looking at it.
//
// Roles: reading is `viewer` (the warehouse needs to know what is coming),
// writing is `editor`. Creating is deliberately not restricted further: a notice
// arrives as an email a buyer types in, and an approval step on transcription
// would simply mean it never gets typed.

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { inventoryService } from '@sparx/inventory';
import { ok, paged } from '@sparx/api-core/envelope';
import { requireRole } from '@sparx/api-core/auth';
import { requireInventoryModule, toInventoryContext } from '../../../lib/inventory-context.js';

const IdPath = z.object({ id: z.string().uuid() });

const ListQuery = z.object({
  purchase_order_id: z.string().uuid().optional(),
  supplier_id: z.string().uuid().optional(),
  status: z.enum(['expected', 'received', 'cancelled']).optional(),
  overdue_only: z.coerce.boolean().optional(),
  take: z.coerce.number().int().min(1).max(250).optional(),
  skip: z.coerce.number().int().min(0).optional(),
});

// eslint-disable-next-line @typescript-eslint/require-await -- FastifyPluginAsync signature
const advanceShipNoticeRoutes: FastifyPluginAsync = async (app) => {
  app.get('/v1/inventory/advance-ship-notices', async (request, reply) => {
    await requireInventoryModule(request);
    requireRole(request, 'viewer');
    const q = ListQuery.parse(request.query);
    const result = await inventoryService.listAdvanceShipNotices(toInventoryContext(request), {
      ...(q.purchase_order_id ? { purchaseOrderId: q.purchase_order_id } : {}),
      ...(q.supplier_id ? { supplierId: q.supplier_id } : {}),
      ...(q.status ? { status: q.status } : {}),
      ...(q.overdue_only !== undefined ? { overdueOnly: q.overdue_only } : {}),
      ...(q.take !== undefined ? { take: q.take } : {}),
      ...(q.skip !== undefined ? { skip: q.skip } : {}),
    });
    return reply.send(
      paged(result.items, { total: result.total, skip: q.skip ?? 0, per_page: q.take ?? 50 })
    );
  });

  app.post('/v1/inventory/advance-ship-notices', async (request, reply) => {
    await requireInventoryModule(request);
    requireRole(request, 'editor');
    return reply
      .status(201)
      .send(
        ok(
          await inventoryService.createAdvanceShipNotice(toInventoryContext(request), request.body)
        )
      );
  });

  app.get('/v1/inventory/advance-ship-notices/:id', async (request, reply) => {
    await requireInventoryModule(request);
    requireRole(request, 'viewer');
    const { id } = IdPath.parse(request.params);
    return reply.send(
      ok(await inventoryService.getAdvanceShipNotice(toInventoryContext(request), id))
    );
  });

  app.patch('/v1/inventory/advance-ship-notices/:id', async (request, reply) => {
    await requireInventoryModule(request);
    requireRole(request, 'editor');
    const { id } = IdPath.parse(request.params);
    return reply.send(
      ok(
        await inventoryService.updateAdvanceShipNotice(
          toInventoryContext(request),
          id,
          request.body
        )
      )
    );
  });

  app.post('/v1/inventory/advance-ship-notices/:id/cancel', async (request, reply) => {
    await requireInventoryModule(request);
    requireRole(request, 'editor');
    const { id } = IdPath.parse(request.params);
    return reply.send(
      ok(await inventoryService.cancelAdvanceShipNotice(toInventoryContext(request), id))
    );
  });

  app.get('/v1/inventory/advance-ship-notices/:id/prefill', async (request, reply) => {
    await requireInventoryModule(request);
    requireRole(request, 'viewer');
    const { id } = IdPath.parse(request.params);
    return reply.send(
      ok(await inventoryService.prefillFromAdvanceShipNotice(toInventoryContext(request), id))
    );
  });
};

export default advanceShipNoticeRoutes;
