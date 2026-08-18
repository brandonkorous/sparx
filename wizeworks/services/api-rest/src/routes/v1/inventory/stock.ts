// Inventory module — stock levels + movements (adjust/transfer), reorder policy,
// and the low-stock + enriched warehouse-level reads the dashboard stock grid +
// product Inventory tab consume. This is the inventory module's OWN API namespace
// (requireInventoryModule), so a tenant running Inventory standalone (no commerce)
// manages stock here. Writes delegate to @wizeworks/inventory's `applyMovement` funnel
// (audited, concurrency-safe); the enriched + low-stock reads are thin Prisma
// joins under RLS.
//
//   GET  /v1/inventory/levels/variant/:variantId
//   GET  /v1/inventory/levels/warehouse/:warehouseId
//   GET  /v1/inventory/levels/warehouse/:warehouseId/enriched
//   GET  /v1/inventory/low-stock
//   GET  /v1/inventory/reservations
//   POST /v1/inventory/adjust
//   POST /v1/inventory/transfer
//   POST /v1/inventory/reorder-policy
//   POST /v1/inventory/safety-buffer

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { queryBool } from '@wizeworks/api-core/query';
import { inventoryService, isLowStock } from '@wizeworks/inventory';
import { withRequestTenant } from '@wizeworks/api-core/db';
import { ok, paged } from '@wizeworks/api-core/envelope';
import { requireRole } from '@wizeworks/api-core/auth';
import {
  redactCosts,
  requireInventoryModule,
  toInventoryContext,
} from '../../../lib/inventory-context.js';

const VariantParam = z.object({ variantId: z.string().uuid() });
const WarehouseParam = z.object({ warehouseId: z.string().uuid() });

const LevelsQuery = z.object({
  take: z.coerce.number().int().min(1).max(500).optional(),
  skip: z.coerce.number().int().min(0).optional(),
  low_stock_only: queryBool.optional(),
});

const EnrichedLevelsQuery = z.object({
  q: z.string().trim().min(1).max(200).optional(),
  low_stock_only: queryBool.optional(),
  take: z.coerce.number().int().min(1).max(1000).optional(),
  skip: z.coerce.number().int().min(0).optional(),
});

const LowStockQuery = z.object({
  warehouse_id: z.string().uuid().optional(),
  take: z.coerce.number().int().min(1).max(250).optional(),
});

const ReservationsQuery = z.object({
  variant_id: z.string().uuid().optional(),
  // Every hold against one product, batched — the product-scoped stock pane's
  // read. Same rationale as `product_id` on /v1/inventory and /movements.
  product_id: z.string().uuid().optional(),
  warehouse_id: z.string().uuid().optional(),
  holder_type: z.enum(['cart', 'order', 'subscription']).optional(),
  status: z.enum(['active', 'released', 'committed', 'expired']).optional(),
  take: z.coerce.number().int().min(1).max(250).optional(),
  skip: z.coerce.number().int().min(0).optional(),
});

// eslint-disable-next-line @typescript-eslint/require-await -- FastifyPluginAsync signature
const inventoryStockRoutes: FastifyPluginAsync = async (app) => {
  // Levels
  app.get('/v1/inventory/levels/variant/:variantId', async (request) => {
    await requireInventoryModule(request);
    requireRole(request, 'viewer');
    const { variantId } = VariantParam.parse(request.params);
    // Level rows carry the cost basis; the `scanner` role is promised in the team
    // screen's own words that it cannot see what anything cost, so the promise is
    // kept at the transport rather than by which columns a client chooses to draw.
    return ok(
      redactCosts(
        request,
        await inventoryService.levelsForVariant(toInventoryContext(request), variantId)
      )
    );
  });

  app.get('/v1/inventory/levels/warehouse/:warehouseId', async (request) => {
    await requireInventoryModule(request);
    requireRole(request, 'viewer');
    const { warehouseId } = WarehouseParam.parse(request.params);
    const q = LevelsQuery.parse(request.query);
    return ok(
      redactCosts(
        request,
        await inventoryService.levelsForWarehouse(toInventoryContext(request), warehouseId, {
          ...(q.take !== undefined ? { take: q.take } : {}),
          ...(q.skip !== undefined ? { skip: q.skip } : {}),
          ...(q.low_stock_only === true ? { lowStockOnly: true } : {}),
        })
      )
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
            safetyBuffer: true,
            reorderPoint: true,
            reorderQuantity: true,
            updatedAt: true,
            // `asOf` is when the QUANTITY was last established; `updatedAt` moves
            // for any write to the row (a reorder point edit, a buffer change).
            // The freshness indicator needs the first and would be quietly wrong
            // reading the second — a level whose threshold someone tweaked this
            // morning would render as fresh stock (docs/146 Phase 1).
            asOf: true,
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
      safetyBuffer: r.safetyBuffer,
      reorderPoint: r.reorderPoint,
      reorderQuantity: r.reorderQuantity,
      updatedAt: r.updatedAt.toISOString(),
      asOf: r.asOf.toISOString(),
      // Served computed rather than left to the client: every consumer would
      // otherwise derive it from its own clock, and a browser whose clock is
      // twenty minutes out would paint half the grid as stale.
      ageSeconds: Math.max(0, Math.floor((Date.now() - r.asOf.getTime()) / 1000)),
      sku: r.variant.sku,
      variantTitle: r.variant.title,
      productId: r.variant.product.id,
      productTitle: r.variant.product.title,
      productHandle: r.variant.product.handle,
    }));
    // Filter in-process for low-stock since Prisma can't compare two columns.
    // `isLowStock` is the ONE definition (@wizeworks/inventory) — sellable stock at
    // or below the reorder point — so this toggle agrees with the list and the
    // badges. The toggle narrows the current page in place; `total` reflects the
    // un-narrowed level count for the warehouse (the main paginated list).
    const filtered = lowStockOnly ? enriched.filter(isLowStock) : enriched;
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

  // Reservations — the itemization of a level's `allocated` count. "12 allocated"
  // is a number; these rows are what is holding them and when (if ever) it frees
  // up, which is the actual question behind "why can't I sell these".
  app.get('/v1/inventory/reservations', async (request, reply) => {
    await requireInventoryModule(request);
    requireRole(request, 'viewer');
    const q = ReservationsQuery.parse(request.query);
    const { items, total } = await inventoryService.listReservations(toInventoryContext(request), {
      ...(q.variant_id !== undefined ? { variantId: q.variant_id } : {}),
      ...(q.product_id !== undefined ? { productId: q.product_id } : {}),
      ...(q.warehouse_id !== undefined ? { warehouseId: q.warehouse_id } : {}),
      ...(q.holder_type !== undefined ? { holderType: q.holder_type } : {}),
      ...(q.status !== undefined ? { status: q.status } : {}),
      ...(q.take !== undefined ? { take: q.take } : {}),
      ...(q.skip !== undefined ? { skip: q.skip } : {}),
    });
    return reply.send(paged(items, { total, skip: q.skip ?? 0, per_page: q.take ?? 50 }));
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

  // Units withheld from what a shopper may buy — the oversell cushion. The
  // service has existed since the availability work but had no route, so the
  // number was readable (it comes back on every level) and not settable from
  // anywhere but a direct DB write.
  app.post('/v1/inventory/safety-buffer', async (request) => {
    await requireInventoryModule(request);
    requireRole(request, 'editor');
    await inventoryService.setSafetyBuffer(toInventoryContext(request), request.body);
    return ok({ updated: true });
  });
};

export default inventoryStockRoutes;
