// Inventory module — lots, serials, and recalls. Batch/serial traceability is an
// inventory concern (regulated stock, expiry, recalls), so it lives in the
// inventory module's own API namespace (requireInventoryModule) — usable by a
// standalone WMS tenant with no commerce. Writes delegate to @sparx/inventory;
// the active-recalls read is a thin Prisma join under RLS.
//
//   POST /v1/inventory/lots
//   GET  /v1/inventory/lots/expiring        ?before=<iso>
//   POST /v1/inventory/serials
//   POST /v1/inventory/recalls
//   GET  /v1/inventory/recalls/active

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { inventoryService } from '@sparx/inventory';
import { withRequestTenant } from '@sparx/api-core/db';
import { ok } from '@sparx/api-core/envelope';
import { requireRole } from '@sparx/api-core/auth';
import { requireInventoryModule, toInventoryContext } from '../../../lib/inventory-context.js';

const ExpiringQuery = z.object({ before: z.string().datetime().optional() });

// eslint-disable-next-line @typescript-eslint/require-await -- FastifyPluginAsync signature
const inventoryLotRoutes: FastifyPluginAsync = async (app) => {
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
