// Demand velocity — how fast a thing actually sells (docs/146 Phase 7.1, 7.2).
//
// Reads the movement ledger and writes one `inventory_demand_velocity` row per
// (variant, location): three trailing rates, the daily standard deviation, the
// coefficient of variation, a seasonality multiplier where there is a year of
// history, and — the honesty field — how much history any of it stands on.
//
// ── What counts as demand ────────────────────────────────────────────────────
//
// `sale` AND `assembly_out`. A component consumed by a production run is demand
// for that component in every sense that matters: it left the shelf, it will
// need replacing, and the run will stop if it is not there. Counting only `sale`
// would forecast zero for every part a manufacturer uses — and a WMS-lite tenant
// with no commerce module at all would have no forecast for anything, which
// breaks the standalone-usable rule this module is built on.
//
// Deliberately NOT demand: `transfer_out` (the stock is still ours, it moved),
// `loss`/`damage` (shrinkage, and Phase 1's report already owns it), `recount`
// (a correction, not a consumption). Each of those would inflate a reorder point
// with something reordering cannot fix.
//
// ── Why the standard deviation needs the ZERO days ───────────────────────────
//
// A line that sells 60 units on one day and nothing for the next 89 has the same
// 90-day average as one selling two thirds of a unit every day, and wildly
// different risk. Averaging only over days that HAD a sale would report the
// spiky line as perfectly steady. So the window is every day in it, and the
// variance is computed as Σx² over the observed days against a mean taken over
// the whole window — algebraically identical to bucketing every zero, without
// generating ninety rows per level to do it.
//
// The window is the shorter of 90 days and the item's own history: a variant
// first stocked nine days ago must not be averaged over eighty-one days that
// pre-date its existence.

import { chooseForecast, coefficientOfVariation, seasonalityIndex } from '@sparx/commerce-schemas';
import type { ForecastBasis } from '@sparx/commerce-schemas';
import { withTenant } from '@sparx/db';
import type { TxClient } from '@sparx/db';

import type { ServiceContext } from '../errors';

import { loadPlanningPolicy } from './planning-policy';

/** The ledger reasons that mean "a unit was consumed" — see the header. */
export const DEMAND_REASONS = ['sale', 'assembly_out'] as const;

/** How many days ahead the seasonality index describes. */
const SEASON_WINDOW_DAYS = 30;

/** Rows written per transaction. Big enough to be few round trips, small enough
 *  that a catalogue-wide pass never holds one long transaction open. */
const WRITE_CHUNK = 200;

export interface DemandVelocityRow {
  variantId: string;
  warehouseId: string;
  units7: number;
  units30: number;
  units90: number;
  perDay7: number;
  perDay30: number;
  perDay90: number;
  forecastPerDay: number;
  forecastBasis: ForecastBasis;
  demandStdDev: number;
  demandCv: number | null;
  daysWithDemand: number;
  seasonalityIndex: number | null;
  historyDays: number;
  firstMovementAt: string | null;
  lastSaleAt: string | null;
  computedAt: string;
}

export interface DemandSweepResult {
  levelsComputed: number;
  withDemand: number;
  withSeasonality: number;
  warehouseId: string | null;
}

/** The raw aggregate for one level, straight out of the ledger. */
interface AggregateRow {
  variantId: string;
  warehouseId: string;
  units7: number;
  units30: number;
  units90: number;
  /** Σ of each DAY's total, squared — the variance's second moment. */
  sumSquares: number;
  daysWithDemand: number;
  firstMovementAt: Date | null;
  lastSaleAt: Date | null;
  /** Units in the same 30-day calendar window one year ago. */
  seasonUnits: number;
  /** Units across the trailing 365 days — the seasonality baseline. */
  trailingYearUnits: number;
}

/**
 * Recompute velocity for every level (optionally one location) and materialise
 * it.
 *
 * Read once, compute in TypeScript, write in chunks. The arithmetic deliberately
 * does NOT happen in SQL even though it could: `chooseForecast` and
 * `coefficientOfVariation` are the same functions the API and the workbench call,
 * and a second implementation in a CASE expression is a second implementation
 * that will disagree with the first the week after someone edits one of them.
 */
export async function recomputeDemandVelocity(
  ctx: ServiceContext,
  filter: { warehouseId?: string } = {}
): Promise<DemandSweepResult> {
  const warehouseId = filter.warehouseId ?? null;

  const { rows, minSeasonalityHistoryDays } = await withTenant(ctx, async (tx) => {
    const policy = await loadPlanningPolicy(tx, ctx.tenantId);
    return {
      rows: await aggregateDemand(tx, ctx.tenantId, warehouseId),
      minSeasonalityHistoryDays: policy.minSeasonalityHistoryDays,
    };
  });

  const computed = rows.map((row) => toVelocity(row, minSeasonalityHistoryDays));

  for (let i = 0; i < computed.length; i += WRITE_CHUNK) {
    const chunk = computed.slice(i, i + WRITE_CHUNK);
    await withTenant(ctx, async (tx) => {
      await Promise.all(chunk.map((v) => writeVelocity(tx, ctx.tenantId, v)));
    });
  }

  return {
    levelsComputed: computed.length,
    withDemand: computed.filter((v) => v.units90 > 0).length,
    withSeasonality: computed.filter((v) => v.seasonalityIndex !== null).length,
    warehouseId,
  };
}

/**
 * One pass over the ledger producing every input the maths needs.
 *
 * `daily` buckets by day FIRST, because the variance is over daily totals and
 * not over individual movements — three sales of four units on one Tuesday is
 * one observation of twelve, not three observations of four.
 */
async function aggregateDemand(
  tx: TxClient,
  tenantId: string,
  warehouseId: string | null
): Promise<AggregateRow[]> {
  return tx.$queryRaw<AggregateRow[]>`
    WITH levels AS (
      SELECT l.variant_id, l.warehouse_id
      FROM inventory_levels l
      JOIN inventory_warehouses w ON w.id = l.warehouse_id AND w.deleted_at IS NULL
      JOIN commerce_product_variants v ON v.id = l.variant_id AND v.deleted_at IS NULL
      WHERE l.tenant_id = ${tenantId}::uuid
        AND (${warehouseId}::uuid IS NULL OR l.warehouse_id = ${warehouseId}::uuid)
    ),
    history AS (
      SELECT m.variant_id, m.warehouse_id,
             MIN(m.created_at) AS first_movement_at,
             MAX(m.created_at) FILTER (WHERE m.reason IN ('sale','assembly_out')) AS last_sale_at
      FROM inventory_movements m
      WHERE m.tenant_id = ${tenantId}::uuid
      GROUP BY m.variant_id, m.warehouse_id
    ),
    daily AS (
      SELECT m.variant_id, m.warehouse_id,
             date_trunc('day', m.created_at) AS day,
             SUM(ABS(m.delta))::numeric AS units
      FROM inventory_movements m
      WHERE m.tenant_id = ${tenantId}::uuid
        AND m.reason IN ('sale','assembly_out')
        AND m.created_at >= now() - interval '90 days'
      GROUP BY m.variant_id, m.warehouse_id, date_trunc('day', m.created_at)
    ),
    windows AS (
      SELECT d.variant_id, d.warehouse_id,
             COALESCE(SUM(d.units) FILTER (WHERE d.day >= date_trunc('day', now()) - interval '6 days'), 0)  AS units_7,
             COALESCE(SUM(d.units) FILTER (WHERE d.day >= date_trunc('day', now()) - interval '29 days'), 0) AS units_30,
             COALESCE(SUM(d.units), 0)                                                                        AS units_90,
             COALESCE(SUM(d.units * d.units), 0)                                                              AS sum_squares,
             COUNT(*)                                                                                          AS days_with_demand
      FROM daily d
      GROUP BY d.variant_id, d.warehouse_id
    ),
    -- The seasonality pair: the same 30-day calendar window one year ago, and
    -- the trailing year it sits inside. Both from the same scan.
    season AS (
      SELECT m.variant_id, m.warehouse_id,
             COALESCE(SUM(ABS(m.delta)) FILTER (
               WHERE m.created_at >= now() - interval '365 days'
                 AND m.created_at <  now() - interval '365 days' + interval '30 days'
             ), 0) AS season_units,
             COALESCE(SUM(ABS(m.delta)) FILTER (
               WHERE m.created_at >= now() - interval '365 days'
             ), 0) AS trailing_year_units
      FROM inventory_movements m
      WHERE m.tenant_id = ${tenantId}::uuid
        AND m.reason IN ('sale','assembly_out')
        AND m.created_at >= now() - interval '395 days'
      GROUP BY m.variant_id, m.warehouse_id
    )
    SELECT
      l.variant_id                                    AS "variantId",
      l.warehouse_id                                  AS "warehouseId",
      COALESCE(w.units_7, 0)::float8                  AS "units7",
      COALESCE(w.units_30, 0)::float8                 AS "units30",
      COALESCE(w.units_90, 0)::float8                 AS "units90",
      COALESCE(w.sum_squares, 0)::float8              AS "sumSquares",
      COALESCE(w.days_with_demand, 0)::int            AS "daysWithDemand",
      h.first_movement_at                             AS "firstMovementAt",
      h.last_sale_at                                  AS "lastSaleAt",
      COALESCE(s.season_units, 0)::float8             AS "seasonUnits",
      COALESCE(s.trailing_year_units, 0)::float8      AS "trailingYearUnits"
    FROM levels l
    LEFT JOIN windows w ON w.variant_id = l.variant_id AND w.warehouse_id = l.warehouse_id
    LEFT JOIN history h ON h.variant_id = l.variant_id AND h.warehouse_id = l.warehouse_id
    LEFT JOIN season  s ON s.variant_id = l.variant_id AND s.warehouse_id = l.warehouse_id
  `;
}

/** Turn one aggregate into the row that gets stored, using the shared maths. */
function toVelocity(row: AggregateRow, minSeasonalityHistoryDays: number): DemandVelocityRow {
  const historyDays = daysSince(row.firstMovementAt);

  // The window the variance is measured over: never longer than the item has
  // existed, never shorter than a day.
  const windowDays = Math.max(1, Math.min(90, historyDays > 0 ? historyDays : 1));
  const observed = Math.max(1, Math.min(90, windowDays));

  const perDay7 = round4(row.units7 / Math.min(7, observed));
  const perDay30 = round4(row.units30 / Math.min(30, observed));
  const perDay90 = round4(row.units90 / observed);

  const demandStdDev = round4(dailyStdDev(row.units90, row.sumSquares, observed));
  const demandCv = coefficientOfVariation(perDay90, demandStdDev);

  const forecast = chooseForecast({
    perDay7,
    perDay30,
    perDay90,
    units30: row.units30,
    units90: row.units90,
    historyDays,
  });

  const season = seasonalityIndex({
    samePeriodLastYearUnits: row.seasonUnits,
    periodDays: SEASON_WINDOW_DAYS,
    trailingYearUnits: row.trailingYearUnits,
    historyDays,
    minHistoryDays: minSeasonalityHistoryDays,
  });

  return {
    variantId: row.variantId,
    warehouseId: row.warehouseId,
    units7: Math.round(row.units7),
    units30: Math.round(row.units30),
    units90: Math.round(row.units90),
    perDay7,
    perDay30,
    perDay90,
    forecastPerDay: forecast.perDay,
    forecastBasis: forecast.basis,
    demandStdDev,
    demandCv: demandCv === null ? null : round4(demandCv),
    daysWithDemand: row.daysWithDemand,
    seasonalityIndex: season,
    historyDays,
    firstMovementAt: row.firstMovementAt?.toISOString() ?? null,
    lastSaleAt: row.lastSaleAt?.toISOString() ?? null,
    computedAt: new Date().toISOString(),
  };
}

/**
 * Sample standard deviation of DAILY demand across `windowDays`, given only the
 * sum and the sum of squares of the days that had any.
 *
 *   σ² = ( Σx² − (Σx)²/n ) / (n − 1)
 *
 * The days with no sale contribute 0 to both sums, so they need not be
 * materialised — but they DO count in n, which is the whole point. Drop them
 * from n and a line that sold everything in one afternoon reports zero variance.
 */
function dailyStdDev(sum: number, sumSquares: number, windowDays: number): number {
  const n = Math.max(1, Math.round(windowDays));
  if (n < 2) return 0;
  const variance = (sumSquares - (sum * sum) / n) / (n - 1);
  // Subtracting two nearly-equal large floats can land a hair below zero; a
  // negative variance is arithmetic noise, not a finding.
  return variance <= 0 ? 0 : Math.sqrt(variance);
}

async function writeVelocity(tx: TxClient, tenantId: string, v: DemandVelocityRow): Promise<void> {
  const data = {
    units7: v.units7,
    units30: v.units30,
    units90: v.units90,
    perDay7: v.perDay7,
    perDay30: v.perDay30,
    perDay90: v.perDay90,
    forecastPerDay: v.forecastPerDay,
    forecastBasis: v.forecastBasis,
    demandStdDev: v.demandStdDev,
    demandCv: v.demandCv,
    daysWithDemand: v.daysWithDemand,
    seasonalityIndex: v.seasonalityIndex,
    historyDays: v.historyDays,
    firstMovementAt: v.firstMovementAt ? new Date(v.firstMovementAt) : null,
    lastSaleAt: v.lastSaleAt ? new Date(v.lastSaleAt) : null,
    computedAt: new Date(v.computedAt),
  };
  await tx.demandVelocity.upsert({
    where: { variantId_warehouseId: { variantId: v.variantId, warehouseId: v.warehouseId } },
    create: { tenantId, variantId: v.variantId, warehouseId: v.warehouseId, ...data },
    update: data,
  });

  // The denormalised copy the stock list reads. Written in the same transaction
  // as the row that explains it, so the two can never disagree.
  await tx.inventoryLevel.update({
    where: { variantId_warehouseId: { variantId: v.variantId, warehouseId: v.warehouseId } },
    data: { forecastDailyDemand: v.forecastPerDay, planningComputedAt: data.computedAt },
  });
}

/** Read one level's stored velocity, or null when no sweep has seen it yet. */
export async function getDemandVelocity(
  ctx: ServiceContext,
  input: { variantId: string; warehouseId: string }
): Promise<DemandVelocityRow | null> {
  return withTenant(ctx, async (tx) => {
    const row = await tx.demandVelocity.findUnique({
      where: {
        variantId_warehouseId: { variantId: input.variantId, warehouseId: input.warehouseId },
      },
    });
    return row ? fromDb(row) : null;
  });
}

/** Shape a stored row for the API. Exported so the reports and the provenance
 *  read share exactly one mapping. */
export function fromDb(row: {
  variantId: string;
  warehouseId: string;
  units7: number;
  units30: number;
  units90: number;
  perDay7: unknown;
  perDay30: unknown;
  perDay90: unknown;
  forecastPerDay: unknown;
  forecastBasis: string;
  demandStdDev: unknown;
  demandCv: unknown;
  daysWithDemand: number;
  seasonalityIndex: unknown;
  historyDays: number;
  firstMovementAt: Date | null;
  lastSaleAt: Date | null;
  computedAt: Date;
}): DemandVelocityRow {
  return {
    variantId: row.variantId,
    warehouseId: row.warehouseId,
    units7: row.units7,
    units30: row.units30,
    units90: row.units90,
    perDay7: num(row.perDay7),
    perDay30: num(row.perDay30),
    perDay90: num(row.perDay90),
    forecastPerDay: num(row.forecastPerDay),
    forecastBasis: row.forecastBasis as ForecastBasis,
    demandStdDev: num(row.demandStdDev),
    demandCv: row.demandCv === null ? null : num(row.demandCv),
    daysWithDemand: row.daysWithDemand,
    seasonalityIndex: row.seasonalityIndex === null ? null : num(row.seasonalityIndex),
    historyDays: row.historyDays,
    firstMovementAt: row.firstMovementAt?.toISOString() ?? null,
    lastSaleAt: row.lastSaleAt?.toISOString() ?? null,
    computedAt: row.computedAt.toISOString(),
  };
}

/** Prisma hands `Decimal` back for a numeric column; every consumer wants a
 *  plain number, and `Number()` is correct for both it and a raw float8. */
function num(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function daysSince(date: Date | null): number {
  if (!date) return 0;
  return Math.max(0, Math.floor((Date.now() - date.getTime()) / 86_400_000));
}

function round4(n: number): number {
  return Number.isFinite(n) ? Math.round(n * 10_000) / 10_000 : 0;
}
