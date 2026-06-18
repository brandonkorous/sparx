// Inventory analytics (docs/100 P6b, docs/09 §8) — the supply-domain reporting
// surface: valuation, turnover / days-inventory-outstanding, aging + dead-stock,
// and reorder analysis (velocity → days-of-cover → projected stockout). All read
// the MASTER stock model (`inventory_levels`) + the movement ledger
// (`inventory_movements`), so they reconcile exactly to operational stock. Lives
// in @sparx/inventory so BOTH the REST reports route AND the MCP supply tools
// (P6c) share one implementation.
//
// Cost basis everywhere falls back avg_cost_cents → unit_cost_cents →
// variant.cost_cents (the same basis the valuation snapshot uses). Every query is
// explicitly `tenant_id`-scoped: the local superuser bypasses RLS, so a broad
// scan without it leaks other tenants' rows (RLS enforces it in prod).

import { withTenant } from '@sparx/db';
import type { ServiceContext } from '../errors';

const DEFAULT_CURRENCY = 'USD';
const DAY_MS = 24 * 60 * 60 * 1000;

// ─── Valuation ────────────────────────────────────────────────────────

export interface InventoryValuationReport {
  totalUnits: number;
  totalAllocated: number;
  totalAvailable: number;
  totalCostCents: number;
  totalRetailCents: number;
  currency: string;
}

interface ValuationRow {
  totalUnits: bigint;
  totalAllocated: bigint;
  totalAvailable: bigint;
  totalCostCents: bigint;
  totalRetailCents: bigint;
}

/** Current valuation: on-hand units + value at cost (moving-average) and retail. */
export async function inventoryValuation(ctx: ServiceContext): Promise<InventoryValuationReport> {
  return withTenant(ctx, async (tx) => {
    const [row] = await tx.$queryRaw<ValuationRow[]>`
      SELECT
        COALESCE(SUM(l.on_hand), 0)::bigint                                                        AS "totalUnits",
        COALESCE(SUM(l.allocated), 0)::bigint                                                      AS "totalAllocated",
        COALESCE(SUM(l.on_hand - l.allocated), 0)::bigint                                          AS "totalAvailable",
        COALESCE(SUM(l.on_hand * COALESCE(l.avg_cost_cents, l.unit_cost_cents, v.cost_cents, 0)), 0)::bigint AS "totalCostCents",
        COALESCE(SUM(l.on_hand * v.price_cents), 0)::bigint                                        AS "totalRetailCents"
      FROM inventory_levels l
      JOIN commerce_product_variants v ON v.id = l.variant_id AND v.deleted_at IS NULL
      JOIN inventory_warehouses w ON w.id = l.warehouse_id AND w.deleted_at IS NULL
      WHERE l.tenant_id = ${ctx.tenantId}::uuid
    `;
    return {
      totalUnits: Number(row?.totalUnits ?? 0),
      totalAllocated: Number(row?.totalAllocated ?? 0),
      totalAvailable: Number(row?.totalAvailable ?? 0),
      totalCostCents: Number(row?.totalCostCents ?? 0),
      totalRetailCents: Number(row?.totalRetailCents ?? 0),
      currency: DEFAULT_CURRENCY,
    };
  });
}

// ─── Turnover + days-inventory-outstanding ────────────────────────────

export interface TurnoverReport {
  range: { from: string; to: string };
  periodDays: number;
  cogsCents: number;
  unitsSold: number;
  avgInventoryValueCents: number;
  /** Turns over the period: COGS / average inventory value. */
  turnover: number;
  /** Annualized turns (scaled to 365 days). */
  turnoverAnnualized: number;
  /** Days of inventory on hand at the period's sales rate (365 / annualized). */
  daysInventoryOutstanding: number | null;
}

interface CogsRow {
  cogsCents: bigint;
  unitsSold: bigint;
}
interface AvgValueRow {
  avgCostCents: bigint;
  samples: bigint;
}

/**
 * Turnover + DIO over [from, to). COGS is the cost of `sale` movements in the
 * window (cost basis: the movement's recorded unit cost, else the level's current
 * moving-average). Average inventory value comes from the daily valuation
 * snapshots over the window (a real average); when none exist yet it falls back to
 * the current valuation. Tenant-wide — the snapshot rollup has no per-warehouse split.
 */
export async function turnoverReport(
  ctx: ServiceContext,
  range: { from: Date; to: Date }
): Promise<TurnoverReport> {
  const periodDays = Math.max(1, Math.round((range.to.getTime() - range.from.getTime()) / DAY_MS));

  return withTenant(ctx, async (tx) => {
    const [cogs] = await tx.$queryRaw<CogsRow[]>`
      SELECT
        COALESCE(SUM(ABS(m.delta) * COALESCE(m.unit_cost_cents, l.avg_cost_cents, v.cost_cents, 0)), 0)::bigint AS "cogsCents",
        COALESCE(SUM(ABS(m.delta)), 0)::bigint AS "unitsSold"
      FROM inventory_movements m
      JOIN commerce_product_variants v ON v.id = m.variant_id
      LEFT JOIN inventory_levels l ON l.variant_id = m.variant_id AND l.warehouse_id = m.warehouse_id
      WHERE m.tenant_id = ${ctx.tenantId}::uuid
        AND m.reason = 'sale'
        AND m.created_at >= ${range.from} AND m.created_at < ${range.to}
    `;
    const [avg] = await tx.$queryRaw<AvgValueRow[]>`
      SELECT COALESCE(AVG(total_cost_cents), 0)::bigint AS "avgCostCents",
             COUNT(*)::bigint AS "samples"
      FROM rollup_inventory_daily_valuation
      WHERE tenant_id = ${ctx.tenantId}::uuid
        AND bucket >= ${range.from} AND bucket < ${range.to}
    `;

    const cogsCents = Number(cogs?.cogsCents ?? 0);
    const unitsSold = Number(cogs?.unitsSold ?? 0);
    let avgInventoryValueCents = Number(avg?.avgCostCents ?? 0);
    if (Number(avg?.samples ?? 0) === 0) {
      avgInventoryValueCents = (await inventoryValuation(ctx)).totalCostCents;
    }

    const turnover = avgInventoryValueCents > 0 ? cogsCents / avgInventoryValueCents : 0;
    const turnoverAnnualized = turnover * (365 / periodDays);
    const daysInventoryOutstanding =
      turnoverAnnualized > 0 ? Math.round(365 / turnoverAnnualized) : null;

    return {
      range: { from: isoDate(range.from), to: isoDate(range.to) },
      periodDays,
      cogsCents,
      unitsSold,
      avgInventoryValueCents,
      turnover: round2(turnover),
      turnoverAnnualized: round2(turnoverAnnualized),
      daysInventoryOutstanding,
    };
  });
}

// ─── Aging + dead-stock ───────────────────────────────────────────────

export interface AgingBucket {
  bucket: '0-30' | '31-60' | '61-90' | '90+' | 'never';
  levels: number;
  units: number;
  costCents: number;
}
export interface DeadStockItem {
  variantId: string;
  warehouseId: string;
  sku: string | null;
  title: string | null;
  warehouseCode: string;
  onHand: number;
  costCents: number;
  lastSaleAt: string | null;
  daysSinceLastSale: number | null;
}
export interface AgingReport {
  deadStockDays: number;
  buckets: AgingBucket[];
  deadStock: DeadStockItem[];
}

interface BucketRow {
  bucket: AgingBucket['bucket'];
  levels: bigint;
  units: bigint;
  costCents: bigint;
}
interface DeadStockRow {
  variantId: string;
  warehouseId: string;
  sku: string | null;
  title: string | null;
  warehouseCode: string;
  onHand: number;
  costCents: bigint;
  lastSaleAt: Date | null;
  daysSinceLastSale: number | null;
}

const BUCKET_ORDER: AgingBucket['bucket'][] = ['0-30', '31-60', '61-90', '90+', 'never'];

/**
 * Aging by days-since-last-sale: on-hand value bucketed (0-30 / 31-60 / 61-90 /
 * 90+ / never sold), plus the highest-value dead-stock items (never sold OR not
 * sold in `deadStockDays`, default 90).
 */
export async function agingReport(
  ctx: ServiceContext,
  filter: { warehouseId?: string; deadStockDays?: number; take?: number } = {}
): Promise<AgingReport> {
  const deadStockDays = filter.deadStockDays ?? 90;
  const take = Math.min(filter.take ?? 50, 200);
  const warehouse = filter.warehouseId ?? null;

  return withTenant(ctx, async (tx) => {
    const buckets = await tx.$queryRaw<BucketRow[]>`
      WITH last_sale AS (
        SELECT variant_id, warehouse_id, MAX(created_at) AS last_sale_at
        FROM inventory_movements
        WHERE tenant_id = ${ctx.tenantId}::uuid AND reason = 'sale'
        GROUP BY variant_id, warehouse_id
      ), aged AS (
        SELECT
          l.on_hand,
          l.on_hand * COALESCE(l.avg_cost_cents, l.unit_cost_cents, v.cost_cents, 0) AS cost_cents,
          CASE
            WHEN ls.last_sale_at IS NULL THEN 'never'
            WHEN now() - ls.last_sale_at <= interval '30 days' THEN '0-30'
            WHEN now() - ls.last_sale_at <= interval '60 days' THEN '31-60'
            WHEN now() - ls.last_sale_at <= interval '90 days' THEN '61-90'
            ELSE '90+'
          END AS bucket
        FROM inventory_levels l
        JOIN commerce_product_variants v ON v.id = l.variant_id AND v.deleted_at IS NULL
        JOIN inventory_warehouses w ON w.id = l.warehouse_id AND w.deleted_at IS NULL
        LEFT JOIN last_sale ls ON ls.variant_id = l.variant_id AND ls.warehouse_id = l.warehouse_id
        WHERE l.tenant_id = ${ctx.tenantId}::uuid
          AND l.on_hand > 0
          AND (${warehouse}::uuid IS NULL OR l.warehouse_id = ${warehouse}::uuid)
      )
      SELECT bucket AS "bucket", COUNT(*)::bigint AS "levels",
             SUM(on_hand)::bigint AS "units", SUM(cost_cents)::bigint AS "costCents"
      FROM aged GROUP BY bucket
    `;

    const deadStock = await tx.$queryRaw<DeadStockRow[]>`
      WITH last_sale AS (
        SELECT variant_id, warehouse_id, MAX(created_at) AS last_sale_at
        FROM inventory_movements
        WHERE tenant_id = ${ctx.tenantId}::uuid AND reason = 'sale'
        GROUP BY variant_id, warehouse_id
      )
      SELECT
        l.variant_id AS "variantId", l.warehouse_id AS "warehouseId",
        v.sku AS "sku", COALESCE(p.title, v.sku) AS "title", w.code AS "warehouseCode",
        l.on_hand AS "onHand",
        (l.on_hand * COALESCE(l.avg_cost_cents, l.unit_cost_cents, v.cost_cents, 0))::bigint AS "costCents",
        ls.last_sale_at AS "lastSaleAt",
        CASE WHEN ls.last_sale_at IS NULL THEN NULL
             ELSE EXTRACT(DAY FROM (now() - ls.last_sale_at))::int END AS "daysSinceLastSale"
      FROM inventory_levels l
      JOIN commerce_product_variants v ON v.id = l.variant_id AND v.deleted_at IS NULL
      JOIN commerce_products p ON p.id = v.product_id
      JOIN inventory_warehouses w ON w.id = l.warehouse_id AND w.deleted_at IS NULL
      LEFT JOIN last_sale ls ON ls.variant_id = l.variant_id AND ls.warehouse_id = l.warehouse_id
      WHERE l.tenant_id = ${ctx.tenantId}::uuid
        AND l.on_hand > 0
        AND (ls.last_sale_at IS NULL OR now() - ls.last_sale_at > make_interval(days => ${deadStockDays}::int))
        AND (${warehouse}::uuid IS NULL OR l.warehouse_id = ${warehouse}::uuid)
      ORDER BY "costCents" DESC
      LIMIT ${take}
    `;

    const byBucket = new Map(buckets.map((b) => [b.bucket, b]));
    return {
      deadStockDays,
      buckets: BUCKET_ORDER.map((bucket) => {
        const r = byBucket.get(bucket);
        return {
          bucket,
          levels: Number(r?.levels ?? 0),
          units: Number(r?.units ?? 0),
          costCents: Number(r?.costCents ?? 0),
        };
      }),
      deadStock: deadStock.map((d) => ({
        variantId: d.variantId,
        warehouseId: d.warehouseId,
        sku: d.sku,
        title: d.title,
        warehouseCode: d.warehouseCode,
        onHand: d.onHand,
        costCents: Number(d.costCents),
        lastSaleAt: d.lastSaleAt ? d.lastSaleAt.toISOString() : null,
        daysSinceLastSale: d.daysSinceLastSale,
      })),
    };
  });
}

// ─── Reorder analysis (velocity → cover → projected stockout) ─────────

export interface ReorderAnalysisRow {
  variantId: string;
  warehouseId: string;
  sku: string | null;
  title: string | null;
  warehouseCode: string;
  onHand: number;
  available: number;
  reorderPoint: number;
  reorderQuantity: number | null;
  /** Average units sold per day over the velocity window. */
  velocityPerDay: number;
  /** Days of cover at that velocity (null when velocity is 0). */
  daysOfCover: number | null;
  projectedStockoutAt: string | null;
  suggestedQuantity: number;
  supplierName: string | null;
  unitCostCents: number | null;
}
export interface ReorderAnalysisReport {
  velocityDays: number;
  rows: ReorderAnalysisRow[];
}

interface ReorderAnalysisSqlRow {
  variantId: string;
  warehouseId: string;
  sku: string | null;
  title: string | null;
  warehouseCode: string;
  onHand: number;
  available: number;
  reorderPoint: number;
  reorderQuantity: number | null;
  soldInWindow: bigint;
  supplierName: string | null;
  minOrderQty: number | null;
  unitCostCents: number | null;
}

/**
 * Reorder analysis for items at/below their reorder point: sales velocity over
 * the last `velocityDays` (default 30), days-of-cover, projected stockout date,
 * a suggested order quantity, and the preferred (else cheapest) active supplier.
 */
export async function reorderAnalysis(
  ctx: ServiceContext,
  filter: { warehouseId?: string; velocityDays?: number; take?: number } = {}
): Promise<ReorderAnalysisReport> {
  const velocityDays = filter.velocityDays ?? 30;
  const take = Math.min(filter.take ?? 100, 250);
  const warehouse = filter.warehouseId ?? null;

  const rows = await withTenant(
    ctx,
    (tx) =>
      tx.$queryRaw<ReorderAnalysisSqlRow[]>`
      SELECT
        l.variant_id AS "variantId", l.warehouse_id AS "warehouseId",
        v.sku AS "sku", COALESCE(p.title, v.sku) AS "title", w.code AS "warehouseCode",
        l.on_hand AS "onHand", (l.on_hand - l.allocated) AS "available",
        l.reorder_point AS "reorderPoint", l.reorder_quantity AS "reorderQuantity",
        COALESCE(vel.sold, 0)::bigint AS "soldInWindow",
        sup.supplier_name AS "supplierName", sup.min_order_qty AS "minOrderQty",
        sup.unit_cost_cents AS "unitCostCents"
      FROM inventory_levels l
      JOIN commerce_product_variants v ON v.id = l.variant_id AND v.deleted_at IS NULL
      JOIN commerce_products p ON p.id = v.product_id
      JOIN inventory_warehouses w ON w.id = l.warehouse_id AND w.deleted_at IS NULL
      LEFT JOIN LATERAL (
        SELECT COALESCE(SUM(ABS(m.delta)), 0) AS sold
        FROM inventory_movements m
        WHERE m.tenant_id = l.tenant_id AND m.variant_id = l.variant_id
          AND m.warehouse_id = l.warehouse_id AND m.reason = 'sale'
          AND m.created_at >= now() - make_interval(days => ${velocityDays}::int)
      ) vel ON true
      LEFT JOIN LATERAL (
        SELECT s.name AS supplier_name, sv.unit_cost_cents, sv.min_order_qty
        FROM inventory_supplier_variants sv
        JOIN inventory_suppliers s ON s.id = sv.supplier_id AND s.deleted_at IS NULL AND s.is_active = true
        WHERE sv.variant_id = l.variant_id AND sv.tenant_id = l.tenant_id
        ORDER BY sv.is_preferred DESC, sv.unit_cost_cents ASC NULLS LAST
        LIMIT 1
      ) sup ON true
      WHERE l.tenant_id = ${ctx.tenantId}::uuid
        AND l.reorder_point IS NOT NULL
        AND (l.on_hand - l.allocated) <= l.reorder_point
        AND (${warehouse}::uuid IS NULL OR l.warehouse_id = ${warehouse}::uuid)
      ORDER BY (l.on_hand - l.allocated) ASC
      LIMIT ${take}
    `
  );

  const now = Date.now();
  return {
    velocityDays,
    rows: rows.map((r) => {
      const velocityPerDay = round2(Number(r.soldInWindow) / velocityDays);
      const daysOfCover = velocityPerDay > 0 ? round1(r.available / velocityPerDay) : null;
      const projectedStockoutAt =
        daysOfCover !== null ? new Date(now + daysOfCover * DAY_MS).toISOString() : null;
      const topUp = Math.max(0, r.reorderPoint - r.available);
      const suggestedQuantity = Math.max(
        r.reorderQuantity ?? topUp,
        r.minOrderQty ?? 1,
        topUp > 0 ? 1 : 0
      );
      return {
        variantId: r.variantId,
        warehouseId: r.warehouseId,
        sku: r.sku,
        title: r.title,
        warehouseCode: r.warehouseCode,
        onHand: r.onHand,
        available: r.available,
        reorderPoint: r.reorderPoint,
        reorderQuantity: r.reorderQuantity,
        velocityPerDay,
        daysOfCover,
        projectedStockoutAt,
        suggestedQuantity,
        supplierName: r.supplierName,
        unitCostCents: r.unitCostCents,
      };
    }),
  };
}

// ─── helpers ──────────────────────────────────────────────────────────

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}
function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
