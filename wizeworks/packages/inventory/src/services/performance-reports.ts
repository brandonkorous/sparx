// Inventory performance reports (docs/146 Phase 10.1).
//
// Five figures the platform holds every input for and could not previously
// state: sell-through, GMROI, fill rate, stock-out frequency, and where all the
// stock actually went. Each reads the master model + the movement ledger, so
// they reconcile exactly to operational stock — the same rule the rest of
// analytics.ts follows and the reason a merchant can put these next to the
// valuation without the two disagreeing.
//
// ── Every ratio here can refuse to answer ────────────────────────────────────
//
// The arithmetic lives in `@wizeworks/commerce-schemas/reporting`, pure and tested,
// and every one of its ratios returns `null` when its denominator is zero. That
// is not defensive coding, it is the point of the phase: a ratio hides its own
// inputs, and "fill rate 100%" reads identically whether four thousand lines
// shipped complete or nothing was ever recorded. So each report below carries
// the count of what it could NOT measure — `unmeasuredLines`, `uncostedUnits`,
// `unattributedUnits`, `unmeasuredMovements` — and the surfaces say so out loud.
//
// ── Why the SQL reconstructs history rather than reading a snapshot ──────────
//
// Units on hand "at the end of the period" is a sum over the ledger up to that
// instant (`SUM(delta) WHERE created_at < to`), the same reconstruction
// `valuationAsOf` uses. A snapshot table would be faster and would answer only
// for dates somebody thought to snapshot; every one of these reports is most
// wanted for a period that closed weeks ago.

import {
  fillRate,
  gmroi,
  sellThrough,
  stockoutEpisodes,
  summarizeMovements,
  availabilityPct,
  pct1,
  safeRatio,
  type FillRateResult,
  type GmroiResult,
  type MovementSummary,
  type SellThroughResult,
} from '@wizeworks/commerce-schemas';
import { withTenant } from '@wizeworks/db';
import type { TxClient } from '@wizeworks/db';

import type { ServiceContext } from '../errors';

const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_CURRENCY = 'USD';
const DEFAULT_TAKE = 100;
const MAX_TAKE = 1000;

export interface ReportWindow {
  from: Date;
  to: Date;
}

export interface PerformanceFilter {
  from?: Date;
  to?: Date;
  warehouseId?: string | null;
  take?: number;
}

/** The window a report ran over, plus the number of days in it — every report
 *  echoes this back so an exported CSV says what period it covers rather than
 *  arriving as a column of numbers with no date on them. */
function resolveWindow(filter: PerformanceFilter, defaultDays: number): ReportWindow {
  const to = filter.to ?? new Date();
  const from = filter.from ?? new Date(to.getTime() - defaultDays * DAY_MS);
  return { from, to };
}

function windowDays(range: ReportWindow): number {
  return Math.max(1, Math.round((range.to.getTime() - range.from.getTime()) / DAY_MS));
}

function isoRange(range: ReportWindow): { from: string; to: string } {
  return { from: range.from.toISOString(), to: range.to.toISOString() };
}

function clampTake(take: number | undefined): number {
  return Math.min(MAX_TAKE, Math.max(1, take ?? DEFAULT_TAKE));
}

/** The tenant's reporting currency. Every money figure in this file is in it,
 *  and every report echoes it back rather than leaving a screen to assume. */
async function baseCurrency(tx: TxClient): Promise<string> {
  const policy = await tx.costingPolicy.findFirst({ select: { baseCurrency: true } });
  return policy?.baseCurrency ?? DEFAULT_CURRENCY;
}

// ─── 10.1a Sell-through ──────────────────────────────────────────────────────

export interface SellThroughRow extends SellThroughResult {
  variantId: string;
  warehouseId: string;
  sku: string;
  title: string;
  warehouseCode: string;
}

export interface SellThroughReport {
  range: { from: string; to: string };
  periodDays: number;
  /** The whole tenant (or warehouse), not the page — a sell-through that only
   *  totals the rows that fitted on screen is not a sell-through. */
  totals: SellThroughResult;
  rows: SellThroughRow[];
  /** Lines that neither sold nor held stock in the window. Counted and excluded:
   *  a variant with nothing on either side of the fraction has no sell-through,
   *  and averaging it in as 0% would drag every reported figure down. */
  inactiveLines: number;
}

interface SellThroughSqlRow {
  variant_id: string;
  warehouse_id: string;
  sku: string;
  title: string;
  warehouse_code: string;
  units_sold: bigint;
  units_end: bigint;
}

/**
 * Sell-through by line, over a window.
 *
 * `units_end` is the ledger summed to the window's close, so the report answers
 * for a period that has already finished — the case it is nearly always wanted
 * for. Ordering is by units sold, because the question behind the report is
 * "which of the things that ARE moving am I under- or over-buying".
 */
export async function sellThroughReport(
  ctx: ServiceContext,
  filter: PerformanceFilter = {}
): Promise<SellThroughReport> {
  const range = resolveWindow(filter, 90);
  const warehouse = filter.warehouseId ?? null;
  const take = clampTake(filter.take);

  return withTenant(ctx, async (tx) => {
    const rows = await tx.$queryRaw<SellThroughSqlRow[]>`
      WITH sold AS (
        SELECT m.variant_id, m.warehouse_id, SUM(ABS(m.delta))::bigint AS units_sold
        FROM inventory_movements m
        WHERE m.tenant_id = ${ctx.tenantId}::uuid
          AND m.reason = 'sale'
          AND m.delta < 0
          AND m.created_at >= ${range.from} AND m.created_at < ${range.to}
          AND (${warehouse}::uuid IS NULL OR m.warehouse_id = ${warehouse}::uuid)
        GROUP BY m.variant_id, m.warehouse_id
      ), held AS (
        SELECT m.variant_id, m.warehouse_id, SUM(m.delta)::bigint AS units_end
        FROM inventory_movements m
        WHERE m.tenant_id = ${ctx.tenantId}::uuid
          AND m.created_at < ${range.to}
          AND (${warehouse}::uuid IS NULL OR m.warehouse_id = ${warehouse}::uuid)
        GROUP BY m.variant_id, m.warehouse_id
      ), pairs AS (
        SELECT variant_id, warehouse_id FROM sold
        UNION
        SELECT variant_id, warehouse_id FROM held
      )
      SELECT p.variant_id, p.warehouse_id,
             v.sku, COALESCE(v.title, pr.title) AS title,
             w.code AS warehouse_code,
             COALESCE(s.units_sold, 0)::bigint AS units_sold,
             COALESCE(h.units_end, 0)::bigint  AS units_end
      FROM pairs p
      JOIN commerce_product_variants v ON v.id = p.variant_id AND v.deleted_at IS NULL
      JOIN commerce_products pr ON pr.id = v.product_id
      JOIN inventory_warehouses w ON w.id = p.warehouse_id AND w.deleted_at IS NULL
      LEFT JOIN sold s ON s.variant_id = p.variant_id AND s.warehouse_id = p.warehouse_id
      LEFT JOIN held h ON h.variant_id = p.variant_id AND h.warehouse_id = p.warehouse_id
      ORDER BY COALESCE(s.units_sold, 0) DESC, v.sku ASC
    `;

    let unitsSold = 0;
    let unitsOnHandAtEnd = 0;
    let inactiveLines = 0;
    const detailed: SellThroughRow[] = [];

    for (const row of rows) {
      const sold = Number(row.units_sold);
      const end = Number(row.units_end);
      if (sold === 0 && end <= 0) {
        inactiveLines += 1;
        continue;
      }
      unitsSold += sold;
      unitsOnHandAtEnd += Math.max(0, end);
      detailed.push({
        variantId: row.variant_id,
        warehouseId: row.warehouse_id,
        sku: row.sku,
        title: row.title,
        warehouseCode: row.warehouse_code,
        ...sellThrough({ unitsSold: sold, unitsOnHandAtEnd: end }),
      });
    }

    return {
      range: isoRange(range),
      periodDays: windowDays(range),
      totals: sellThrough({ unitsSold, unitsOnHandAtEnd }),
      rows: detailed.slice(0, take),
      inactiveLines,
    };
  });
}

// ─── 10.1b GMROI ─────────────────────────────────────────────────────────────

export interface GmroiRow extends GmroiResult {
  variantId: string;
  sku: string;
  title: string;
  unitsSold: number;
  /** Units sold that no order line could be matched to, so their revenue is not
   *  in the figure beside them. Non-zero means the margin is a floor. */
  unattributedUnits: number;
}

export interface GmroiReport {
  range: { from: string; to: string };
  periodDays: number;
  currency: string;
  /** Tenant-wide, using the real daily valuation average where the rollup has
   *  samples — the same basis `turnoverReport` uses, so the two agree. */
  totals: GmroiResult;
  /** True when the average inventory value came from the daily rollup rather
   *  than from today's valuation standing in for it. A screen should say which,
   *  because a young tenant's GMROI is measured against a single day. */
  averageFromDailyRollup: boolean;
  rows: GmroiRow[];
  /** Sold units whose revenue could not be traced to an order line across the
   *  whole report. */
  unattributedUnits: number;
  /** Sold units with no cost stamped on the movement. Their COGS is missing,
   *  which makes the margin above an OVERSTATEMENT — said plainly rather than
   *  buried, because this is the one error in the report that flatters. */
  uncostedUnits: number;
}

interface GmroiSqlRow {
  variant_id: string;
  sku: string;
  title: string;
  units_sold: bigint;
  revenue_cents: bigint;
  cogs_cents: bigint;
  unattributed_units: bigint;
  uncosted_units: bigint;
  avg_inventory_cents: bigint;
}

/**
 * GMROI by line, plus a tenant headline.
 *
 * ── Revenue ──────────────────────────────────────────────────────────────────
 *
 * Traced to the goods that LEFT, not to orders placed: each sale movement is
 * matched to its order line (same order, same variant) and the line's net
 * revenue is pro-rated by the units the movement moved. Revenue excluding tax
 * and net of discounts — tax is not the business's money and a discount is not
 * revenue foregone by the warehouse.
 *
 * A movement with no matching line contributes units but no revenue, and is
 * counted in `unattributedUnits`. Marking those as zero-revenue would report a
 * negative margin on stock that sold perfectly well through a channel whose
 * order lines the platform never saw — and EXCLUDING them, which is the other
 * tempting option, would understate cost of sales and flatter the margin
 * instead. Counted, uncredited, and said out loud is the only honest handling.
 *
 * ── Average inventory at cost ────────────────────────────────────────────────
 *
 * Per line it is the mean of the value held at each end of the window
 * (opening + closing) / 2 — the standard retail approximation, and honest about
 * being one. The tenant total prefers the real daily average from
 * `rollup_inventory_daily_valuation`, which is a genuine mean over the period.
 */
export async function gmroiReport(
  ctx: ServiceContext,
  filter: PerformanceFilter = {}
): Promise<GmroiReport> {
  const range = resolveWindow(filter, 90);
  const warehouse = filter.warehouseId ?? null;
  const take = clampTake(filter.take);

  return withTenant(ctx, async (tx) => {
    const rows = await tx.$queryRaw<GmroiSqlRow[]>`
      WITH sales AS (
        SELECT m.variant_id,
               ABS(m.delta) AS units,
               m.cost_consumed_cents,
               oi.id AS order_item_id,
               CASE WHEN oi.id IS NULL OR oi.quantity = 0 THEN NULL
                    ELSE ROUND(
                      ((oi.line_subtotal - oi.discount_amount) / oi.quantity) * ABS(m.delta) * 100
                    )
               END AS revenue_cents
        FROM inventory_movements m
        -- Joined on the movement's order reference, and LEFT so a sale with no
        -- order still counts. A sale written by an integration, or booked by
        -- hand, moved real goods; dropping it would understate cost of sales
        -- and quietly flatter the margin. It lands in the unattributed count
        -- instead, which is the honest version of the same fact.
        LEFT JOIN order_items oi
          ON oi.tenant_id = m.tenant_id
         AND m.reference_type = 'Order'
         AND oi.order_id = m.reference_id
         AND oi.variant_id = m.variant_id
        WHERE m.tenant_id = ${ctx.tenantId}::uuid
          AND m.reason = 'sale'
          AND m.delta < 0
          AND m.created_at >= ${range.from} AND m.created_at < ${range.to}
          AND (${warehouse}::uuid IS NULL OR m.warehouse_id = ${warehouse}::uuid)
      ), agg AS (
        SELECT variant_id,
               SUM(units)::bigint AS units_sold,
               COALESCE(SUM(revenue_cents), 0)::bigint AS revenue_cents,
               COALESCE(SUM(cost_consumed_cents), 0)::bigint AS cogs_cents,
               COALESCE(SUM(units) FILTER (WHERE revenue_cents IS NULL), 0)::bigint
                 AS unattributed_units,
               COALESCE(SUM(units) FILTER (WHERE cost_consumed_cents IS NULL), 0)::bigint
                 AS uncosted_units
        FROM sales
        GROUP BY variant_id
      ), held AS (
        SELECT m.variant_id,
               SUM(m.delta) FILTER (WHERE m.created_at < ${range.from})::bigint AS units_open,
               SUM(m.delta) FILTER (WHERE m.created_at < ${range.to})::bigint   AS units_close
        FROM inventory_movements m
        WHERE m.tenant_id = ${ctx.tenantId}::uuid
          AND m.created_at < ${range.to}
          AND (${warehouse}::uuid IS NULL OR m.warehouse_id = ${warehouse}::uuid)
        GROUP BY m.variant_id
      ), basis AS (
        SELECT l.variant_id,
               MAX(COALESCE(l.avg_cost_cents, l.unit_cost_cents, v.cost_cents)) AS unit_cost_cents
        FROM inventory_levels l
        JOIN commerce_product_variants v ON v.id = l.variant_id
        WHERE l.tenant_id = ${ctx.tenantId}::uuid
          AND (${warehouse}::uuid IS NULL OR l.warehouse_id = ${warehouse}::uuid)
        GROUP BY l.variant_id
      )
      SELECT a.variant_id, v.sku, COALESCE(v.title, p.title) AS title,
             a.units_sold, a.revenue_cents, a.cogs_cents,
             a.unattributed_units, a.uncosted_units,
             COALESCE(
               ROUND(
                 (GREATEST(0, COALESCE(h.units_open, 0)) + GREATEST(0, COALESCE(h.units_close, 0)))
                 / 2.0 * COALESCE(b.unit_cost_cents, 0)
               ),
               0
             )::bigint AS avg_inventory_cents
      FROM agg a
      JOIN commerce_product_variants v ON v.id = a.variant_id AND v.deleted_at IS NULL
      JOIN commerce_products p ON p.id = v.product_id
      LEFT JOIN held h ON h.variant_id = a.variant_id
      LEFT JOIN basis b ON b.variant_id = a.variant_id
      ORDER BY (a.revenue_cents - a.cogs_cents) DESC, v.sku ASC
      LIMIT ${take}
    `;

    // The headline is computed over EVERY sale in the window, not the page.
    const [totals] = await tx.$queryRaw<
      {
        revenue_cents: bigint;
        cogs_cents: bigint;
        unattributed_units: bigint;
        uncosted_units: bigint;
      }[]
    >`
      SELECT
        COALESCE(SUM(
          CASE WHEN oi.id IS NULL OR oi.quantity = 0 THEN 0
               ELSE ROUND(((oi.line_subtotal - oi.discount_amount) / oi.quantity) * ABS(m.delta) * 100)
          END
        ), 0)::bigint AS revenue_cents,
        COALESCE(SUM(m.cost_consumed_cents), 0)::bigint AS cogs_cents,
        COALESCE(SUM(ABS(m.delta)) FILTER (WHERE oi.id IS NULL), 0)::bigint AS unattributed_units,
        COALESCE(SUM(ABS(m.delta)) FILTER (WHERE m.cost_consumed_cents IS NULL), 0)::bigint
          AS uncosted_units
      FROM inventory_movements m
      LEFT JOIN order_items oi
        ON oi.tenant_id = m.tenant_id
       AND m.reference_type = 'Order'
       AND oi.order_id = m.reference_id
       AND oi.variant_id = m.variant_id
      WHERE m.tenant_id = ${ctx.tenantId}::uuid
        AND m.reason = 'sale'
        AND m.delta < 0
        AND m.created_at >= ${range.from} AND m.created_at < ${range.to}
        AND (${warehouse}::uuid IS NULL OR m.warehouse_id = ${warehouse}::uuid)
    `;

    const [avg] = await tx.$queryRaw<{ avg_cost_cents: bigint; samples: bigint }[]>`
      SELECT COALESCE(AVG(total_cost_cents), 0)::bigint AS avg_cost_cents,
             COUNT(*)::bigint AS samples
      FROM rollup_inventory_daily_valuation
      WHERE tenant_id = ${ctx.tenantId}::uuid
        AND bucket >= ${range.from} AND bucket < ${range.to}
    `;

    const samples = Number(avg?.samples ?? 0);
    let avgInventoryCostCents = Number(avg?.avg_cost_cents ?? 0);
    if (samples === 0) {
      const [current] = await tx.$queryRaw<{ total: bigint }[]>`
        SELECT COALESCE(SUM(
          l.on_hand * COALESCE(l.avg_cost_cents, l.unit_cost_cents, v.cost_cents, 0)
        ) FILTER (WHERE l.ownership = 'owned'), 0)::bigint AS total
        FROM inventory_levels l
        JOIN commerce_product_variants v ON v.id = l.variant_id AND v.deleted_at IS NULL
        WHERE l.tenant_id = ${ctx.tenantId}::uuid
          AND (${warehouse}::uuid IS NULL OR l.warehouse_id = ${warehouse}::uuid)
      `;
      avgInventoryCostCents = Number(current?.total ?? 0);
    }

    return {
      range: isoRange(range),
      periodDays: windowDays(range),
      currency: await baseCurrency(tx),
      totals: gmroi({
        revenueCents: Number(totals?.revenue_cents ?? 0),
        cogsCents: Number(totals?.cogs_cents ?? 0),
        avgInventoryCostCents,
      }),
      averageFromDailyRollup: samples > 0,
      rows: rows.map((row) => ({
        variantId: row.variant_id,
        sku: row.sku,
        title: row.title,
        unitsSold: Number(row.units_sold),
        unattributedUnits: Number(row.unattributed_units),
        ...gmroi({
          revenueCents: Number(row.revenue_cents),
          cogsCents: Number(row.cogs_cents),
          avgInventoryCostCents: Number(row.avg_inventory_cents),
        }),
      })),
      unattributedUnits: Number(totals?.unattributed_units ?? 0),
      uncostedUnits: Number(totals?.uncosted_units ?? 0),
    };
  });
}

// ─── 10.1c Fill rate ─────────────────────────────────────────────────────────

export interface FillRateVariantRow {
  variantId: string;
  sku: string;
  title: string;
  linesMeasured: number;
  linesShort: number;
  unitsOrdered: number;
  unitsShort: number;
  lineFillRatePct: number | null;
}

export interface FillRateReport extends FillRateResult {
  range: { from: string; to: string };
  periodDays: number;
  /** The worst offenders — the lines a customer most often could not have. */
  worstVariants: FillRateVariantRow[];
}

interface FillRateSqlRow {
  variant_id: string | null;
  sku: string;
  title: string;
  units_ordered: number;
  units_short: number;
  measured: boolean;
}

/**
 * Fill rate over the orders placed in a window.
 *
 * ── How a line is judged, and why there are two ways ─────────────────────────
 *
 * A line is SHORT if a backorder was recorded against it (Phase 9's record of
 * exactly this), and short by that backorder's quantity. Where no backorder row
 * exists the ledger is asked instead: a sale movement for that order and variant
 * whose resulting balance went below zero shipped from stock that was not there,
 * and the shortfall is how far below zero it went.
 *
 * The second path exists because backorders only started being recorded in Phase
 * 9, and a fill-rate report that silently began at that date would have shown a
 * flawless history for every month before it. Where NEITHER is available — an
 * order line with no sale movement, or a movement written before the running
 * balance was recorded — the line is `measured: false` and drops out of the
 * calculation entirely, counted in `unmeasuredLines`.
 *
 * Cancelled orders are excluded: nobody failed to fill an order that was called
 * off, and counting them would let a cancellation improve or ruin the score
 * depending on which way it fell.
 */
export async function fillRateReport(
  ctx: ServiceContext,
  filter: PerformanceFilter = {}
): Promise<FillRateReport> {
  const range = resolveWindow(filter, 30);
  const warehouse = filter.warehouseId ?? null;
  const take = clampTake(filter.take);

  return withTenant(ctx, async (tx) => {
    const rows = await tx.$queryRaw<FillRateSqlRow[]>`
      WITH lines AS (
        SELECT oi.id, oi.order_id, oi.variant_id, oi.sku, oi.name, oi.quantity
        FROM order_items oi
        JOIN orders o ON o.id = oi.order_id AND o.tenant_id = oi.tenant_id
        WHERE oi.tenant_id = ${ctx.tenantId}::uuid
          AND o.placed_at >= ${range.from} AND o.placed_at < ${range.to}
          AND o.status <> 'cancelled'
      ), backordered AS (
        SELECT b.order_item_id, b.holder_id, b.variant_id,
               SUM(b.quantity)::int AS units_short
        FROM inventory_backorders b
        WHERE b.tenant_id = ${ctx.tenantId}::uuid
          AND b.holder_type = 'order'
          AND (${warehouse}::uuid IS NULL OR b.warehouse_id = ${warehouse}::uuid)
        GROUP BY b.order_item_id, b.holder_id, b.variant_id
      ), ledger AS (
        SELECT m.reference_id AS order_id, m.variant_id,
               SUM(GREATEST(0, -LEAST(0, m.balance_after)))::int AS units_short,
               bool_or(m.balance_after IS NOT NULL) AS measured
        FROM inventory_movements m
        WHERE m.tenant_id = ${ctx.tenantId}::uuid
          AND m.reason = 'sale'
          AND m.reference_type = 'Order'
          AND m.created_at >= ${range.from} AND m.created_at < ${range.to}
          AND (${warehouse}::uuid IS NULL OR m.warehouse_id = ${warehouse}::uuid)
        GROUP BY m.reference_id, m.variant_id
      )
      SELECT l.variant_id,
             l.sku,
             l.name AS title,
             l.quantity AS units_ordered,
             COALESCE(bi.units_short, bo.units_short, lg.units_short, 0)::int AS units_short,
             (bi.units_short IS NOT NULL OR bo.units_short IS NOT NULL
              OR COALESCE(lg.measured, false)) AS measured
      FROM lines l
      LEFT JOIN backordered bi ON bi.order_item_id = l.id
      LEFT JOIN backordered bo
        ON bo.order_item_id IS NULL AND bo.holder_id = l.order_id AND bo.variant_id = l.variant_id
      LEFT JOIN ledger lg ON lg.order_id = l.order_id AND lg.variant_id = l.variant_id
    `;

    const summary = fillRate(
      rows.map((r) => ({
        unitsOrdered: r.units_ordered,
        unitsShort: r.units_short,
        measured: r.measured,
      }))
    );

    // Roll the measured shortfalls up per variant so the screen can name the
    // items rather than only scoring the business.
    const byVariant = new Map<string, FillRateVariantRow>();
    for (const row of rows) {
      if (!row.measured || row.variant_id === null) continue;
      const existing = byVariant.get(row.variant_id) ?? {
        variantId: row.variant_id,
        sku: row.sku,
        title: row.title,
        linesMeasured: 0,
        linesShort: 0,
        unitsOrdered: 0,
        unitsShort: 0,
        lineFillRatePct: null,
      };
      const short = Math.min(row.units_ordered, Math.max(0, row.units_short));
      existing.linesMeasured += 1;
      if (short > 0) existing.linesShort += 1;
      existing.unitsOrdered += row.units_ordered;
      existing.unitsShort += short;
      byVariant.set(row.variant_id, existing);
    }

    const worstVariants = [...byVariant.values()]
      .map((row) => {
        const filled = safeRatio(row.linesMeasured - row.linesShort, row.linesMeasured);
        return { ...row, lineFillRatePct: filled === null ? null : pct1(filled) };
      })
      .filter((row) => row.linesShort > 0)
      .sort((a, b) => b.unitsShort - a.unitsShort || b.linesShort - a.linesShort)
      .slice(0, take);

    return {
      range: isoRange(range),
      periodDays: windowDays(range),
      ...summary,
      worstVariants,
    };
  });
}

// ─── 10.1d Stock-out frequency ───────────────────────────────────────────────

export interface StockoutFrequencyRow {
  variantId: string;
  warehouseId: string;
  sku: string;
  title: string;
  warehouseCode: string;
  episodeCount: number;
  daysOut: number;
  currentlyOut: boolean;
  /** Share of the window the line was in stock; null over a zero-length window. */
  availabilityPct: number | null;
  /** Movements skipped for having no recorded balance. Non-zero means the
   *  episodes for this line are a floor. */
  unmeasuredMovements: number;
}

export interface StockoutFrequencyReport {
  range: { from: string; to: string };
  periodDays: number;
  rows: StockoutFrequencyRow[];
  /** Lines that ran out at least once. */
  linesAffected: number;
  totalEpisodes: number;
  /** Lines the report could say nothing about because their movements carry no
   *  running balance. */
  unmeasuredLines: number;
}

interface StockoutSqlRow {
  variant_id: string;
  warehouse_id: string;
  sku: string;
  title: string;
  warehouse_code: string;
  at: Date;
  balance_after: number | null;
}

/**
 * How often each line ran out, and for how long.
 *
 * The ledger's running balance is walked in order; a run at or below zero is ONE
 * episode however many movements it spans, because a SKU that is out for a
 * fortnight has one problem and not fourteen. The walk is
 * `stockoutEpisodes` from commerce-schemas — the same function the tests pin,
 * rather than a second implementation living in SQL.
 *
 * Each (variant, location) is seeded with its balance immediately BEFORE the
 * window, so a line that was already out when the period opened is counted as
 * out from the first day rather than from whenever it next moved. Without the
 * seed, the worst cases — lines so out of stock that nothing happened to them —
 * would be the ones the report missed.
 */
export async function stockoutFrequencyReport(
  ctx: ServiceContext,
  filter: PerformanceFilter = {}
): Promise<StockoutFrequencyReport> {
  const range = resolveWindow(filter, 90);
  const warehouse = filter.warehouseId ?? null;
  const take = clampTake(filter.take);
  const days = windowDays(range);

  return withTenant(ctx, async (tx) => {
    const points = await tx.$queryRaw<StockoutSqlRow[]>`
      WITH inwin AS (
        SELECT m.variant_id, m.warehouse_id, m.created_at, m.balance_after
        FROM inventory_movements m
        WHERE m.tenant_id = ${ctx.tenantId}::uuid
          AND m.created_at >= ${range.from} AND m.created_at < ${range.to}
          AND (${warehouse}::uuid IS NULL OR m.warehouse_id = ${warehouse}::uuid)
      ), pairs AS (
        SELECT DISTINCT variant_id, warehouse_id FROM inwin
      ), seed AS (
        SELECT p.variant_id, p.warehouse_id, ${range.from}::timestamptz AS created_at,
               s.balance_after
        FROM pairs p
        CROSS JOIN LATERAL (
          SELECT m.balance_after
          FROM inventory_movements m
          WHERE m.tenant_id = ${ctx.tenantId}::uuid
            AND m.variant_id = p.variant_id
            AND m.warehouse_id = p.warehouse_id
            AND m.created_at < ${range.from}
            AND m.balance_after IS NOT NULL
          ORDER BY m.created_at DESC
          LIMIT 1
        ) s
      ), pts AS (
        SELECT * FROM seed
        UNION ALL
        SELECT variant_id, warehouse_id, created_at, balance_after FROM inwin
      )
      SELECT pts.variant_id, pts.warehouse_id, v.sku, COALESCE(v.title, pr.title) AS title,
             w.code AS warehouse_code, pts.created_at AS at, pts.balance_after
      FROM pts
      JOIN commerce_product_variants v ON v.id = pts.variant_id AND v.deleted_at IS NULL
      JOIN commerce_products pr ON pr.id = v.product_id
      JOIN inventory_warehouses w ON w.id = pts.warehouse_id AND w.deleted_at IS NULL
      ORDER BY pts.variant_id, pts.warehouse_id, pts.created_at
    `;

    interface Bucket {
      key: string;
      variantId: string;
      warehouseId: string;
      sku: string;
      title: string;
      warehouseCode: string;
      points: { at: Date; balanceAfter: number | null }[];
    }
    const buckets = new Map<string, Bucket>();
    for (const point of points) {
      const key = `${point.variant_id}:${point.warehouse_id}`;
      const bucket = buckets.get(key) ?? {
        key,
        variantId: point.variant_id,
        warehouseId: point.warehouse_id,
        sku: point.sku,
        title: point.title,
        warehouseCode: point.warehouse_code,
        points: [],
      };
      bucket.points.push({ at: point.at, balanceAfter: point.balance_after });
      buckets.set(key, bucket);
    }

    const rows: StockoutFrequencyRow[] = [];
    let unmeasuredLines = 0;
    for (const bucket of buckets.values()) {
      const result = stockoutEpisodes(bucket.points, range.to);
      // A line whose every movement lacks a balance told us nothing at all.
      // Counting it as "never out" is the exact failure this phase exists to
      // avoid, so it is reported as unmeasured and left out of the table.
      if (result.unmeasuredPoints === bucket.points.length) {
        unmeasuredLines += 1;
        continue;
      }
      if (result.episodeCount === 0) continue;
      rows.push({
        variantId: bucket.variantId,
        warehouseId: bucket.warehouseId,
        sku: bucket.sku,
        title: bucket.title,
        warehouseCode: bucket.warehouseCode,
        episodeCount: result.episodeCount,
        daysOut: Math.round(result.daysOut * 10) / 10,
        currentlyOut: result.currentlyOut,
        availabilityPct: availabilityPct(result.daysOut, days),
        unmeasuredMovements: result.unmeasuredPoints,
      });
    }

    rows.sort((a, b) => b.daysOut - a.daysOut || b.episodeCount - a.episodeCount);

    return {
      range: isoRange(range),
      periodDays: days,
      rows: rows.slice(0, take),
      linesAffected: rows.length,
      totalEpisodes: rows.reduce((sum, r) => sum + r.episodeCount, 0),
      unmeasuredLines,
    };
  });
}

// ─── 10.1e Movement summary by reason ────────────────────────────────────────

export interface MovementSummaryReport extends MovementSummary {
  range: { from: string; to: string };
  periodDays: number;
  currency: string;
  warehouseId: string | null;
}

interface MovementSummarySqlRow {
  reason: string;
  movements: bigint;
  units_in: bigint;
  units_out: bigint;
  cost_cents: bigint | null;
  costed_movements: bigint;
}

/**
 * Where the stock went, by reason.
 *
 * The reconciling report: every movement in the window, grouped by why it
 * happened, with the units in each direction and what those goods cost. It is
 * the one report whose parts must add up to the ledger exactly, so an unknown
 * reason is grouped rather than dropped, and a reason nothing costed reports a
 * blank cost rather than $0.00.
 */
export async function movementSummaryReport(
  ctx: ServiceContext,
  filter: PerformanceFilter = {}
): Promise<MovementSummaryReport> {
  const range = resolveWindow(filter, 30);
  const warehouse = filter.warehouseId ?? null;

  return withTenant(ctx, async (tx) => {
    const rows = await tx.$queryRaw<MovementSummarySqlRow[]>`
      SELECT m.reason,
             COUNT(*)::bigint AS movements,
             COALESCE(SUM(m.delta) FILTER (WHERE m.delta > 0), 0)::bigint       AS units_in,
             COALESCE(SUM(-m.delta) FILTER (WHERE m.delta < 0), 0)::bigint      AS units_out,
             SUM(m.cost_consumed_cents)::bigint                                 AS cost_cents,
             COUNT(*) FILTER (WHERE m.cost_consumed_cents IS NOT NULL)::bigint  AS costed_movements
      FROM inventory_movements m
      WHERE m.tenant_id = ${ctx.tenantId}::uuid
        AND m.created_at >= ${range.from} AND m.created_at < ${range.to}
        AND (${warehouse}::uuid IS NULL OR m.warehouse_id = ${warehouse}::uuid)
      GROUP BY m.reason
    `;

    return {
      range: isoRange(range),
      periodDays: windowDays(range),
      currency: await baseCurrency(tx),
      warehouseId: warehouse,
      ...summarizeMovements(
        rows.map((row) => ({
          reason: row.reason,
          movements: Number(row.movements),
          unitsIn: Number(row.units_in),
          unitsOut: Number(row.units_out),
          costCents: row.cost_cents === null ? null : Number(row.cost_cents),
          costedMovements: Number(row.costed_movements),
        }))
      ),
    };
  });
}
