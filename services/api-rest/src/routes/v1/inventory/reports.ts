// Inventory module reporting reads (docs/64, docs/97 §5, docs/100 P1c).
//
//   GET /v1/inventory/reports/summary
//     → valuation (units + cost/retail value), stock-status counts
//       (out / low / healthy), per-warehouse quantities, source-feed health,
//       and the low/out-of-stock attention list
//   GET /v1/inventory/reports/valuation-timeseries
//     → daily valuation snapshots + a live-overlay of today
//   GET /v1/inventory/reports/activity?limit=
//     → the most recent stock movements (the real movement ledger feed)
//
// LIVE aggregates over the MASTER stock model — `inventory_levels` (the
// authoritative (variant, warehouse) on-hand, written only through the movement
// ledger) joined to `commerce_product_variants` for cost/retail, and
// `inventory_movements` for the activity feed. Cost basis falls back
// avg_cost_cents → unit_cost_cents → variant.cost_cents. "Low" uses the level's
// reorder point when set, else a fixed available-units threshold. Purchase orders
// have no backing model yet (P3) and stay sample on the overview.
// Inventory-module-gated + viewer-read, tenant-scoped via withTenant (RLS).

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { withTenant } from '@sparx/db';
import type { TxClient } from '@sparx/db';
import { ok } from '@sparx/api-core/envelope';
import { requireRole } from '@sparx/api-core/auth';
import { requireInventoryModule, toInventoryContext } from '../../../lib/inventory-context.js';
import {
  addUtcDays,
  startOfUtcDay,
  valuationTimeseries,
} from '../../../lib/inventory-valuation.js';

const DEFAULT_CURRENCY = 'USD';
// Available-units fallback threshold (used when a level has no reorder point).
const LOW_STOCK_THRESHOLD = 5;

const ActivityQuery = z.object({
  limit: z.coerce.number().int().min(1).max(50).optional(),
});

const RangeQuery = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});

interface SummaryAggRow {
  totalUnits: bigint;
  totalAllocated: bigint;
  totalAvailable: bigint;
  totalCostCents: bigint;
  totalRetailCents: bigint;
  skuCount: number;
  outCount: number;
  lowCount: number;
  healthyCount: number;
}
interface ByWarehouseRow {
  warehouseId: string;
  name: string;
  type: string;
  skuCount: number;
  onHand: bigint;
  available: bigint;
}
interface LowOrOutRow {
  variantId: string;
  warehouseId: string;
  sku: string;
  title: string;
  location: string;
  onHand: number;
  available: number;
}
interface ActivityRow {
  id: string;
  variantId: string;
  warehouseId: string;
  delta: number;
  balanceAfter: number | null;
  reason: string;
  createdAt: Date;
  sku: string;
  title: string;
  location: string;
}

// ── Aggregate readers (raw SQL over the master model) ────────────────

function summaryAgg(tx: TxClient): Promise<SummaryAggRow[]> {
  return tx.$queryRaw<SummaryAggRow[]>`
    SELECT
      COALESCE(SUM(l.on_hand), 0)::bigint                                          AS "totalUnits",
      COALESCE(SUM(l.allocated), 0)::bigint                                        AS "totalAllocated",
      COALESCE(SUM(l.on_hand - l.allocated), 0)::bigint                            AS "totalAvailable",
      COALESCE(SUM(l.on_hand * COALESCE(l.avg_cost_cents, l.unit_cost_cents, v.cost_cents, 0)), 0)::bigint AS "totalCostCents",
      COALESCE(SUM(l.on_hand * v.price_cents), 0)::bigint                          AS "totalRetailCents",
      COUNT(*)::int                                                                AS "skuCount",
      COUNT(*) FILTER (WHERE l.on_hand - l.allocated <= 0)::int                    AS "outCount",
      COUNT(*) FILTER (
        WHERE l.on_hand - l.allocated > 0
          AND l.on_hand - l.allocated <= COALESCE(l.reorder_point, ${LOW_STOCK_THRESHOLD})
      )::int                                                                       AS "lowCount",
      COUNT(*) FILTER (
        WHERE l.on_hand - l.allocated > COALESCE(l.reorder_point, ${LOW_STOCK_THRESHOLD})
      )::int                                                                       AS "healthyCount"
    FROM inventory_levels l
    JOIN commerce_product_variants v ON v.id = l.variant_id AND v.deleted_at IS NULL
    JOIN inventory_warehouses w ON w.id = l.warehouse_id AND w.deleted_at IS NULL
  `;
}

function byWarehouse(tx: TxClient): Promise<ByWarehouseRow[]> {
  return tx.$queryRaw<ByWarehouseRow[]>`
    SELECT
      l.warehouse_id                                  AS "warehouseId",
      w.name                                          AS "name",
      w.type                                          AS "type",
      COUNT(*)::int                                   AS "skuCount",
      COALESCE(SUM(l.on_hand), 0)::bigint             AS "onHand",
      COALESCE(SUM(l.on_hand - l.allocated), 0)::bigint AS "available"
    FROM inventory_levels l
    JOIN inventory_warehouses w ON w.id = l.warehouse_id AND w.deleted_at IS NULL
    GROUP BY l.warehouse_id, w.name, w.type
    ORDER BY COALESCE(SUM(l.on_hand), 0) DESC
    LIMIT 50
  `;
}

function lowOrOut(tx: TxClient): Promise<LowOrOutRow[]> {
  return tx.$queryRaw<LowOrOutRow[]>`
    SELECT
      l.variant_id                AS "variantId",
      l.warehouse_id              AS "warehouseId",
      v.sku                       AS "sku",
      COALESCE(v.title, v.sku)    AS "title",
      w.name                      AS "location",
      l.on_hand                   AS "onHand",
      l.on_hand - l.allocated     AS "available"
    FROM inventory_levels l
    JOIN commerce_product_variants v ON v.id = l.variant_id AND v.deleted_at IS NULL
    JOIN inventory_warehouses w ON w.id = l.warehouse_id AND w.deleted_at IS NULL
    WHERE l.on_hand - l.allocated <= COALESCE(l.reorder_point, ${LOW_STOCK_THRESHOLD})
    ORDER BY (l.on_hand - l.allocated) ASC
    LIMIT 8
  `;
}

const reportRoutes: FastifyPluginAsync = (app) => {
  app.get('/v1/inventory/reports/summary', async (request) => {
    await requireInventoryModule(request);
    requireRole(request, 'viewer');
    const ctx = toInventoryContext(request);

    return withTenant(ctx, async (tx) => {
      const [aggRows, warehouseGroups, lowOrOutRows, sourceGroups, lastSyncAgg] = await Promise.all(
        [
          summaryAgg(tx),
          byWarehouse(tx),
          lowOrOut(tx),
          tx.inventorySource.groupBy({
            by: ['status'],
            where: { deletedAt: null },
            _count: { _all: true },
          }),
          tx.inventorySource.aggregate({
            where: { deletedAt: null },
            _max: { lastSyncAt: true },
          }),
        ]
      );

      const agg = aggRows[0];

      const byLocation = warehouseGroups.map((g) => ({
        warehouseId: g.warehouseId,
        name: g.name,
        type: g.type,
        skuCount: g.skuCount,
        onHand: Number(g.onHand),
        available: Number(g.available),
      }));

      const sourceStatus = { total: 0, active: 0, paused: 0, error: 0 };
      for (const g of sourceGroups) {
        sourceStatus.total += g._count._all;
        if (g.status in sourceStatus) {
          sourceStatus[g.status as 'active' | 'paused' | 'error'] = g._count._all;
        }
      }

      const lowOrOutList = lowOrOutRows.map((l) => ({
        variantId: l.variantId,
        warehouseId: l.warehouseId,
        sku: l.sku,
        title: l.title,
        location: l.location,
        onHand: l.onHand,
        available: l.available,
        status: l.available <= 0 ? 'out' : 'low',
      }));

      return ok({
        valuation: {
          totalUnits: Number(agg?.totalUnits ?? 0),
          totalAllocated: Number(agg?.totalAllocated ?? 0),
          totalAvailable: Number(agg?.totalAvailable ?? 0),
          totalCostCents: Number(agg?.totalCostCents ?? 0),
          totalRetailCents: Number(agg?.totalRetailCents ?? 0),
          currency: DEFAULT_CURRENCY,
        },
        stockStatus: {
          skuCount: agg?.skuCount ?? 0,
          outOfStock: agg?.outCount ?? 0,
          lowStock: agg?.lowCount ?? 0,
          healthy: agg?.healthyCount ?? 0,
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

  // Valuation over time — the daily snapshot series (rollup_inventory_daily_
  // valuation) + a live-overlay of today's current valuation. Builds forward
  // from first capture; no historical backfill is possible (see the model note).
  app.get('/v1/inventory/reports/valuation-timeseries', async (request) => {
    await requireInventoryModule(request);
    requireRole(request, 'viewer');
    const ctx = toInventoryContext(request);
    const q = RangeQuery.parse(request.query);
    const to = startOfUtcDay(q.to ? new Date(q.to) : new Date());
    const from = startOfUtcDay(q.from ? new Date(q.from) : addUtcDays(to, -13));
    const toExclusive = addUtcDays(to, 1);
    return ok(await withTenant(ctx, (tx) => valuationTimeseries(tx, from, to, toExclusive)));
  });

  // Recent stock movements — the real ledger feed (every onHand change appends a
  // row via applyMovement, so this is an exact audit of who moved what, when).
  app.get('/v1/inventory/reports/activity', async (request) => {
    await requireInventoryModule(request);
    requireRole(request, 'viewer');
    const ctx = toInventoryContext(request);
    const take = ActivityQuery.parse(request.query).limit ?? 10;

    return withTenant(ctx, async (tx) => {
      const rows = await tx.$queryRaw<ActivityRow[]>`
        SELECT
          m.id            AS "id",
          m.variant_id    AS "variantId",
          m.warehouse_id  AS "warehouseId",
          m.delta         AS "delta",
          m.balance_after AS "balanceAfter",
          m.reason        AS "reason",
          m.created_at    AS "createdAt",
          v.sku           AS "sku",
          COALESCE(v.title, v.sku) AS "title",
          w.name          AS "location"
        FROM inventory_movements m
        JOIN commerce_product_variants v ON v.id = m.variant_id
        JOIN inventory_warehouses w ON w.id = m.warehouse_id
        ORDER BY m.created_at DESC
        LIMIT ${take}
      `;

      return ok(
        rows.map((m) => ({
          id: m.id,
          variantId: m.variantId,
          warehouseId: m.warehouseId,
          sku: m.sku,
          title: m.title,
          location: m.location,
          delta: m.delta,
          balanceAfter: m.balanceAfter,
          reason: m.reason,
          createdAt: m.createdAt.toISOString(),
        }))
      );
    });
  });

  return Promise.resolve();
};

export default reportRoutes;
