// What the planning numbers MEAN in money (docs/146 Phase 7.6, 7.7, 7.10, 7.11).
//
// Three reads, all computed LIVE against the stored measurements:
//
//   • Stockout risk — days of cover, projected stockout date, and what running
//     out would cost. The reorder worklist's ordering.
//   • Overstock and dead stock — too much of something that sells, and any of
//     something that does not, each with the capital tied up and what to do.
//   • Holding cost — what keeping all of it costs for a year.
//
// ── Why nothing here is materialised ─────────────────────────────────────────
//
// The RATE is measured nightly because it barely moves. The QUANTITY moves every
// time somebody sells something. Days of cover is one divided by the other, so
// storing it would produce a screen confidently reporting eleven days of cover
// on a shelf that emptied at lunchtime — which is precisely the "the numbers are
// wrong" complaint this whole plan exists to answer. Every figure below divides
// the stored rate into the live quantity at read time.
//
// ── Revenue at risk is the ordering, and that is the point ───────────────────
//
// A reorder list sorted by "least stock left" ranks by how empty a shelf looks.
// A buyer with forty rows and an hour does not need the emptiest shelf; they
// need the one whose emptiness costs the most. Sorting by the money that has
// nowhere to come from before a replacement could land puts a fast £40 line
// above a dormant £2 one that happens to be down to its last unit.

import { holdingCostCents, stockoutRisk } from '@wizeworks/commerce-schemas';
import { withTenant } from '@wizeworks/db';

import type { ServiceContext } from '../errors';

import { DEFAULT_LEAD_TIME_DAYS } from './lead-times';
import { loadPlanningPolicy } from './planning-policy';

const DAY_MS = 86_400_000;

// ─── Stockout risk ───────────────────────────────────────────────────────────

export interface StockoutRiskRow {
  variantId: string;
  warehouseId: string;
  sku: string | null;
  title: string | null;
  warehouseCode: string | null;
  warehouseName: string | null;
  onHand: number;
  available: number;
  onOrder: number;
  /** The trigger in force today. */
  reorderPoint: number | null;
  /** What the maths would set it to. */
  dynamicReorderPoint: number | null;
  /** Units per day, from the last measurement. Null = never measured. */
  velocityPerDay: number | null;
  /** Which trailing window that rate came from. */
  forecastBasis: string | null;
  daysOfCover: number | null;
  daysOfCoverWithInbound: number | null;
  projectedStockoutAt: string | null;
  leadTimeDays: number;
  leadTimeSource: string;
  unitsAtRisk: number;
  revenueAtRiskCents: number;
  abcClass: string | null;
  xyzClass: string | null;
  supplierId: string | null;
  supplierName: string | null;
  suggestedQuantity: number;
  /** The whole calculation in one sentence — 7.12's provenance, inline. */
  reasoning: string;
  /** How old the measurement behind this row is. */
  measuredAt: string | null;
}

export interface StockoutRiskReport {
  rows: StockoutRiskRow[];
  totalRevenueAtRiskCents: number;
  /** Levels with no measurement yet — reported rather than silently omitted, so
   *  "nothing at risk" cannot mean "nothing has been measured". */
  unmeasuredLevels: number;
  lastSweepAt: string | null;
}

export interface StockoutRiskFilter {
  warehouseId?: string;
  /** Only rows with a real risk figure. On by default — the report is a
   *  worklist, and a thousand zero rows is not one. */
  atRiskOnly?: boolean;
  take?: number;
}

interface RiskSqlRow {
  variantId: string;
  warehouseId: string;
  sku: string | null;
  title: string | null;
  warehouseCode: string | null;
  warehouseName: string | null;
  onHand: number;
  allocated: number;
  onOrder: number;
  reorderPoint: number | null;
  dynamicReorderPoint: number | null;
  forecastPerDay: number | null;
  forecastBasis: string | null;
  computedAt: Date | null;
  leadTimeDays: number | null;
  leadTimeSource: string | null;
  computedOrderQuantity: number | null;
  abcClass: string | null;
  xyzClass: string | null;
  supplierId: string | null;
  supplierName: string | null;
  minOrderQty: number | null;
  priceCents: number | null;
}

/**
 * Every level, with the cost of running out of it.
 *
 * Includes levels that are NOT low: a fast mover two days above its reorder
 * point with a three-week lead time is already in trouble, and a report that
 * only shows what has crossed a line cannot say so. That is exactly the failure
 * mode of a static reorder point, so a planning report that reproduced it would
 * be pointless.
 */
export async function stockoutRiskReport(
  ctx: ServiceContext,
  filter: StockoutRiskFilter = {}
): Promise<StockoutRiskReport> {
  const take = Math.min(filter.take ?? 100, 500);
  const warehouse = filter.warehouseId ?? null;
  const atRiskOnly = filter.atRiskOnly ?? true;

  const { rows, lastSweepAt } = await withTenant(ctx, async (tx) => {
    const policy = await loadPlanningPolicy(tx, ctx.tenantId);
    const sql = await tx.$queryRaw<RiskSqlRow[]>`
      SELECT
        l.variant_id                          AS "variantId",
        l.warehouse_id                        AS "warehouseId",
        v.sku                                 AS "sku",
        COALESCE(p.title, v.title)            AS "title",
        w.code                                AS "warehouseCode",
        w.name                                AS "warehouseName",
        l.on_hand                             AS "onHand",
        l.allocated                           AS "allocated",
        COALESCE((
          SELECT SUM(pol.quantity_ordered - pol.quantity_received)
          FROM inventory_purchase_order_lines pol
          JOIN inventory_purchase_orders po ON po.id = pol.purchase_order_id
          WHERE pol.variant_id = l.variant_id
            AND po.warehouse_id = l.warehouse_id
            AND po.status IN ('draft','submitted','partial')
        ), 0)::int                            AS "onOrder",
        l.reorder_point                       AS "reorderPoint",
        l.dynamic_reorder_point               AS "dynamicReorderPoint",
        dv.forecast_per_day::float8           AS "forecastPerDay",
        dv.forecast_basis                     AS "forecastBasis",
        dv.computed_at                        AS "computedAt",
        rp.lead_time_days_used::float8        AS "leadTimeDays",
        rp.lead_time_source                   AS "leadTimeSource",
        rp.computed_order_quantity            AS "computedOrderQuantity",
        l.abc_class                           AS "abcClass",
        l.xyz_class                           AS "xyzClass",
        sup.supplier_id                       AS "supplierId",
        sup.supplier_name                     AS "supplierName",
        sup.min_order_qty                     AS "minOrderQty",
        v.price_cents                         AS "priceCents"
      FROM inventory_levels l
      JOIN commerce_product_variants v ON v.id = l.variant_id AND v.deleted_at IS NULL
      JOIN commerce_products p ON p.id = v.product_id
      JOIN inventory_warehouses w ON w.id = l.warehouse_id AND w.deleted_at IS NULL
      LEFT JOIN inventory_demand_velocity dv
        ON dv.variant_id = l.variant_id AND dv.warehouse_id = l.warehouse_id
      LEFT JOIN inventory_reorder_policies rp
        ON rp.variant_id = l.variant_id AND rp.warehouse_id = l.warehouse_id
      LEFT JOIN LATERAL (
        SELECT s.id AS supplier_id, s.name AS supplier_name, sv.min_order_qty
        FROM inventory_supplier_variants sv
        JOIN inventory_suppliers s ON s.id = sv.supplier_id
        WHERE sv.tenant_id = l.tenant_id AND sv.variant_id = l.variant_id
          AND s.deleted_at IS NULL AND s.is_active = true
        ORDER BY sv.is_preferred DESC, sv.unit_cost_cents ASC NULLS LAST
        LIMIT 1
      ) sup ON true
      WHERE l.tenant_id = ${ctx.tenantId}::uuid
        AND (${warehouse}::uuid IS NULL OR l.warehouse_id = ${warehouse}::uuid)
    `;
    return { rows: sql, lastSweepAt: policy.lastSweepAt };
  });

  const now = new Date();
  const unmeasuredLevels = rows.filter((r) => r.forecastPerDay === null).length;

  const assessed = rows.map((r) => toRiskRow(r, now));
  const filtered = atRiskOnly ? assessed.filter((r) => r.revenueAtRiskCents > 0) : assessed;
  filtered.sort((a, b) => b.revenueAtRiskCents - a.revenueAtRiskCents || coverOf(a) - coverOf(b));

  return {
    rows: filtered.slice(0, take),
    totalRevenueAtRiskCents: filtered.reduce((sum, r) => sum + r.revenueAtRiskCents, 0),
    unmeasuredLevels,
    lastSweepAt,
  };
}

function coverOf(row: StockoutRiskRow): number {
  return row.daysOfCoverWithInbound ?? Number.MAX_SAFE_INTEGER;
}

function toRiskRow(r: RiskSqlRow, now: Date): StockoutRiskRow {
  const available = r.onHand - r.allocated;
  const velocity = r.forecastPerDay;
  const leadTimeDays = r.leadTimeDays ?? DEFAULT_LEAD_TIME_DAYS;

  const risk = stockoutRisk({
    available,
    onOrder: r.onOrder,
    demandPerDay: velocity ?? 0,
    leadTimeDays,
    unitPriceCents: r.priceCents ?? 0,
  });

  const projected =
    risk.daysOfCover === null
      ? null
      : new Date(now.getTime() + risk.daysOfCover * DAY_MS).toISOString();

  return {
    variantId: r.variantId,
    warehouseId: r.warehouseId,
    sku: r.sku,
    title: r.title,
    warehouseCode: r.warehouseCode,
    warehouseName: r.warehouseName,
    onHand: r.onHand,
    available,
    onOrder: r.onOrder,
    reorderPoint: r.reorderPoint,
    dynamicReorderPoint: r.dynamicReorderPoint,
    velocityPerDay: velocity,
    forecastBasis: r.forecastBasis,
    daysOfCover: round1(risk.daysOfCover),
    daysOfCoverWithInbound: round1(risk.daysOfCoverWithInbound),
    projectedStockoutAt: projected,
    leadTimeDays: round1(leadTimeDays) ?? leadTimeDays,
    leadTimeSource: r.leadTimeSource ?? 'default',
    unitsAtRisk: risk.unitsAtRisk,
    revenueAtRiskCents: risk.revenueAtRiskCents,
    abcClass: r.abcClass,
    xyzClass: r.xyzClass,
    supplierId: r.supplierId,
    supplierName: r.supplierName,
    suggestedQuantity: Math.max(r.computedOrderQuantity ?? 0, r.minOrderQty ?? 0),
    reasoning: explainRisk({
      available,
      onOrder: r.onOrder,
      velocity,
      leadTimeDays,
      leadTimeSource: r.leadTimeSource ?? 'default',
      cover: risk.daysOfCoverWithInbound,
      unitsAtRisk: risk.unitsAtRisk,
    }),
    measuredAt: r.computedAt?.toISOString() ?? null,
  };
}

/**
 * The whole calculation, in one sentence, in shop words.
 *
 * This is 7.12 applied where it matters most. A buyer looking at "£1,240 at
 * risk" should not have to open anything to find out why — the sentence names
 * the rate, where the lead time came from, what cover that leaves, and what
 * falls out of it. A number nobody can check is a number people override.
 */
function explainRisk(input: {
  available: number;
  onOrder: number;
  velocity: number | null;
  leadTimeDays: number;
  leadTimeSource: string;
  cover: number | null;
  unitsAtRisk: number;
}): string {
  if (input.velocity === null) {
    return 'How fast this sells has not been measured yet, so there is no run-out date for it.';
  }
  if (input.velocity <= 0) {
    return 'Nothing has sold in the last 90 days, so there is no deadline on this one.';
  }

  const rate =
    input.velocity >= 1
      ? `about ${Math.round(input.velocity)} a day`
      : `about one every ${Math.max(2, Math.round(1 / input.velocity))} days`;
  const inbound = input.onOrder > 0 ? ` plus ${input.onOrder} already on the way` : '';
  const lead = leadTimePhrase(input.leadTimeDays, input.leadTimeSource);
  const cover = input.cover === null ? 'no measurable cover' : `${Math.round(input.cover)} days`;

  if (input.unitsAtRisk <= 0) {
    return `Selling ${rate}. ${input.available} left${inbound} is ${cover} of cover, and ${lead} — so a replacement lands before it runs out.`;
  }
  return `Selling ${rate}. ${input.available} left${inbound} is only ${cover} of cover, and ${lead} — so about ${input.unitsAtRisk} orders would have nothing to come from.`;
}

function leadTimePhrase(days: number, source: string): string {
  const rounded = Math.round(days);
  switch (source) {
    case 'measured':
      return `this supplier has averaged ${rounded} days on their last deliveries`;
    case 'supplier':
      return `the supplier says ${rounded} days`;
    case 'level':
      return `you have it down as ${rounded} days`;
    default:
      return `nothing is known about the lead time, so ${rounded} days is assumed`;
  }
}

// ─── Overstock, dead stock, and the capital in them ──────────────────────────

export type SlowMoverKind = 'dead' | 'overstock' | 'slow';

export interface SlowMoverRow {
  variantId: string;
  warehouseId: string;
  sku: string | null;
  title: string | null;
  warehouseCode: string | null;
  warehouseName: string | null;
  kind: SlowMoverKind;
  onHand: number;
  /** False when no cost price has ever been recorded, which makes every money
   *  figure on this row a zero by absence rather than by measurement. */
  costKnown: boolean;
  /** Units beyond what the horizon's demand can absorb. Equal to `onHand` for
   *  dead stock, because none of it is absorbed. */
  excessUnits: number;
  unitCostCents: number;
  /** What the whole holding is worth. */
  valueCents: number;
  /** What the EXCESS is worth — the capital actually trapped. */
  excessValueCents: number;
  /** What holding the excess costs for a year at the tenant's carrying rate. */
  annualHoldingCostCents: number;
  velocityPerDay: number | null;
  daysOfCover: number | null;
  lastSaleAt: string | null;
  daysSinceLastSale: number | null;
  abcClass: string | null;
  /** What to do about it, said plainly. */
  suggestedAction: string;
}

export interface SlowMoverReport {
  overstockCoverDays: number;
  deadStockDays: number;
  holdingCostRatePct: number;
  rows: SlowMoverRow[];
  totals: {
    items: number;
    excessValueCents: number;
    annualHoldingCostCents: number;
    deadItems: number;
    deadValueCents: number;
    /**
     * How many rows carry no cost price. Their cash figures are necessarily
     * zero, so the money totals UNDERSTATE by however much those items cost —
     * and a total that quietly understates without saying so is worse than one
     * that admits its gap.
     */
    itemsWithoutCost: number;
  };
}

interface SlowMoverSqlRow {
  variantId: string;
  warehouseId: string;
  sku: string | null;
  title: string | null;
  warehouseCode: string | null;
  warehouseName: string | null;
  onHand: number;
  unitCostCents: number;
  /** Whether a cost was found at all, as opposed to one that is genuinely zero. */
  costKnown: boolean;
  forecastPerDay: number | null;
  lastSaleAt: Date | null;
  abcClass: string | null;
}

/**
 * Stock that is not paying its rent, in three flavours that need different
 * answers.
 *
 *   dead      — nothing sold in the dead-stock window. ALL of it is excess; the
 *               question is disposal, not ordering less.
 *   overstock — it sells, but there is more cover than the horizon. The excess
 *               is what is beyond the horizon; the answer is to stop buying it
 *               for a while.
 *   slow      — it sells and the cover is inside the horizon, but the last sale
 *               is old enough to be worth an eye. Reported, not alarmed about.
 *
 * Collapsing these into one "slow-moving stock" list is what makes such a report
 * useless: the same row means "sell this at a discount" and "skip the next
 * order", and those are not the same instruction.
 */
export async function slowMoverReport(
  ctx: ServiceContext,
  filter: { warehouseId?: string; take?: number } = {}
): Promise<SlowMoverReport> {
  const take = Math.min(filter.take ?? 100, 500);
  const warehouse = filter.warehouseId ?? null;

  return withTenant(ctx, async (tx) => {
    const policy = await loadPlanningPolicy(tx, ctx.tenantId);

    const rows = await tx.$queryRaw<SlowMoverSqlRow[]>`
      SELECT
        l.variant_id                                                       AS "variantId",
        l.warehouse_id                                                     AS "warehouseId",
        v.sku                                                              AS "sku",
        COALESCE(p.title, v.title)                                         AS "title",
        w.code                                                             AS "warehouseCode",
        w.name                                                             AS "warehouseName",
        l.on_hand                                                          AS "onHand",
        COALESCE(l.avg_cost_cents, l.unit_cost_cents, v.cost_cents, 0)::int AS "unitCostCents",
        -- The COALESCE above has to produce a number for the arithmetic, which
        -- makes an unrecorded cost indistinguishable from a real zero. This says
        -- which it was, so a row with no cost price can show "—" and a reason
        -- rather than a confident $0.00 against a hundred units on a shelf.
        (COALESCE(l.avg_cost_cents, l.unit_cost_cents, v.cost_cents) IS NOT NULL)
                                                                           AS "costKnown",
        dv.forecast_per_day::float8                                        AS "forecastPerDay",
        dv.last_sale_at                                                    AS "lastSaleAt",
        l.abc_class                                                        AS "abcClass"
      FROM inventory_levels l
      JOIN commerce_product_variants v ON v.id = l.variant_id AND v.deleted_at IS NULL
      JOIN commerce_products p ON p.id = v.product_id
      JOIN inventory_warehouses w ON w.id = l.warehouse_id AND w.deleted_at IS NULL
      LEFT JOIN inventory_demand_velocity dv
        ON dv.variant_id = l.variant_id AND dv.warehouse_id = l.warehouse_id
      WHERE l.tenant_id = ${ctx.tenantId}::uuid
        AND l.on_hand > 0
        AND (${warehouse}::uuid IS NULL OR l.warehouse_id = ${warehouse}::uuid)
    `;

    const assessed: SlowMoverRow[] = [];
    for (const r of rows) {
      const classified = classifySlowMover(r, policy.overstockCoverDays, policy.deadStockDays);
      if (classified) assessed.push(classified);
    }
    assessed.sort((a, b) => b.excessValueCents - a.excessValueCents);

    return {
      overstockCoverDays: policy.overstockCoverDays,
      deadStockDays: policy.deadStockDays,
      holdingCostRatePct: policy.holdingCostRatePct,
      rows: assessed.slice(0, take).map((r) => ({
        ...r,
        annualHoldingCostCents: holdingCostCents(r.excessValueCents, policy.holdingCostRatePct),
      })),
      totals: {
        items: assessed.length,
        excessValueCents: assessed.reduce((s, r) => s + r.excessValueCents, 0),
        annualHoldingCostCents: holdingCostCents(
          assessed.reduce((s, r) => s + r.excessValueCents, 0),
          policy.holdingCostRatePct
        ),
        deadItems: assessed.filter((r) => r.kind === 'dead').length,
        deadValueCents: assessed
          .filter((r) => r.kind === 'dead')
          .reduce((s, r) => s + r.excessValueCents, 0),
        itemsWithoutCost: assessed.filter((r) => !r.costKnown).length,
      },
    };
  });
}

function classifySlowMover(
  r: SlowMoverSqlRow,
  overstockCoverDays: number,
  deadStockDays: number
): SlowMoverRow | null {
  const valueCents = r.onHand * r.unitCostCents;
  const velocity = r.forecastPerDay;
  const daysSinceLastSale = r.lastSaleAt
    ? Math.floor((Date.now() - r.lastSaleAt.getTime()) / DAY_MS)
    : null;
  const cover = velocity && velocity > 0 ? r.onHand / velocity : null;

  const isDead =
    (velocity === null || velocity <= 0) &&
    (daysSinceLastSale === null || daysSinceLastSale >= deadStockDays);

  if (isDead) {
    return {
      ...base(r, valueCents),
      kind: 'dead',
      excessUnits: r.onHand,
      excessValueCents: valueCents,
      annualHoldingCostCents: 0,
      velocityPerDay: velocity,
      daysOfCover: null,
      daysSinceLastSale,
      suggestedAction:
        daysSinceLastSale === null
          ? 'Nothing has ever sold from this. Discount it, bundle it, return it to the supplier, or write it off — it is not going to move on its own.'
          : `Nothing has sold in ${daysSinceLastSale} days. Discount it, bundle it, return it to the supplier, or write it off.`,
    };
  }

  if (cover !== null && cover > overstockCoverDays) {
    const excessUnits = Math.max(0, Math.round(r.onHand - (velocity ?? 0) * overstockCoverDays));
    return {
      ...base(r, valueCents),
      kind: 'overstock',
      excessUnits,
      excessValueCents: excessUnits * r.unitCostCents,
      annualHoldingCostCents: 0,
      velocityPerDay: velocity,
      daysOfCover: round1(cover),
      daysSinceLastSale,
      suggestedAction: `At the current rate this is ${Math.round(cover)} days of stock. Skip the next order and let it run down — there is no need to buy any for about ${Math.round(cover - overstockCoverDays)} days.`,
    };
  }

  if (daysSinceLastSale !== null && daysSinceLastSale >= Math.round(deadStockDays / 2)) {
    return {
      ...base(r, valueCents),
      kind: 'slow',
      excessUnits: 0,
      excessValueCents: 0,
      annualHoldingCostCents: 0,
      velocityPerDay: velocity,
      daysOfCover: round1(cover),
      daysSinceLastSale,
      suggestedAction: `Last sold ${daysSinceLastSale} days ago. Still moving, but worth watching before it becomes dead stock.`,
    };
  }

  return null;
}

function base(
  r: SlowMoverSqlRow,
  valueCents: number
): Pick<
  SlowMoverRow,
  | 'variantId'
  | 'warehouseId'
  | 'sku'
  | 'title'
  | 'warehouseCode'
  | 'warehouseName'
  | 'onHand'
  | 'unitCostCents'
  | 'costKnown'
  | 'valueCents'
  | 'lastSaleAt'
  | 'abcClass'
> {
  return {
    variantId: r.variantId,
    warehouseId: r.warehouseId,
    sku: r.sku,
    title: r.title,
    warehouseCode: r.warehouseCode,
    warehouseName: r.warehouseName,
    onHand: r.onHand,
    unitCostCents: r.unitCostCents,
    costKnown: r.costKnown,
    valueCents,
    lastSaleAt: r.lastSaleAt?.toISOString() ?? null,
    abcClass: r.abcClass,
  };
}

// ─── Holding cost ────────────────────────────────────────────────────────────

/** The scale's own order. Anything unrecognised sorts last, which is where
 *  `unclassified` belongs. */
const ABC_ORDER = ['A', 'B', 'C', 'unclassified'];

export interface HoldingCostReport {
  annualRatePct: number;
  /** True when the tenant has never set a rate, so the surface can say the
   *  figure rests on the category's rule of thumb rather than their number. */
  usingDefaultRate: boolean;
  totalValueCents: number;
  annualHoldingCostCents: number;
  monthlyHoldingCostCents: number;
  byClass: { abcClass: string; valueCents: number; annualHoldingCostCents: number }[];
  /** The most expensive things to keep, which is not the same list as the most
   *  valuable things to own — a slow item ties its money up for longer. */
  topItems: {
    variantId: string;
    warehouseId: string;
    sku: string | null;
    title: string | null;
    /** Named so a variant stocked in two places reads as two DISTINGUISHABLE rows. */
    warehouseName: string | null;
    onHand: number;
    valueCents: number;
    /** False = no cost price recorded, so the money on this row is zero by
     *  absence. The row says so instead of printing a confident $0.00. */
    costKnown: boolean;
    annualHoldingCostCents: number;
    daysOfCover: number | null;
  }[];
  /** How many levels carry no cost price at all — the amount by which every
   *  money figure in this report understates. Reported rather than buried. */
  itemsWithoutCost: number;
}

/**
 * What keeping the stock costs.
 *
 * 54% of operators report holding costs above 10% of inventory value, and almost
 * none of them can put a figure on it — because their system reports what stock
 * is WORTH and never what it COSTS. The gap between those two numbers is the
 * argument for every other feature in this phase.
 */
export async function holdingCostReport(
  ctx: ServiceContext,
  filter: { warehouseId?: string; take?: number } = {}
): Promise<HoldingCostReport> {
  const take = Math.min(filter.take ?? 25, 200);
  const warehouse = filter.warehouseId ?? null;

  return withTenant(ctx, async (tx) => {
    const policy = await loadPlanningPolicy(tx, ctx.tenantId);

    const rows = await tx.$queryRaw<
      {
        variantId: string;
        warehouseId: string;
        sku: string | null;
        title: string | null;
        warehouseName: string | null;
        onHand: number;
        valueCents: number;
        costKnown: boolean;
        abcClass: string | null;
        forecastPerDay: number | null;
      }[]
    >`
      SELECT
        l.variant_id                                                        AS "variantId",
        l.warehouse_id                                                      AS "warehouseId",
        v.sku                                                               AS "sku",
        COALESCE(p.title, v.title)                                          AS "title",
        w.name                                                              AS "warehouseName",
        l.on_hand                                                           AS "onHand",
        (l.on_hand * COALESCE(l.avg_cost_cents, l.unit_cost_cents, v.cost_cents, 0))::float8
                                                                            AS "valueCents",
        -- Same distinction the slow-mover report makes: a shelf of a hundred
        -- notebooks nobody costed is not a shelf worth nothing.
        (COALESCE(l.avg_cost_cents, l.unit_cost_cents, v.cost_cents) IS NOT NULL)
                                                                            AS "costKnown",
        l.abc_class                                                         AS "abcClass",
        dv.forecast_per_day::float8                                         AS "forecastPerDay"
      FROM inventory_levels l
      JOIN commerce_product_variants v ON v.id = l.variant_id AND v.deleted_at IS NULL
      JOIN commerce_products p ON p.id = v.product_id
      JOIN inventory_warehouses w ON w.id = l.warehouse_id AND w.deleted_at IS NULL
      LEFT JOIN inventory_demand_velocity dv
        ON dv.variant_id = l.variant_id AND dv.warehouse_id = l.warehouse_id
      WHERE l.tenant_id = ${ctx.tenantId}::uuid
        AND l.on_hand > 0
        AND (${warehouse}::uuid IS NULL OR l.warehouse_id = ${warehouse}::uuid)
    `;

    const rate = policy.holdingCostRatePct;
    const totalValueCents = Math.round(rows.reduce((s, r) => s + r.valueCents, 0));

    const classTotals = new Map<string, number>();
    for (const r of rows) {
      const key = r.abcClass ?? 'unclassified';
      classTotals.set(key, (classTotals.get(key) ?? 0) + r.valueCents);
    }

    const topItems = [...rows]
      .sort((a, b) => b.valueCents - a.valueCents)
      .slice(0, take)
      .map((r) => ({
        variantId: r.variantId,
        warehouseId: r.warehouseId,
        sku: r.sku,
        title: r.title,
        warehouseName: r.warehouseName,
        onHand: r.onHand,
        valueCents: Math.round(r.valueCents),
        costKnown: r.costKnown,
        annualHoldingCostCents: holdingCostCents(r.valueCents, rate),
        daysOfCover:
          r.forecastPerDay && r.forecastPerDay > 0 ? round1(r.onHand / r.forecastPerDay) : null,
      }));

    return {
      annualRatePct: rate,
      usingDefaultRate: !policy.configured,
      itemsWithoutCost: rows.filter((r) => !r.costKnown).length,
      totalValueCents,
      annualHoldingCostCents: holdingCostCents(totalValueCents, rate),
      monthlyHoldingCostCents: holdingCostCents(totalValueCents, rate, 30),
      // A, B, C, then the unclassified — the classes are an ORDERED scale, so
      // ranking them by size instead prints "Top value, Long tail, Mid value"
      // whenever the middle band happens to be the smallest, and the reader has
      // to stop and check they read it right.
      byClass: [...classTotals.entries()]
        .sort((a, b) => ABC_ORDER.indexOf(a[0]) - ABC_ORDER.indexOf(b[0]))
        .map(([abcClass, valueCents]) => ({
          abcClass,
          valueCents: Math.round(valueCents),
          annualHoldingCostCents: holdingCostCents(valueCents, rate),
        })),
      topItems,
    };
  });
}

function round1(n: number | null): number | null {
  if (n === null || !Number.isFinite(n)) return null;
  return Math.round(n * 10) / 10;
}
