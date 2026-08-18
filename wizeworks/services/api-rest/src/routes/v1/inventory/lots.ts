// Inventory module — lots, serials, and recalls. Batch/serial traceability is an
// inventory concern (regulated stock, expiry, recalls), so it lives in the
// inventory module's own API namespace (requireInventoryModule) — usable by a
// standalone WMS tenant with no commerce. Writes delegate to @wizeworks/inventory;
// the active-recalls read is a thin Prisma join under RLS.
//
//   GET   /v1/inventory/lots               ?variant_id&warehouse_id&recall_status&expiring_before&q
//   POST  /v1/inventory/lots
//   GET   /v1/inventory/lots/expiring      ?before=<iso>
//   GET   /v1/inventory/lots/:id
//   GET   /v1/inventory/lots/:id/serials   ?status
//   POST  /v1/inventory/lots/:id/clear-recall
//   GET   /v1/inventory/serials            ?lot_batch_id&variant_id&warehouse_id&status&q
//   POST  /v1/inventory/serials
//   PATCH /v1/inventory/serials/:id        → change status
//   POST  /v1/inventory/recalls
//   GET   /v1/inventory/recalls/active

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { inventoryService } from '@wizeworks/inventory';
import { SerialUnitStatus } from '@wizeworks/commerce-schemas';
import { withRequestTenant } from '@wizeworks/api-core/db';
import { ok, paged } from '@wizeworks/api-core/envelope';
import { requireRole } from '@wizeworks/api-core/auth';
import { requireInventoryModule, toInventoryContext } from '../../../lib/inventory-context.js';

const ExpiringQuery = z.object({ before: z.string().datetime().optional() });
const PathId = z.object({ id: z.string().uuid() });

const LotsQuery = z.object({
  variant_id: z.string().uuid().optional(),
  warehouse_id: z.string().uuid().optional(),
  recall_status: z.enum(['pending', 'active', 'cleared']).optional(),
  expiring_before: z.string().datetime().optional(),
  q: z.string().max(63).optional(),
  take: z.coerce.number().int().min(1).max(250).optional(),
  skip: z.coerce.number().int().min(0).optional(),
});

const SerialsQuery = z.object({
  lot_batch_id: z.string().uuid().optional(),
  variant_id: z.string().uuid().optional(),
  warehouse_id: z.string().uuid().optional(),
  status: SerialUnitStatus.optional(),
  q: z.string().max(127).optional(),
  take: z.coerce.number().int().min(1).max(500).optional(),
  skip: z.coerce.number().int().min(0).optional(),
});

// eslint-disable-next-line @typescript-eslint/require-await -- FastifyPluginAsync signature
const inventoryLotRoutes: FastifyPluginAsync = async (app) => {
  app.get('/v1/inventory/lots', async (request, reply) => {
    await requireInventoryModule(request);
    requireRole(request, 'viewer');
    const q = LotsQuery.parse(request.query);
    const { items, total } = await inventoryService.listLots(toInventoryContext(request), {
      ...(q.variant_id !== undefined ? { variantId: q.variant_id } : {}),
      ...(q.warehouse_id !== undefined ? { warehouseId: q.warehouse_id } : {}),
      ...(q.recall_status !== undefined ? { recallStatus: q.recall_status } : {}),
      ...(q.expiring_before !== undefined ? { expiringBefore: q.expiring_before } : {}),
      ...(q.q !== undefined ? { q: q.q } : {}),
      ...(q.take !== undefined ? { take: q.take } : {}),
      ...(q.skip !== undefined ? { skip: q.skip } : {}),
    });
    return reply.send(paged(items, { total, skip: q.skip ?? 0, per_page: q.take ?? 50 }));
  });

  app.post('/v1/inventory/lots', async (request, reply) => {
    await requireInventoryModule(request);
    requireRole(request, 'editor');
    const created = await inventoryService.createLotBatch(
      toInventoryContext(request),
      request.body
    );
    reply.code(201);
    return ok(created);
  });

  app.get('/v1/inventory/lots/expiring', async (request) => {
    await requireInventoryModule(request);
    requireRole(request, 'viewer');
    const q = ExpiringQuery.parse(request.query);
    const beforeIso = q.before ?? new Date(Date.now() + 30 * 86400_000).toISOString();
    return ok(
      await inventoryService.listLotsExpiringBefore(toInventoryContext(request), beforeIso)
    );
  });

  app.get('/v1/inventory/lots/:id', async (request, reply) => {
    await requireInventoryModule(request);
    requireRole(request, 'viewer');
    const { id } = PathId.parse(request.params);
    return reply.send(ok(await inventoryService.getLotBatch(toInventoryContext(request), id)));
  });

  app.get('/v1/inventory/lots/:id/serials', async (request, reply) => {
    await requireInventoryModule(request);
    requireRole(request, 'viewer');
    const { id } = PathId.parse(request.params);
    const q = SerialsQuery.parse(request.query);
    const { items, total } = await inventoryService.listSerials(toInventoryContext(request), {
      lotBatchId: id,
      ...(q.status !== undefined ? { status: q.status } : {}),
      ...(q.take !== undefined ? { take: q.take } : {}),
      ...(q.skip !== undefined ? { skip: q.skip } : {}),
    });
    return reply.send(paged(items, { total, skip: q.skip ?? 0, per_page: q.take ?? 100 }));
  });

  app.post('/v1/inventory/lots/:id/clear-recall', async (request, reply) => {
    await requireInventoryModule(request);
    requireRole(request, 'editor');
    const { id } = PathId.parse(request.params);
    return reply.send(ok(await inventoryService.clearRecall(toInventoryContext(request), id)));
  });

  app.get('/v1/inventory/serials', async (request, reply) => {
    await requireInventoryModule(request);
    requireRole(request, 'viewer');
    const q = SerialsQuery.parse(request.query);
    const { items, total } = await inventoryService.listSerials(toInventoryContext(request), {
      ...(q.lot_batch_id !== undefined ? { lotBatchId: q.lot_batch_id } : {}),
      ...(q.variant_id !== undefined ? { variantId: q.variant_id } : {}),
      ...(q.warehouse_id !== undefined ? { warehouseId: q.warehouse_id } : {}),
      ...(q.status !== undefined ? { status: q.status } : {}),
      ...(q.q !== undefined ? { q: q.q } : {}),
      ...(q.take !== undefined ? { take: q.take } : {}),
      ...(q.skip !== undefined ? { skip: q.skip } : {}),
    });
    return reply.send(paged(items, { total, skip: q.skip ?? 0, per_page: q.take ?? 100 }));
  });

  app.post('/v1/inventory/serials', async (request, reply) => {
    await requireInventoryModule(request);
    requireRole(request, 'editor');
    const created = await inventoryService.createSerialUnit(
      toInventoryContext(request),
      request.body
    );
    reply.code(201);
    return ok(created);
  });

  app.patch('/v1/inventory/serials/:id', async (request, reply) => {
    await requireInventoryModule(request);
    requireRole(request, 'editor');
    const { id } = PathId.parse(request.params);
    return reply.send(
      ok(await inventoryService.updateSerialStatus(toInventoryContext(request), id, request.body))
    );
  });

  app.post('/v1/inventory/recalls', async (request) => {
    await requireInventoryModule(request);
    requireRole(request, 'editor');
    return ok(await inventoryService.initiateRecall(toInventoryContext(request), request.body));
  });

  // Active recalls — the dashboard's lot/recall watch list.
  app.get('/v1/inventory/recalls/active', async (request) => {
    await requireInventoryModule(request);
    requireRole(request, 'viewer');
    const rows = await withRequestTenant(request, (tx) =>
      tx.lotBatch.findMany({
        where: { recallStatus: 'active' },
        orderBy: { recalledAt: 'desc' },
        take: 200,
        select: {
          id: true,
          lotNumber: true,
          recallReason: true,
          recalledAt: true,
          warehouse: { select: { id: true, code: true, name: true } },
          variant: {
            select: { id: true, sku: true, product: { select: { id: true, title: true } } },
          },
        },
      })
    );
    return ok(
      rows.map((r) => ({
        id: r.id,
        lotNumber: r.lotNumber,
        recallReason: r.recallReason,
        recalledAt: r.recalledAt?.toISOString() ?? null,
        warehouseId: r.warehouse.id,
        warehouseCode: r.warehouse.code,
        warehouseName: r.warehouse.name,
        variantId: r.variant.id,
        variantSku: r.variant.sku,
        productId: r.variant.product.id,
        productTitle: r.variant.product.title,
      }))
    );
  });
};

export default inventoryLotRoutes;
