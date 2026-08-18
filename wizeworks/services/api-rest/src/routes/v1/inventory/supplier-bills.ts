// Supplier bill API + the three-way match (docs/146 Phase 8.8).
//
//   GET   /v1/inventory/supplier-bills                — what is owed, by due date
//   POST  /v1/inventory/supplier-bills                — enter one
//   GET   /v1/inventory/supplier-bills/:id            — detail WITH the match
//   PATCH /v1/inventory/supplier-bills/:id
//   POST  /v1/inventory/supplier-bills/:id/approve    — refuses on an unexplained variance
//   POST  /v1/inventory/supplier-bills/:id/accept-variance
//   POST  /v1/inventory/supplier-bills/:id/dispute
//   POST  /v1/inventory/supplier-bills/:id/pay
//   POST  /v1/inventory/supplier-bills/:id/cancel
//
// The match is not a separate endpoint. It comes back on the detail, every time,
// because a bill screen that requires a second click to find out whether the
// invoice agrees with the delivery is a screen where nobody clicks it.
//
// Roles. Entering and matching a bill is `editor` — it is clerical work.
// APPROVING and PAYING are `admin`: they commit money, and the whole point of
// the phase is that the person who raises the order is not automatically the
// person who signs off paying for it.

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { queryBool } from '@wizeworks/api-core/query';
import { inventoryService } from '@wizeworks/inventory';
import { ok } from '@wizeworks/api-core/envelope';
import { requireRole } from '@wizeworks/api-core/auth';
import { requireInventoryModule, toInventoryContext } from '../../../lib/inventory-context.js';

const IdPath = z.object({ id: z.string().uuid() });

const ListQuery = z.object({
  supplier_id: z.string().uuid().optional(),
  purchase_order_id: z.string().uuid().optional(),
  status: z
    .enum(['draft', 'awaiting_approval', 'approved', 'disputed', 'paid', 'cancelled'])
    .optional(),
  overdue_only: queryBool.optional(),
  take: z.coerce.number().int().min(1).max(250).optional(),
  skip: z.coerce.number().int().min(0).optional(),
});

const DisputeBody = z.object({ note: z.string().trim().min(1).max(2000) });

// eslint-disable-next-line @typescript-eslint/require-await -- FastifyPluginAsync signature
const supplierBillRoutes: FastifyPluginAsync = async (app) => {
  app.get('/v1/inventory/supplier-bills', async (request, reply) => {
    await requireInventoryModule(request);
    requireRole(request, 'viewer');
    const q = ListQuery.parse(request.query);
    // `ok(report)` — "what you owe right now" is the headline of a payables
    // screen, and it must not vanish when the list is filtered to one supplier.
    return reply.send(
      ok(
        await inventoryService.listSupplierBills(toInventoryContext(request), {
          ...(q.supplier_id ? { supplierId: q.supplier_id } : {}),
          ...(q.purchase_order_id ? { purchaseOrderId: q.purchase_order_id } : {}),
          ...(q.status ? { status: q.status } : {}),
          ...(q.overdue_only !== undefined ? { overdueOnly: q.overdue_only } : {}),
          ...(q.take !== undefined ? { take: q.take } : {}),
          ...(q.skip !== undefined ? { skip: q.skip } : {}),
        })
      )
    );
  });

  app.post('/v1/inventory/supplier-bills', async (request, reply) => {
    await requireInventoryModule(request);
    requireRole(request, 'editor');
    return reply
      .status(201)
      .send(
        ok(await inventoryService.createSupplierBill(toInventoryContext(request), request.body))
      );
  });

  app.get('/v1/inventory/supplier-bills/:id', async (request, reply) => {
    await requireInventoryModule(request);
    requireRole(request, 'viewer');
    const { id } = IdPath.parse(request.params);
    return reply.send(ok(await inventoryService.getSupplierBill(toInventoryContext(request), id)));
  });

  app.patch('/v1/inventory/supplier-bills/:id', async (request, reply) => {
    await requireInventoryModule(request);
    requireRole(request, 'editor');
    const { id } = IdPath.parse(request.params);
    return reply.send(
      ok(await inventoryService.updateSupplierBill(toInventoryContext(request), id, request.body))
    );
  });

  app.post('/v1/inventory/supplier-bills/:id/approve', async (request, reply) => {
    await requireInventoryModule(request);
    requireRole(request, 'admin');
    const { id } = IdPath.parse(request.params);
    return reply.send(
      ok(await inventoryService.approveSupplierBill(toInventoryContext(request), id))
    );
  });

  app.post('/v1/inventory/supplier-bills/:id/accept-variance', async (request, reply) => {
    await requireInventoryModule(request);
    requireRole(request, 'admin');
    const { id } = IdPath.parse(request.params);
    return reply.send(
      ok(await inventoryService.acceptBillVariance(toInventoryContext(request), id, request.body))
    );
  });

  app.post('/v1/inventory/supplier-bills/:id/dispute', async (request, reply) => {
    await requireInventoryModule(request);
    requireRole(request, 'editor');
    const { id } = IdPath.parse(request.params);
    const body = DisputeBody.parse(request.body ?? {});
    return reply.send(
      ok(await inventoryService.disputeSupplierBill(toInventoryContext(request), id, body.note))
    );
  });

  app.post('/v1/inventory/supplier-bills/:id/pay', async (request, reply) => {
    await requireInventoryModule(request);
    requireRole(request, 'admin');
    const { id } = IdPath.parse(request.params);
    return reply.send(
      ok(await inventoryService.recordBillPayment(toInventoryContext(request), id, request.body))
    );
  });

  app.post('/v1/inventory/supplier-bills/:id/cancel', async (request, reply) => {
    await requireInventoryModule(request);
    requireRole(request, 'editor');
    const { id } = IdPath.parse(request.params);
    return reply.send(
      ok(await inventoryService.cancelSupplierBill(toInventoryContext(request), id))
    );
  });
};

export default supplierBillRoutes;
