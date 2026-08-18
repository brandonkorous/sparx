// Backorder API (docs/146 Phase 9.1–9.3) — the queue of people owed stock.
//
//   GET   /v1/inventory/backorders                 — the queue, with the tallies
//   GET   /v1/inventory/backorders/:id             — one commitment + its fills
//   PATCH /v1/inventory/backorders/:id             — priority, promise, expected PO
//   POST  /v1/inventory/backorders/:id/cancel      — drop the commitment
//   POST  /v1/inventory/backorders/:id/notified    — record that we told them
//   POST  /v1/inventory/backorders/refresh-promises — re-resolve every date now
//
// Nothing here CREATES a backorder. They are written by the sell path at the
// moment a commitment outruns stock, because that is the only place the shortfall
// is known — an endpoint that let a caller declare one would be a second writer
// with no movement behind it.
//
// Reads are `viewer`: a salesperson taking a phone call needs to answer "where
// am I in the queue" without being able to change it. Everything that alters the
// queue is `editor`, and the reason is worth stating: moving somebody up the
// queue moves somebody else down, and that is a commercial decision about two
// customers rather than a data edit.

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { queryBool } from '@wizeworks/api-core/query';
import { inventoryService } from '@wizeworks/inventory';
import { CancelBackorderInput } from '@wizeworks/commerce-schemas';
import { ok } from '@wizeworks/api-core/envelope';
import { requireRole } from '@wizeworks/api-core/auth';
import { requireInventoryModule, toInventoryContext } from '../../../lib/inventory-context.js';

const IdPath = z.object({ id: z.string().uuid() });

const ListQuery = z.object({
  status: z.enum(['open', 'partial', 'allocated', 'fulfilled', 'cancelled']).optional(),
  variant_id: z.string().uuid().optional(),
  warehouse_id: z.string().uuid().optional(),
  customer_id: z.string().uuid().optional(),
  /** The buyer's work list: commitments nobody can put a date on. */
  undated_only: queryBool.optional(),
  overdue_only: queryBool.optional(),
  take: z.coerce.number().int().min(1).max(200).optional(),
  skip: z.coerce.number().int().min(0).optional(),
});

// eslint-disable-next-line @typescript-eslint/require-await -- FastifyPluginAsync signature
const backorderRoutes: FastifyPluginAsync = async (app) => {
  app.get('/v1/inventory/backorders', async (request, reply) => {
    await requireInventoryModule(request);
    requireRole(request, 'viewer');
    const q = ListQuery.parse(request.query);
    const take = q.take ?? 50;
    const skip = q.skip ?? 0;
    const result = await inventoryService.listBackorders(toInventoryContext(request), {
      ...(q.status ? { status: q.status } : {}),
      ...(q.variant_id ? { variantId: q.variant_id } : {}),
      ...(q.warehouse_id ? { warehouseId: q.warehouse_id } : {}),
      ...(q.customer_id ? { customerId: q.customer_id } : {}),
      ...(q.undated_only !== undefined ? { undatedOnly: q.undated_only } : {}),
      ...(q.overdue_only !== undefined ? { overdueOnly: q.overdue_only } : {}),
      take,
      skip,
    });
    // The tallies ride in the BODY, not in the page meta: `api.list` reads only
    // `page.total` and drops everything else, so a headline count sent as meta
    // arrives as undefined on the client (a lesson from Phase 8's reports).
    return reply.send(
      ok({
        items: result.items,
        total: result.total,
        undatedCount: result.undatedCount,
        overdueCount: result.overdueCount,
        unitsOutstanding: result.unitsOutstanding,
        skip,
        take,
      })
    );
  });

  app.get('/v1/inventory/backorders/:id', async (request, reply) => {
    await requireInventoryModule(request);
    requireRole(request, 'viewer');
    const { id } = IdPath.parse(request.params);
    return reply.send(ok(await inventoryService.getBackorder(toInventoryContext(request), id)));
  });

  app.patch('/v1/inventory/backorders/:id', async (request, reply) => {
    await requireInventoryModule(request);
    requireRole(request, 'editor');
    const { id } = IdPath.parse(request.params);
    const ctx = toInventoryContext(request);
    await inventoryService.updateBackorder(ctx, id, request.body as never);
    return reply.send(ok(await inventoryService.getBackorder(ctx, id)));
  });

  app.post('/v1/inventory/backorders/:id/cancel', async (request, reply) => {
    await requireInventoryModule(request);
    requireRole(request, 'editor');
    const { id } = IdPath.parse(request.params);
    const body = CancelBackorderInput.parse(request.body ?? {});
    const ctx = toInventoryContext(request);
    await inventoryService.cancelBackorder(ctx, id, body.reason);
    return reply.send(ok(await inventoryService.getBackorder(ctx, id)));
  });

  app.post('/v1/inventory/backorders/:id/notified', async (request, reply) => {
    await requireInventoryModule(request);
    requireRole(request, 'editor');
    const { id } = IdPath.parse(request.params);
    const ctx = toInventoryContext(request);
    await inventoryService.markBackorderNotified(ctx, id);
    return reply.send(ok(await inventoryService.getBackorder(ctx, id)));
  });

  // The nightly pass runs this too. The button exists because the useful moment
  // is right after raising a purchase order — the buyer wants to see the queue
  // pick up the new arrival date without waiting until tomorrow.
  app.post('/v1/inventory/backorders/refresh-promises', async (request, reply) => {
    await requireInventoryModule(request);
    requireRole(request, 'editor');
    return reply.send(
      ok(await inventoryService.refreshBackorderPromises(toInventoryContext(request)))
    );
  });
};

export default backorderRoutes;
