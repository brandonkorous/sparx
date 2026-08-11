// Shrinkage — what left without being sold (docs/146 Phase 1).
//
// 80% of operators report annual shrinkage between 1% and 5% of inventory value,
// and almost none of them can say where it went, because the write-offs that
// produce it are scattered across adjustments, damaged receipts and count
// variances. The ledger already records every one of them with a reason; this
// module is the read that puts them in one place and prices them.
//
// WHAT COUNTS AS SHRINKAGE HERE:
//   loss     — units gone, cause unknown. The classic.
//   damage   — units written off broken, including damaged-on-arrival receipts.
//   recount  — a count posted a NEGATIVE correction. Positive recounts are not
//              shrinkage; they are the same measurement error in the other
//              direction, and netting them off would hide both. They are reported
//              separately as `recountGain` so the pair can be read together.
//
// WHAT DOES NOT: `sale`, `transfer_out`, `cancel`, `reserve`/`release`. Those are
// stock behaving as intended, and folding them in is how a shrinkage number stops
// meaning anything.
//
// Every figure is valued at the movement's own `unit_cost_cents` where one was
// recorded, falling back to the level's cost basis. A write-off priced at today's
// cost when it happened eight months ago is a plausible-looking wrong number.

import { withTenant } from '@sparx/db';

import type { ServiceContext } from '../errors';

export interface ShrinkageByReason {
  reason: string;
  /** Units lost (always reported positive — the sign is in the reason). */
  units: number;
  valueCents: number;
  movements: number;
}

export interface ShrinkageByWarehouse {
  warehouseId: string;
  warehouseName: string | null;
  warehouseCode: string | null;
  units: number;
  valueCents: number;
}

export interface ShrinkageTopVariant {
  variantId: string;
  variantSku: string | null;
  productTitle: string | null;
  units: number;
  valueCents: number;
  movements: number;
}

export interface ShrinkagePeriod {
  /** Month bucket, ISO date of the first of the month (UTC). */
  period: string;
  units: number;
  valueCents: number;
}

export interface ShrinkageReport {
  from: string;
  to: string;
  /** Units and value written off across every shrinkage reason. */
  totalUnits: number;
  totalValueCents: number;
  /** Positive count corrections in the same window — the other half of the
   *  measurement-error story, reported rather than netted. */
  recountGainUnits: number;
  recountGainValueCents: number;
  /** Shrinkage value as a percentage of current inventory value at cost, to one
   *  decimal. Null when there is no inventory to compare against (a new tenant's
   *  "infinity%" is worse than no number). */
  percentOfValuation: number | null;
  currentValuationCents: number;
  byReason: ShrinkageByReason[];
  byWarehouse: ShrinkageByWarehouse[];
  topVariants: ShrinkageTopVariant[];
  byPeriod: ShrinkagePeriod[];
}

export interface ShrinkageFilter {
  /** Inclusive ISO bounds. Defaults to the last 12 months. */
  from?: string;
  to?: string;
  warehouseId?: string;
}

/** The reasons that represent stock leaving without a sale. `recount` is included
 *  but split by sign inside the queries. */
const SHRINK_REASONS = ['loss', 'damage', 'recount'] as const;

interface ReasonRow {
  reason: string;
  units: number;
  valueCents: number;
  movements: number;
}
interface WarehouseRow {
  warehouseId: string;
  warehouseName: string | null;
  warehouseCode: string | null;
  units: number;
  valueCents: number;
}
interface VariantRow {
  variantId: string;
  variantSku: string | null;
  productTitle: string | null;
  units: number;
  valueCents: number;
  movements: number;
}
interface PeriodRow {
  period: Date;
  units: number;
  valueCents: number;
}
interface GainRow {
  units: number;
  valueCents: number;
}
interface ValuationRow {
  valueCents: number;
}

export async function shrinkageReport(
  ctx: ServiceContext,
  filter: ShrinkageFilter = {}
): Promise<ShrinkageReport> {
  const to = filter.to ? new Date(filter.to) : new Date();
  const from = filter.from
    ? new Date(filter.from)
    : new Date(Date.UTC(to.getUTCFullYear() - 1, to.getUTCMonth(), 1));

  return withTenant(ctx, async (tx) => {
    const wh = filter.warehouseId ?? null;

    // The valued cost of a write-off: the movement's own recorded cost first
    // (what the unit actually cost when it was lost), then the level's basis.
    // COALESCE order is the whole point — see the module note.
    const byReason = await tx.$queryRaw<ReasonRow[]>`
      SELECT m.reason                                     AS "reason",
             SUM(ABS(m.delta))::int                       AS "units",
             COALESCE(SUM(ABS(m.delta) * COALESCE(
               m.unit_cost_cents, l.avg_cost_cents, l.unit_cost_cents, 0)), 0)::bigint::int
                                                          AS "valueCents",
             COUNT(*)::int                                AS "movements"
        FROM inventory_movements m
        LEFT JOIN inventory_levels l
               ON l.variant_id = m.variant_id AND l.warehouse_id = m.warehouse_id
       WHERE m.tenant_id = ${ctx.tenantId}::uuid
         AND m.created_at >= ${from}
         AND m.created_at <= ${to}
         AND m.delta < 0
         AND m.reason = ANY(${[...SHRINK_REASONS]}::text[])
         AND (${wh}::uuid IS NULL OR m.warehouse_id = ${wh}::uuid)
       GROUP BY m.reason
       ORDER BY 3 DESC
    `;

    const byWarehouse = await tx.$queryRaw<WarehouseRow[]>`
      SELECT m.warehouse_id                               AS "warehouseId",
             w.name                                       AS "warehouseName",
             w.code                                       AS "warehouseCode",
             SUM(ABS(m.delta))::int                       AS "units",
             COALESCE(SUM(ABS(m.delta) * COALESCE(
               m.unit_cost_cents, l.avg_cost_cents, l.unit_cost_cents, 0)), 0)::bigint::int
                                                          AS "valueCents"
        FROM inventory_movements m
        JOIN inventory_warehouses w ON w.id = m.warehouse_id
        LEFT JOIN inventory_levels l
               ON l.variant_id = m.variant_id AND l.warehouse_id = m.warehouse_id
       WHERE m.tenant_id = ${ctx.tenantId}::uuid
         AND m.created_at >= ${from}
         AND m.created_at <= ${to}
         AND m.delta < 0
         AND m.reason = ANY(${[...SHRINK_REASONS]}::text[])
         AND (${wh}::uuid IS NULL OR m.warehouse_id = ${wh}::uuid)
       GROUP BY m.warehouse_id, w.name, w.code
       ORDER BY 5 DESC
    `;

    const topVariants = await tx.$queryRaw<VariantRow[]>`
      SELECT m.variant_id                                 AS "variantId",
             v.sku                                        AS "variantSku",
             COALESCE(p.title, v.title)                   AS "productTitle",
             SUM(ABS(m.delta))::int                       AS "units",
             COALESCE(SUM(ABS(m.delta) * COALESCE(
               m.unit_cost_cents, l.avg_cost_cents, l.unit_cost_cents, 0)), 0)::bigint::int
                                                          AS "valueCents",
             COUNT(*)::int                                AS "movements"
        FROM inventory_movements m
        JOIN commerce_product_variants v ON v.id = m.variant_id
        LEFT JOIN commerce_products p ON p.id = v.product_id
        LEFT JOIN inventory_levels l
               ON l.variant_id = m.variant_id AND l.warehouse_id = m.warehouse_id
       WHERE m.tenant_id = ${ctx.tenantId}::uuid
         AND m.created_at >= ${from}
         AND m.created_at <= ${to}
         AND m.delta < 0
         AND m.reason = ANY(${[...SHRINK_REASONS]}::text[])
         AND (${wh}::uuid IS NULL OR m.warehouse_id = ${wh}::uuid)
       GROUP BY m.variant_id, v.sku, p.title, v.title
       ORDER BY 5 DESC
       LIMIT 20
    `;

    const byPeriod = await tx.$queryRaw<PeriodRow[]>`
      SELECT date_trunc('month', m.created_at)            AS "period",
             SUM(ABS(m.delta))::int                       AS "units",
             COALESCE(SUM(ABS(m.delta) * COALESCE(
               m.unit_cost_cents, l.avg_cost_cents, l.unit_cost_cents, 0)), 0)::bigint::int
                                                          AS "valueCents"
        FROM inventory_movements m
        LEFT JOIN inventory_levels l
               ON l.variant_id = m.variant_id AND l.warehouse_id = m.warehouse_id
       WHERE m.tenant_id = ${ctx.tenantId}::uuid
         AND m.created_at >= ${from}
         AND m.created_at <= ${to}
         AND m.delta < 0
         AND m.reason = ANY(${[...SHRINK_REASONS]}::text[])
         AND (${wh}::uuid IS NULL OR m.warehouse_id = ${wh}::uuid)
       GROUP BY 1
       ORDER BY 1 ASC
    `;

    // Positive count corrections — the same measurement error pointing the other
    // way. Reported alongside rather than netted off: a business that finds as
    // much as it loses has a counting problem, not a theft problem, and netting
    // to zero would say it has neither.
    const gains = await tx.$queryRaw<GainRow[]>`
      SELECT COALESCE(SUM(m.delta), 0)::int               AS "units",
             COALESCE(SUM(m.delta * COALESCE(
               m.unit_cost_cents, l.avg_cost_cents, l.unit_cost_cents, 0)), 0)::bigint::int
                                                          AS "valueCents"
        FROM inventory_movements m
        LEFT JOIN inventory_levels l
               ON l.variant_id = m.variant_id AND l.warehouse_id = m.warehouse_id
       WHERE m.tenant_id = ${ctx.tenantId}::uuid
         AND m.created_at >= ${from}
         AND m.created_at <= ${to}
         AND m.delta > 0
         AND m.reason = 'recount'
         AND (${wh}::uuid IS NULL OR m.warehouse_id = ${wh}::uuid)
    `;

    const valuation = await tx.$queryRaw<ValuationRow[]>`
      SELECT COALESCE(SUM(l.on_hand * COALESCE(
               l.avg_cost_cents, l.unit_cost_cents, 0)), 0)::bigint::int AS "valueCents"
        FROM inventory_levels l
       WHERE l.tenant_id = ${ctx.tenantId}::uuid
         AND l.on_hand > 0
         AND (${wh}::uuid IS NULL OR l.warehouse_id = ${wh}::uuid)
    `;

    const totalUnits = byReason.reduce((s, r) => s + r.units, 0);
    const totalValueCents = byReason.reduce((s, r) => s + r.valueCents, 0);
    const currentValuationCents = valuation[0]?.valueCents ?? 0;

    return {
      from: from.toISOString(),
      to: to.toISOString(),
      totalUnits,
      totalValueCents,
      recountGainUnits: gains[0]?.units ?? 0,
      recountGainValueCents: gains[0]?.valueCents ?? 0,
      percentOfValuation:
        currentValuationCents > 0
          ? Math.round((totalValueCents / currentValuationCents) * 1000) / 10
          : null,
      currentValuationCents,
      byReason,
      byWarehouse,
      topVariants,
      byPeriod: byPeriod.map((p) => ({
        period: p.period.toISOString().slice(0, 10),
        units: p.units,
        valueCents: p.valueCents,
      })),
    };
  });
}
