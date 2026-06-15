// Inventory module reporting reads (docs/64, docs/97 §5).
//
//   GET /v1/inventory/reports/summary
//     → valuation (units + cost/retail value), stock-status counts
//       (out / low / healthy), per-location quantities, source-feed health,
//       and the low/out-of-stock attention list
//   GET /v1/inventory/reports/activity?limit=
//     → most recently-changed stock levels (a proxy for a movement feed, since
//       the multi-source module has no per-change ledger)
//
// LIVE aggregates over `stock_levels` (the standalone multi-source module's
// per-variant×location quantities) joined to `commerce_product_variants` for
// cost/retail. No reorder-point column exists on the module's StockLevel, so
// "low" is a fixed available-units threshold. Purchase orders + a value-over-
// time series have no backing model yet (workload B) and stay sample on the
// overview. Inventory-module-gated + viewer-read, tenant-scoped via withTenant.

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { withTenant } from '@sparx/db';
import { ok } from '@sparx/api-core/envelope';
import { requireRole } from '@sparx/api-core/auth';
import { requireInventoryModule, toInventoryContext } from '../../../lib/inventory-context.js';

const DEFAULT_CURRENCY = 'USD';
// Available-units threshold below which a (variant, location) reads as "low".
const LOW_STOCK_THRESHOLD = 5;

const ActivityQuery = z.object({
  limit: z.coerce.number().int().min(1).max(50).optional(),
});

interface RawStatusRow {
  out: number;
  low: number;
  healthy: number;
  total: number;
}

const reportRoutes: FastifyPluginAsync = (app) => {
  app.get('/v1/inventory/reports/summary', async (request) => {
    await requireInventoryModule(request);
    requireRole(request, 'viewer');
    const ctx = toInventoryContext(request);

    return withTenant(ctx, async (tx) => {
      const [
        variantSums,
        statusRows,
        locationGroups,
        locations,
        sourceGroups,
        lastSyncAgg,
        lowOrOut,
      ] = await Promise.all([
        tx.stockLevel.groupBy({
          by: ['variantId'],
          _sum: { onHand: true, allocated: true, available: true },
        }),
        tx.$queryRaw<RawStatusRow[]>`
            SELECT
              COUNT(*) FILTER (WHERE available <= 0)::int                                    AS out,
              COUNT(*) FILTER (WHERE available > 0 AND available <= ${LOW_STOCK_THRESHOLD})::int AS low,
              COUNT(*) FILTER (WHERE available > ${LOW_STOCK_THRESHOLD})::int                AS healthy,
              COUNT(*)::int                                                                  AS total
            FROM stock_levels
          `,
        tx.stockLevel.groupBy({
          by: ['locationId'],
          _sum: { onHand: true, available: true },
          _count: { _all: true },
        }),
        tx.stockLocation.findMany({ select: { id: true, name: true, type: true, active: true } }),
        tx.inventorySource.groupBy({
          by: ['status'],
          where: { deletedAt: null },
          _count: { _all: true },
        }),
        tx.inventorySource.aggregate({
          where: { deletedAt: null },
          _max: { lastSyncAt: true },
        }),
        tx.stockLevel.findMany({
          where: { available: { lte: LOW_STOCK_THRESHOLD } },
          orderBy: { available: 'asc' },
          take: 8,
          select: {
            variantId: true,
            locationId: true,
            onHand: true,
            allocated: true,
            available: true,
          },
        }),
      ]);

      // Valuation — join the per-variant on-hand sums to variant cost/retail.
      const variantIds = [
        ...new Set([...variantSums.map((v) => v.variantId), ...lowOrOut.map((l) => l.variantId)]),
      ];
      const variants =
        variantIds.length > 0
          ? await tx.productVariant.findMany({
              where: { id: { in: variantIds } },
              select: { id: true, sku: true, title: true, priceCents: true, costCents: true },
            })
          : [];
      const variantById = new Map(variants.map((v) => [v.id, v]));

      let totalUnits = 0;
      let totalAllocated = 0;
      let totalAvailable = 0;
      let totalCostCents = 0;
      let totalRetailCents = 0;
      for (const vs of variantSums) {
        const onHand = vs._sum.onHand ?? 0;
        totalUnits += onHand;
        totalAllocated += vs._sum.allocated ?? 0;
        totalAvailable += vs._sum.available ?? 0;
        const v = variantById.get(vs.variantId);
        if (v) {
          totalCostCents += (v.costCents ?? 0) * onHand;
          totalRetailCents += v.priceCents * onHand;
        }
      }

      const locationById = new Map(locations.map((l) => [l.id, l]));
      const byLocation = locationGroups
        .map((g) => {
          const loc = locationById.get(g.locationId);
          return {
            locationId: g.locationId,
            name: loc?.name ?? '—',
            type: loc?.type ?? 'warehouse',
            skuCount: g._count._all,
            onHand: g._sum.onHand ?? 0,
            available: g._sum.available ?? 0,
          };
        })
        .sort((a, b) => b.onHand - a.onHand);

      const sourceStatus = { total: 0, active: 0, paused: 0, error: 0 };
      for (const g of sourceGroups) {
        sourceStatus.total += g._count._all;
        if (g.status in sourceStatus) {
          sourceStatus[g.status as 'active' | 'paused' | 'error'] = g._count._all;
        }
      }

      const status = statusRows[0] ?? { out: 0, low: 0, healthy: 0, total: 0 };
      const lowOrOutList = lowOrOut.map((l) => {
        const v = variantById.get(l.variantId);
        return {
          variantId: l.variantId,
          sku: v?.sku ?? '—',
          title: v?.title ?? v?.sku ?? '—',
          location: locationById.get(l.locationId)?.name ?? '—',
          onHand: l.onHand,
          available: l.available,
          status: l.available <= 0 ? 'out' : 'low',
        };
      });

      return ok({
        valuation: {
          totalUnits,
          totalAllocated,
          totalAvailable,
          totalCostCents,
          totalRetailCents,
          currency: DEFAULT_CURRENCY,
        },
        stockStatus: {
          skuCount: status.total,
          outOfStock: status.out,
          lowStock: status.low,
          healthy: status.healthy,
        },
        byLocation,
        sources: {
          ...sourceStatus,
          lastSyncAt: lastSyncAgg._max.lastSyncAt?.toISOString() ?? null,
        },
        lowOrOut: lowOrOutList,
        lowStockThreshold: LOW_STOCK_THRESHOLD,
      });
    });
  });

  // Recently-changed stock levels — a movement-feed proxy (no per-change ledger
  // exists in the multi-source module; StockLevel carries only `updatedAt`).
  app.get('/v1/inventory/reports/activity', async (request) => {
    await requireInventoryModule(request);
    requireRole(request, 'viewer');
    const ctx = toInventoryContext(request);
    const take = ActivityQuery.parse(request.query).limit ?? 10;

    return withTenant(ctx, async (tx) => {
      const levels = await tx.stockLevel.findMany({
        orderBy: { updatedAt: 'desc' },
        take,
        select: {
          variantId: true,
          locationId: true,
          onHand: true,
          available: true,
          updatedAt: true,
          variant: { select: { sku: true, title: true } },
          location: { select: { name: true } },
        },
      });

      return ok(
        levels.map((l) => ({
          variantId: l.variantId,
          locationId: l.locationId,
          sku: l.variant?.sku ?? '—',
          title: l.variant?.title ?? l.variant?.sku ?? '—',
          location: l.location?.name ?? '—',
          onHand: l.onHand,
          available: l.available,
          updatedAt: l.updatedAt.toISOString(),
        }))
      );
    });
  });

  return Promise.resolve();
};

export default reportRoutes;
