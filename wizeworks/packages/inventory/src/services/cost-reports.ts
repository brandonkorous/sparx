// Cost reporting — valuation as it stood on a date, and standard cost against
// what was actually paid (docs/146 Phase 5.6, 5.8).
//
// ── Why as-of valuation is not just "the current one, but older" ─────────────
//
// Every stock report on the platform values what is on the shelf TODAY. That is
// the wrong number for the two occasions it is most often needed: the year-end
// figure an accountant asks for in March, and the "what were we holding when
// this went wrong" question after a discrepancy. Neither can be answered by a
// snapshot table that only started collecting last month.
//
// Both can be answered from the ledgers, because both ledgers are append-only.
// Units at a moment are the movements up to it; value at a moment is the cost
// layers that had arrived by then, less what had been consumed off them by then.
// Nothing is estimated and nothing is interpolated.
//
// ── And why the two are reported side by side ────────────────────────────────
//
// Layers only cover stock the platform costed. A business importing history, or
// one that has driven a level negative under a continue policy, will have units
// the layers cannot account for. The report says how many rather than quietly
// valuing them at zero or silently dropping them — a valuation that does not
// admit its own gaps is the kind an audit finds for you.

import { withTenant } from '@wizeworks/db';

import type { ServiceContext } from '../errors';

import { listOpenLayers, movementCostBreakdown } from './cost-layers';
import type { CostLayerRow, MovementCostBreakdownRow } from './cost-layers';

const DAY_MS = 24 * 60 * 60 * 1000;

// ─── Valuation as of a date ──────────────────────────────────────────────────

export interface AsOfValuationRow {
  variantId: string;
  sku: string | null;
  title: string | null;
  warehouseId: string;
  warehouseCode: string;
  units: number;
  /** Units the cost layers can account for. Below `units` where stock predates
   *  costing or a level was driven negative. */
  unitsCovered: number;
  valueCents: number;
}

export interface AsOfValuationReport {
  asOf: string;
  totalUnits: number;
  totalUnitsCovered: number;
  totalValueCents: number;
  /** Units on hand that no cost layer accounts for. Zero is the normal answer;
   *  anything else is a number someone should look at. */
  uncostedUnits: number;
  currency: string;
  rows: AsOfValuationRow[];
}

interface AsOfRow {
  variant_id: string;
  sku: string | null;
  title: string | null;
  warehouse_id: string;
  warehouse_code: string;
  units: bigint;
  units_covered: bigint;
  value_cents: bigint;
}

/**
 * What the stock was worth at a moment in the past.
 *
 * Two independent walks of the ledgers, joined at the end:
 *
 *   UNITS   Σ(movement delta) up to the instant. This is authoritative — it is
 *           the same arithmetic that makes `on_hand` reconcilable today, run to
 *           an earlier stopping point.
 *   VALUE   for every cost layer acquired by then, how much of it was still
 *           unconsumed by then, times what it cost. Consumption rows are signed,
 *           so a reversal inside the window gives its units back without a
 *           special case.
 */
export async function valuationAsOf(
  ctx: ServiceContext,
  params: { asOf: Date; warehouseId?: string | null; take?: number }
): Promise<AsOfValuationReport> {
  const take = Math.min(params.take ?? 200, 1000);
  const warehouse = params.warehouseId ?? null;

  return withTenant(ctx, async (tx) => {
    const rows = await tx.$queryRaw<AsOfRow[]>`
      WITH units AS (
        SELECT m.variant_id, m.warehouse_id, SUM(m.delta)::bigint AS units
        FROM inventory_movements m
        WHERE m.tenant_id = ${ctx.tenantId}::uuid
          AND m.created_at <= ${params.asOf}
          AND (${warehouse}::uuid IS NULL OR m.warehouse_id = ${warehouse}::uuid)
        GROUP BY m.variant_id, m.warehouse_id
      ), layered AS (
        SELECT l.variant_id,
               l.warehouse_id,
               SUM(GREATEST(0, l.quantity - COALESCE(c.taken, 0)))::bigint AS units_covered,
               SUM(GREATEST(0, l.quantity - COALESCE(c.taken, 0)) * l.unit_cost_cents)::bigint
                 AS value_cents
        FROM inventory_cost_layers l
        LEFT JOIN LATERAL (
          SELECT COALESCE(SUM(cc.quantity), 0) AS taken
          FROM inventory_cost_consumptions cc
          WHERE cc.tenant_id = l.tenant_id
            AND cc.layer_id = l.id
            AND cc.created_at <= ${params.asOf}
        ) c ON true
        WHERE l.tenant_id = ${ctx.tenantId}::uuid
          AND l.acquired_at <= ${params.asOf}
          AND (${warehouse}::uuid IS NULL OR l.warehouse_id = ${warehouse}::uuid)
        GROUP BY l.variant_id, l.warehouse_id
      )
      SELECT u.variant_id, v.sku, COALESCE(p.title, v.sku) AS title,
             u.warehouse_id, w.code AS warehouse_code,
             u.units,
             COALESCE(la.units_covered, 0)::bigint AS units_covered,
             COALESCE(la.value_cents, 0)::bigint AS value_cents
      FROM units u
      JOIN commerce_product_variants v ON v.id = u.variant_id
      JOIN commerce_products p ON p.id = v.product_id
      JOIN inventory_warehouses w ON w.id = u.warehouse_id
      LEFT JOIN layered la
        ON la.variant_id = u.variant_id AND la.warehouse_id = u.warehouse_id
      WHERE u.units <> 0
      ORDER BY COALESCE(la.value_cents, 0) DESC, v.sku ASC
      LIMIT ${take}
    `;

    // The totals are computed over EVERY level, not the page — a valuation that
    // only totals the rows that fitted on screen is not a valuation.
    const [totals] = await tx.$queryRaw<
      { units: bigint; units_covered: bigint; value_cents: bigint }[]
    >`
      WITH units AS (
        SELECT SUM(m.delta)::bigint AS units
        FROM inventory_movements m
        WHERE m.tenant_id = ${ctx.tenantId}::uuid
          AND m.created_at <= ${params.asOf}
          AND (${warehouse}::uuid IS NULL OR m.warehouse_id = ${warehouse}::uuid)
      ), layered AS (
        SELECT SUM(GREATEST(0, l.quantity - COALESCE(c.taken, 0)))::bigint AS units_covered,
               SUM(GREATEST(0, l.quantity - COALESCE(c.taken, 0)) * l.unit_cost_cents)::bigint
                 AS value_cents
        FROM inventory_cost_layers l
        LEFT JOIN LATERAL (
          SELECT COALESCE(SUM(cc.quantity), 0) AS taken
          FROM inventory_cost_consumptions cc
          WHERE cc.tenant_id = l.tenant_id
            AND cc.layer_id = l.id
            AND cc.created_at <= ${params.asOf}
        ) c ON true
        WHERE l.tenant_id = ${ctx.tenantId}::uuid
          AND l.acquired_at <= ${params.asOf}
          AND (${warehouse}::uuid IS NULL OR l.warehouse_id = ${warehouse}::uuid)
      )
      SELECT COALESCE((SELECT units FROM units), 0)::bigint AS units,
             COALESCE((SELECT units_covered FROM layered), 0)::bigint AS units_covered,
             COALESCE((SELECT value_cents FROM layered), 0)::bigint AS value_cents
    `;

    const policy = await tx.costingPolicy.findFirst({
      where: { tenantId: ctx.tenantId },
      select: { baseCurrency: true },
    });
    const totalUnits = Number(totals?.units ?? 0);
    const totalUnitsCovered = Number(totals?.units_covered ?? 0);

    return {
      asOf: params.asOf.toISOString(),
      totalUnits,
      totalUnitsCovered,
      totalValueCents: Number(totals?.value_cents ?? 0),
      uncostedUnits: Math.max(0, totalUnits - totalUnitsCovered),
      currency: policy?.baseCurrency ?? 'USD',
      rows: rows.map((r) => ({
        variantId: r.variant_id,
        sku: r.sku,
        title: r.title,
        warehouseId: r.warehouse_id,
        warehouseCode: r.warehouse_code,
        units: Number(r.units),
        unitsCovered: Number(r.units_covered),
        valueCents: Number(r.value_cents),
      })),
    };
  });
}

// ─── Purchase price variance ─────────────────────────────────────────────────

export interface PriceVarianceRow {
  variantId: string;
  sku: string | null;
  title: string | null;
  supplierId: string | null;
  supplierName: string | null;
  unitsReceived: number;
  /** The planned figure — this location's standard cost, else the catalogue's. */
  standardUnitCostCents: number | null;
  /** What a unit actually cost, landed. */
  actualUnitCostCents: number;
  /** (actual − standard) × units. Positive means it cost MORE than planned. */
  varianceCents: number;
  /** The same as a percentage of the planned cost. Null when nothing was
   *  planned — a variance against no standard is not a number, it is a gap. */
  variancePercent: number | null;
}

export interface PriceVarianceReport {
  from: string;
  to: string;
  currency: string;
  totalUnits: number;
  totalStandardCents: number;
  totalActualCents: number;
  totalVarianceCents: number;
  /** Units received against a variant with no standard cost set. The report is
   *  blind to those, and says so rather than counting them as zero variance. */
  unitsWithoutStandard: number;
  rows: PriceVarianceRow[];
}

interface VarianceSqlRow {
  variant_id: string;
  sku: string | null;
  title: string | null;
  supplier_id: string | null;
  supplier_name: string | null;
  units: bigint;
  standard_unit_cost_cents: number | null;
  actual_cents: bigint;
  standard_cents: bigint | null;
}

/**
 * What was planned against what was paid, per variant, over a window.
 *
 * Reads deliveries rather than movements, because the question is about
 * PURCHASING: "the part we budgeted at £4.00 has been landing at £4.62 all
 * quarter" is a supplier conversation and a pricing decision, and it is
 * invisible in a moving average that quietly absorbed it.
 *
 * The actual is the LANDED cost, not the invoice cost — which is the entire
 * point. A supplier who holds their price and moves the freight onto you has not
 * held their price, and a variance report reading the invoice line would agree
 * with them.
 */
export async function priceVarianceReport(
  ctx: ServiceContext,
  params: {
    from: Date;
    to: Date;
    warehouseId?: string | null;
    supplierId?: string | null;
    take?: number;
  }
): Promise<PriceVarianceReport> {
  const take = Math.min(params.take ?? 100, 250);
  const warehouse = params.warehouseId ?? null;
  const supplier = params.supplierId ?? null;

  return withTenant(ctx, async (tx) => {
    const rows = await tx.$queryRaw<VarianceSqlRow[]>`
      WITH received AS (
        SELECT
          rl.variant_id,
          po.supplier_id,
          SUM(rl.quantity_received)::bigint AS units,
          SUM(rl.quantity_received * COALESCE(rl.landed_unit_cost_cents, rl.unit_cost_cents))::bigint
            AS actual_cents,
          -- The standard is read at the LOCATION the goods landed in, because a
          -- business can plan a different cost per site; the catalogue figure is
          -- the fallback.
          MAX(COALESCE(lv.unit_cost_cents, v.cost_cents)) AS standard_unit_cost_cents,
          SUM(rl.quantity_received * COALESCE(lv.unit_cost_cents, v.cost_cents))::bigint
            AS standard_cents
        FROM inventory_goods_receipt_lines rl
        JOIN inventory_goods_receipts r ON r.id = rl.goods_receipt_id
        JOIN inventory_purchase_orders po ON po.id = r.purchase_order_id
        JOIN commerce_product_variants v ON v.id = rl.variant_id
        LEFT JOIN inventory_levels lv
          ON lv.variant_id = rl.variant_id AND lv.warehouse_id = r.warehouse_id
        WHERE rl.tenant_id = ${ctx.tenantId}::uuid
          AND r.received_at >= ${params.from}
          AND r.received_at < ${params.to}
          AND rl.quantity_received > 0
          AND (${warehouse}::uuid IS NULL OR r.warehouse_id = ${warehouse}::uuid)
          AND (${supplier}::uuid IS NULL OR po.supplier_id = ${supplier}::uuid)
        GROUP BY rl.variant_id, po.supplier_id
      )
      SELECT rc.variant_id, v.sku, COALESCE(p.title, v.sku) AS title,
             rc.supplier_id, s.name AS supplier_name,
             rc.units, rc.standard_unit_cost_cents, rc.actual_cents, rc.standard_cents
      FROM received rc
      JOIN commerce_product_variants v ON v.id = rc.variant_id
      JOIN commerce_products p ON p.id = v.product_id
      LEFT JOIN inventory_suppliers s ON s.id = rc.supplier_id
      ORDER BY ABS(rc.actual_cents - COALESCE(rc.standard_cents, rc.actual_cents)) DESC
      LIMIT ${take}
    `;

    const policy = await tx.costingPolicy.findFirst({
      where: { tenantId: ctx.tenantId },
      select: { baseCurrency: true },
    });

    let totalUnits = 0;
    let totalStandardCents = 0;
    let totalActualCents = 0;
    let unitsWithoutStandard = 0;

    const mapped = rows.map((r) => {
      const units = Number(r.units);
      const actual = Number(r.actual_cents);
      const hasStandard = r.standard_cents !== null && r.standard_unit_cost_cents !== null;
      const standard = hasStandard ? Number(r.standard_cents) : 0;

      totalUnits += units;
      totalActualCents += actual;
      if (hasStandard) totalStandardCents += standard;
      else unitsWithoutStandard += units;

      const varianceCents = hasStandard ? actual - standard : 0;
      return {
        variantId: r.variant_id,
        sku: r.sku,
        title: r.title,
        supplierId: r.supplier_id,
        supplierName: r.supplier_name,
        unitsReceived: units,
        standardUnitCostCents: r.standard_unit_cost_cents,
        actualUnitCostCents: units > 0 ? Math.round(actual / units) : 0,
        varianceCents,
        variancePercent:
          hasStandard && standard > 0 ? Math.round((varianceCents / standard) * 1000) / 10 : null,
      };
    });

    return {
      from: params.from.toISOString(),
      to: params.to.toISOString(),
      currency: policy?.baseCurrency ?? 'USD',
      totalUnits,
      totalStandardCents,
      totalActualCents,
      totalVarianceCents: totalActualCents - totalStandardCents,
      unitsWithoutStandard,
      rows: mapped,
    };
  });
}

// ─── Cost of goods over a window ─────────────────────────────────────────────

export interface CogsRow {
  reason: string;
  units: number;
  costCents: number;
  movements: number;
}

export interface CogsReport {
  from: string;
  to: string;
  currency: string;
  /** The sum of `cost_consumed_cents` over the window — a subtraction, not an
   *  estimate. Reversals carry a negative cost, so a cancelled order nets itself
   *  out with no special case. */
  totalCostCents: number;
  /** Cost attributable to `sale` movements alone — what an income statement
   *  means by cost of goods sold, with shrinkage kept separate. */
  saleCostCents: number;
  /** Units that left with no cost stamped on them — movements written before
   *  this shipped. Named so a period that straddles the change is legible
   *  instead of merely low. */
  unattributedUnits: number;
  byReason: CogsRow[];
}

/**
 * Cost of goods over a window, straight off the movement ledger.
 *
 * Before this phase, cost of goods sold was re-derived at read time by
 * multiplying units by whatever the average happened to be TODAY — so last
 * quarter's margin changed every time a delivery arrived. `cost_consumed_cents`
 * is stamped when the goods leave, which makes the number stable, and makes this
 * report a `SUM`.
 */
export async function cogsReport(
  ctx: ServiceContext,
  params: { from: Date; to: Date; warehouseId?: string | null }
): Promise<CogsReport> {
  const warehouse = params.warehouseId ?? null;

  return withTenant(ctx, async (tx) => {
    const rows = await tx.$queryRaw<
      { reason: string; units: bigint; cost_cents: bigint; movements: bigint }[]
    >`
      SELECT m.reason,
             COALESCE(SUM(ABS(m.delta)), 0)::bigint AS units,
             COALESCE(SUM(m.cost_consumed_cents), 0)::bigint AS cost_cents,
             COUNT(*)::bigint AS movements
      FROM inventory_movements m
      WHERE m.tenant_id = ${ctx.tenantId}::uuid
        AND m.created_at >= ${params.from} AND m.created_at < ${params.to}
        AND m.cost_consumed_cents IS NOT NULL
        AND (${warehouse}::uuid IS NULL OR m.warehouse_id = ${warehouse}::uuid)
      GROUP BY m.reason
      ORDER BY SUM(m.cost_consumed_cents) DESC
    `;

    const [gap] = await tx.$queryRaw<{ units: bigint }[]>`
      SELECT COALESCE(SUM(ABS(m.delta)), 0)::bigint AS units
      FROM inventory_movements m
      WHERE m.tenant_id = ${ctx.tenantId}::uuid
        AND m.created_at >= ${params.from} AND m.created_at < ${params.to}
        AND m.delta < 0
        AND m.cost_consumed_cents IS NULL
        AND (${warehouse}::uuid IS NULL OR m.warehouse_id = ${warehouse}::uuid)
    `;

    const policy = await tx.costingPolicy.findFirst({
      where: { tenantId: ctx.tenantId },
      select: { baseCurrency: true },
    });

    const byReason = rows.map((r) => ({
      reason: r.reason,
      units: Number(r.units),
      costCents: Number(r.cost_cents),
      movements: Number(r.movements),
    }));

    return {
      from: params.from.toISOString(),
      to: params.to.toISOString(),
      currency: policy?.baseCurrency ?? 'USD',
      totalCostCents: byReason.reduce((s, r) => s + r.costCents, 0),
      saleCostCents: byReason.find((r) => r.reason === 'sale')?.costCents ?? 0,
      unattributedUnits: Number(gap?.units ?? 0),
      byReason,
    };
  });
}

// ─── What this stock is made of ──────────────────────────────────────────────

/**
 * The open cost layers behind one item — "these 40 units are 28 off the March
 * delivery at £8.20 and 12 off January's at £7.15".
 *
 * The read behind the cost half of the provenance drawer, and the answer to the
 * question a moving average structurally cannot answer.
 */
export async function variantCostLayers(
  ctx: ServiceContext,
  params: { variantId: string; warehouseId?: string | null; take?: number }
): Promise<{ units: number; valueCents: number; layers: CostLayerRow[] }> {
  return withTenant(ctx, async (tx) => {
    const layers = await listOpenLayers(tx, {
      tenantId: ctx.tenantId,
      variantId: params.variantId,
      warehouseId: params.warehouseId ?? null,
      ...(params.take !== undefined ? { take: params.take } : {}),
    });
    return {
      units: layers.reduce((s, l) => s + l.quantityRemaining, 0),
      valueCents: layers.reduce((s, l) => s + l.quantityRemaining * l.unitCostCents, 0),
      layers,
    };
  });
}

/** What one movement's cost was made of, for the provenance drawer. */
export async function movementCostLayers(
  ctx: ServiceContext,
  movementId: string
): Promise<MovementCostBreakdownRow[]> {
  return withTenant(ctx, (tx) => movementCostBreakdown(tx, { tenantId: ctx.tenantId, movementId }));
}

/** A window ending now, for callers that only have a day count. */
export function windowOfDays(days: number): { from: Date; to: Date } {
  const to = new Date();
  return { from: new Date(to.getTime() - days * DAY_MS), to };
}
