// Return-to-supplier API (docs/146 Phase 8.7) — stock going back, with money
// expected.
//
//   GET  /v1/inventory/supplier-returns              — the chase list
//   POST /v1/inventory/supplier-returns              — start one (draft)
//   GET  /v1/inventory/supplier-returns/:id
//   PATCH /v1/inventory/supplier-returns/:id         — paperwork
//   POST /v1/inventory/supplier-returns/:id/send     — the pallet leaves; stock moves
//   POST /v1/inventory/supplier-returns/:id/credit   — record what they credited
//   POST /v1/inventory/supplier-returns/:id/close    — write it off, with a reason
//   POST /v1/inventory/supplier-returns/:id/cancel   — abandon a draft
//
// `send` is the only one that touches stock, and it is a POST of its own rather
// than a status field on PATCH for exactly that reason: taking units off a shelf
// should not be reachable by editing a form.

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { queryBool } from '@sparx/api-core/query';
import { inventoryService } from '@sparx/inventory';
import { ok } from '@sparx/api-core/envelope';
import { requireRole } from '@sparx/api-core/auth';
import { requireInventoryModule, toInventoryContext } from '../../../lib/inventory-context.js';

const IdPath = z.object({ id: z.string().uuid() });

const ListQuery = z.object({
  supplier_id: z.string().uuid().optional(),
  warehouse_id: z.string().uuid().optional(),
  status: z.enum(['draft', 'sent', 'credited', 'closed', 'cancelled']).optional(),
  awaiting_credit_only: queryBool.optional(),
  take: z.coerce.number().int().min(1).max(250).optional(),
  skip: z.coerce.number().int().min(0).optional(),
});

const CloseBody = z.object({ note: z.string().trim().min(1).max(2000) });

// eslint-disable-next-line @typescript-eslint/require-await -- FastifyPluginAsync signature
const supplierReturnRoutes: FastifyPluginAsync = async (app) => {
  app.get('/v1/inventory/supplier-returns', async (request, reply) => {
    await requireInventoryModule(request);
    requireRole(request, 'viewer');
    const q = ListQuery.parse(request.query);
    // `ok(report)`, not `paged(items)`: the headline — what suppliers owe right
    // now across everything sent and not yet credited — has to survive a
    // filtered view, and it is the number the screen exists to show.
    return reply.send(
      ok(
        await inventoryService.listSupplierReturns(toInventoryContext(request), {
          ...(q.supplier_id ? { supplierId: q.supplier_id } : {}),
          ...(q.warehouse_id ? { warehouseId: q.warehouse_id } : {}),
          ...(q.status ? { status: q.status } : {}),
          ...(q.awaiting_credit_only !== undefined
            ? { awaitingCreditOnly: q.awaiting_credit_only }
            : {}),
          ...(q.take !== undefined ? { take: q.take } : {}),
          ...(q.skip !== undefined ? { skip: q.skip } : {}),
        })
      )
    );
  });

  app.post('/v1/inventory/supplier-returns', async (request, reply) => {
    await requireInventoryModule(request);
    requireRole(request, 'editor');
    return reply
      .status(201)
      .send(
        ok(await inventoryService.createSupplierReturn(toInventoryContext(request), request.body))
      );
  });

  app.get('/v1/inventory/supplier-returns/:id', async (request, reply) => {
    await requireInventoryModule(request);
    requireRole(request, 'viewer');
    const { id } = IdPath.parse(request.params);
    return reply.send(
      ok(await inventoryService.getSupplierReturn(toInventoryContext(request), id))
    );
  });

  app.patch('/v1/inventory/supplier-returns/:id', async (request, reply) => {
    await requireInventoryModule(request);
    requireRole(request, 'editor');
    const { id } = IdPath.parse(request.params);
    return reply.send(
      ok(await inventoryService.updateSupplierReturn(toInventoryContext(request), id, request.body))
    );
  });

  app.post('/v1/inventory/supplier-returns/:id/send', async (request, reply) => {
    await requireInventoryModule(request);
    requireRole(request, 'editor');
    const { id } = IdPath.parse(request.params);
    return reply.send(
      ok(await inventoryService.sendSupplierReturn(toInventoryContext(request), id))
    );
  });

  app.post('/v1/inventory/supplier-returns/:id/credit', async (request, reply) => {
    await requireInventoryModule(request);
    requireRole(request, 'editor');
    const { id } = IdPath.parse(request.params);
    return reply.send(
      ok(await inventoryService.recordSupplierCredit(toInventoryContext(request), id, request.body))
    );
  });

  app.post('/v1/inventory/supplier-returns/:id/close', async (request, reply) => {
    await requireInventoryModule(request);
    requireRole(request, 'editor');
    const { id } = IdPath.parse(request.params);
    const body = CloseBody.parse(request.body ?? {});
    return reply.send(
      ok(await inventoryService.closeSupplierReturn(toInventoryContext(request), id, body.note))
    );
  });

  app.post('/v1/inventory/supplier-returns/:id/cancel', async (request, reply) => {
    await requireInventoryModule(request);
    requireRole(request, 'editor');
    const { id } = IdPath.parse(request.params);
    return reply.send(
      ok(await inventoryService.cancelSupplierReturn(toInventoryContext(request), id))
    );
  });
};

export default supplierReturnRoutes;
