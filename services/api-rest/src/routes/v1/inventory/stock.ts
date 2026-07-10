// Inventory module — stock levels + movements (adjust/transfer), reorder policy,
// and the low-stock + enriched warehouse-level reads the dashboard stock grid +
// product Inventory tab consume. This is the inventory module's OWN API namespace
// (requireInventoryModule), so a tenant running Inventory standalone (no commerce)
// manages stock here. Writes delegate to @sparx/inventory's `applyMovement` funnel
// (audited, concurrency-safe); the enriched + low-stock reads are thin Prisma
// joins under RLS.
//
//   GET  /v1/inventory/levels/variant/:variantId
//   GET  /v1/inventory/levels/warehouse/:warehouseId
//   GET  /v1/inventory/levels/warehouse/:warehouseId/enriched
//   GET  /v1/inventory/low-stock
//   POST /v1/inventory/adjust
//   POST /v1/inventory/transfer
//   POST /v1/inventory/reorder-policy

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { inventoryService } from '@sparx/inventory';
import { withRequestTenant } from '@sparx/api-core/db';
import { ok, paged } from '@sparx/api-core/envelope';
import { requireRole } from '@sparx/api-core/auth';
import { requireInventoryModule, toInventoryContext } from '../../../lib/inventory-context.js';

const VariantParam = z.object({ variantId: z.string().uuid() });
const WarehouseParam = z.object({ warehouseId: z.string().uuid() });

const LevelsQuery = z.object({
  take: z.coerce.number().int().min(1).max(500).optional(),
  skip: z.coerce.number().int().min(0).optional(),
  low_stock_only: z.coerce.boolean().optional(),
});

const EnrichedLevelsQuery = z.object({
  q: z.string().trim().min(1).max(200).optional(),
  low_stock_only: z.coerce.boolean().optional(),
  take: z.coerce.number().int().min(1).max(1000).optional(),
  skip: z.coerce.number().int().min(0).optional(),
});

const LowStockQuery = z.object({
  warehouse_id: z.string().uuid().optional(),
  take: z.coerce.number().int().min(1).max(250).optional(),
});

// eslint-disable-next-line @typescript-eslint/require-await -- FastifyPluginAsync signature
const inventoryStockRoutes: FastifyPluginAsync = async (app) => {
  // Levels
  app.get('/v1/inventory/levels/variant/:variantId', async (request) => {
    await requireInventoryModule(request);
    requireRole(request, 'viewer');
    const { variantId } = VariantParam.parse(request.params);
    return ok(await inventoryService.levelsForVariant(toInventoryContext(request), variantId));
  });

  app.get('/v1/inventory/levels/warehouse/:warehouseId', async (request) => {
    await requireInventoryModule(request);
    requireRole(request, 'viewer');
    const { warehouseId } = WarehouseParam.parse(request.params);
    const q = LevelsQuery.parse(request.query);
    return ok(
      await inventoryService.levelsForWarehouse(toInventoryContext(request), warehouseId, {
        ...(q.take !== undefined ? { take: q.take } : {}),
        ...(q.skip !== undefined ? { skip: q.skip } : {}),
        ...(q.low_stock_only === true ? { lowStockOnly: true } : {}),
      })
    );
  });

  // Enriched warehouse levels (sku + product columns) — the stock grid's main list.
  app.get('/v1/inventory/levels/warehouse/:warehouseId/enriched', async (request) => {
    await requireInventoryModule(request);
    requireRole(request, 'viewer');
    const { warehouseId } = WarehouseParam.parse(request.params);
    const q = EnrichedLevelsQuery.parse(request.query);
    const take = Math.min(q.take ?? 200, 1000);
    const skip = q.skip ?? 0;
    const lowStockOnly = q.low_stock_only === true;
    const where = {
      warehouseId,
      ...(q.q
        ? {
            OR: [
              { variant: { sku: { contains: q.q, mode: 'insensitive' as const } } },
              { variant: { title: { contains: q.q, mode: 'insensitive' as const } } },
              { variant: { product: { title: { contains: q.q, mode: 'insensitive' as const } } } },
            ],
          }
        : {}),
    };

    const { rows, total } = await withRequestTenant(request, async (tx) => {
      const [rows, total] = await Promise.all([
        tx.inventoryLevel.findMany({
          where,
          orderBy: [{ updatedAt: 'desc' }],
          take,
          skip,
          select: {
            variantId: true,
            warehouseId: true,
            onHand: true,
            allocated: true,
            reorderPoint: true,
            reorderQuantity: true,
            updatedAt: true,
            variant: {
              select: {
                sku: true,
                title: true,
                product: { select: { id: true, title: true, handle: true } },
              },
            },
          },
        }),
        tx.inventoryLevel.count({ where }),
      ]);
      return { rows, total };
    });

    const enriched = rows.map((r) => ({
      variantId: r.variantId,
      warehouseId: r.warehouseId,
      onHand: r.onHand,
      allocated: r.allocated,
      available: r.onHand - r.allocated,
      reorderPoint: r.reorderPoint,
      reorderQuantity: r.reorderQuantity,
      updatedAt: r.updatedAt.toISOString(),
      sku: r.variant.sku,
      variantTitle: r.variant.title,
      productId: r.variant.product.id,
      productTitle: r.variant.product.title,
      productHandle: r.variant.product.handle,
    }));
    // Filter in-process for low-stock since Prisma can't compare two columns. The
    // toggle narrows the current page in place; `total` reflects the un-narrowed
    // level count for the warehouse (the main paginated list).
    const filtered = lowStockOnly
      ? enriched.filter((r) => r.reorderPoint !== null && r.onHand <= (r.reorderPoint ?? 0))
      : enriched;
    return paged(filtered, { total, per_page: take });
  });

  app.get('/v1/inventory/low-stock', async (request) => {
    await requireInventoryModule(request);
    requireRole(request, 'viewer');
    const q = LowStockQuery.parse(request.query);
    return ok(
      await inventoryService.listLowStock(toInventoryContext(request), {
        ...(q.warehouse_id ? { warehouseId: q.warehouse_id } : {}),
        ...(q.take !== undefined ? { take: q.take } : {}),
      })
    );
  });

  // Movements
  app.post('/v1/inventory/adjust', async (request) => {
    await requireInventoryModule(request);
    requireRole(request, 'editor');
    return ok(await inventoryService.adjust(toInventoryContext(request), request.body));
  });

  app.post('/v1/inventory/transfer', async (request) => {
    await requireInventoryModule(request);
    requireRole(request, 'editor');
    await inventoryService.transfer(toInventoryContext(request), request.body);
    return ok({ transferred: true });
  });

  app.post('/v1/inventory/reorder-policy', async (request) => {
    await requireInventoryModule(request);
    requireRole(request, 'editor');
    await inventoryService.setReorderPolicy(toInventoryContext(request), request.body);
    return ok({ updated: true });
  });
};

export default inventoryStockRoutes;
