// Supplier scorecard (docs/146 Phase 8.1) — how the people you buy from actually
// behave, measured from what the platform already recorded.
//
// Nothing here is new information. Every figure comes out of the purchase orders,
// the receipts and the ledger; the only reason a business does not have these
// numbers is that nobody has ever added them up. A buyer who can say "this
// supplier has shorted us on one line in six for a year" has a different
// conversation from one who has a feeling about it.
//
// ── The one rule ─────────────────────────────────────────────────────────────
//
// Every rate below is NULLABLE and carries its sample count. That is not
// fastidiousness; it is the difference between a scorecard and a libel. "0% on
// time" produced by a supplier who never quoted a lead time is a number a person
// acts on, and it is wrong in the most damaging possible direction. So:
//
//   on time     null when nobody ever set a date to be late for
//   fill rate   null until an order has FINISHED — an open line is in transit,
//               not short, and counting it scores every supplier zero on day one
//   price       null unless a same-currency comparison existed
//   damage      null only when nothing was received; zero damage on real
//               deliveries is a genuine measurement and reads as one
//   score       null below MIN_SCORED_COMPONENTS, and carries how many
//               components it stands on
//
// ── What it does not do ──────────────────────────────────────────────────────
//
// It does not measure lead time. `inventory_supplier_lead_times` (Phase 7.3)
// owns that, and the sweep COPIES it. Two independent measurements of one thing
// is how a scorecard starts disagreeing with the screen it links to.

import { scoreSupplier, type ScorecardComponents } from '@sparx/commerce-schemas';
import { withTenant } from '@sparx/db';
import type { TxClient } from '@sparx/db';

import type { ServiceContext } from '../errors';

/** Rolling window. Twelve months is the category convention and it is long
 *  enough that a seasonal business's quiet half does not empty the sample. */
export const SCORECARD_WINDOW_DAYS = 365;

/** Rows written per transaction. */
const WRITE_CHUNK = 100;

export interface SupplierScorecardRow {
  supplierId: string;
  supplierName: string | null;
  supplierCode: string | null;
  windowDays: number;
  measuredAt: string;

  ordersPlaced: number;
  deliveries: number;
  spendCents: number;
  receivedUnits: number;

  onTimeRate: number | null;
  onTimeSample: number;
  lateDeliveries: number;
  avgDaysLate: number | null;

  fillRate: number | null;
  fillRateSample: number;
  shortLines: number;

  leadTimeMeanDays: number | null;
  leadTimePromisedDays: number | null;
  leadTimeVarianceDays: number | null;
  leadTimeSample: number;

  priceVariancePct: number | null;
  priceVarianceCents: number | null;
  priceVarianceSample: number;

  damageRate: number | null;
  damagedUnits: number;

  score: number | null;
  grade: string | null;
  scoredComponents: number;
}

export interface ScorecardSweepResult {
  suppliersMeasured: number;
  /** How many came out with a publishable score. The gap between this and the
   *  count above is the honest answer to "why is half the league table blank". */
  suppliersScored: number;
  windowDays: number;
}

// ─── The sweep ───────────────────────────────────────────────────────────────

/**
 * Re-measure every supplier and write the scorecards.
 *
 * Idempotent by construction: it recomputes from scratch rather than
 * accumulating, so re-running it twice in a day changes nothing and a receipt
 * corrected after the fact is picked up on the next pass instead of leaving a
 * stale average behind forever. Same contract as `recomputeLeadTimes`.
 */
export async function recomputeSupplierScorecards(
  ctx: ServiceContext,
  options: { windowDays?: number } = {}
): Promise<ScorecardSweepResult> {
  const windowDays = Math.max(28, Math.min(1095, options.windowDays ?? SCORECARD_WINDOW_DAYS));

  const measured = await withTenant(ctx, (tx) => collect(tx, ctx.tenantId, windowDays));

  let suppliersScored = 0;
  for (let i = 0; i < measured.length; i += WRITE_CHUNK) {
    const chunk = measured.slice(i, i + WRITE_CHUNK);
    await withTenant(ctx, async (tx) => {
      for (const row of chunk) {
        if (row.score !== null) suppliersScored += 1;
        await upsertScorecard(tx, ctx.tenantId, windowDays, row);
      }
    });
  }

  return { suppliersMeasured: measured.length, suppliersScored, windowDays };
}

interface RawAggregate {
  supplierId: string;
  ordersPlaced: number;
  deliveries: number;
  spendCents: number;
  receivedUnits: number;

  onTimeSample: number;
  onTimeCount: number;
  lateDeliveries: number;
  totalDaysLate: number;

  fillRateSample: number;
  shortLines: number;

  leadTimeMeanDays: number | null;
  leadTimePromisedDays: number | null;
  leadTimeSample: number;

  priceVarianceSample: number;
  billedCents: number;
  agreedCents: number;

  damagedUnits: number;
}

type MeasuredSupplier = RawAggregate & {
  onTimeRate: number | null;
  avgDaysLate: number | null;
  fillRate: number | null;
  leadTimeVarianceDays: number | null;
  priceVariancePct: number | null;
  priceVarianceCents: number | null;
  damageRate: number | null;
  score: number | null;
  grade: string | null;
  scoredComponents: number;
};

/**
 * One pass over the purchasing tables, aggregated per supplier.
 *
 * Written as one query rather than five so the whole scorecard is a consistent
 * snapshot: five separate queries can straddle a receipt being posted and
 * produce a fill rate that disagrees with the delivery count beside it.
 *
 * Each CTE is deliberately independent, joined at the end by supplier, so a
 * supplier with orders but no deliveries still appears (with nulls) rather than
 * dropping off the list — a supplier who has never delivered is a finding.
 */
async function collect(
  tx: TxClient,
  tenantId: string,
  windowDays: number
): Promise<MeasuredSupplier[]> {
  const rows = await tx.$queryRaw<RawAggregate[]>`
    WITH window_orders AS (
      SELECT po.id, po.supplier_id, po.ordered_at, po.expected_arrival_at, po.status, po.currency
      FROM inventory_purchase_orders po
      WHERE po.tenant_id = ${tenantId}::uuid
        AND po.ordered_at IS NOT NULL
        AND po.ordered_at >= now() - make_interval(days => ${windowDays}::int)
    ),
    order_counts AS (
      SELECT supplier_id, COUNT(*)::int AS orders_placed
      FROM window_orders
      GROUP BY supplier_id
    ),
    -- One row per delivery. The date it was DUE is the order's expected arrival;
    -- when the buyer never set one, the supplier's own stated lead time from the
    -- order date stands in. When there is neither, the delivery contributes
    -- nothing to the on-time rate rather than counting as on time.
    deliveries AS (
      SELECT
        wo.supplier_id,
        gr.id AS receipt_id,
        gr.received_at,
        COALESCE(
          wo.expected_arrival_at,
          CASE WHEN s.lead_time_days IS NOT NULL
               THEN wo.ordered_at + make_interval(days => s.lead_time_days)
          END
        ) AS due_at
      FROM inventory_goods_receipts gr
      JOIN window_orders wo ON wo.id = gr.purchase_order_id
      JOIN inventory_suppliers s ON s.id = wo.supplier_id
      WHERE gr.tenant_id = ${tenantId}::uuid
    ),
    delivery_stats AS (
      SELECT
        supplier_id,
        COUNT(*)::int                                              AS deliveries,
        COUNT(*) FILTER (WHERE due_at IS NOT NULL)::int            AS on_time_sample,
        COUNT(*) FILTER (WHERE due_at IS NOT NULL
                           AND received_at <= due_at)::int         AS on_time_count,
        COUNT(*) FILTER (WHERE due_at IS NOT NULL
                           AND received_at > due_at)::int          AS late_deliveries,
        COALESCE(SUM(
          CASE WHEN due_at IS NOT NULL AND received_at > due_at
               THEN EXTRACT(EPOCH FROM (received_at - due_at)) / 86400
          END
        ), 0)::float8                                              AS total_days_late
      FROM deliveries
      GROUP BY supplier_id
    ),
    -- What arrived and what it was billed at, plus the agreed price on the same
    -- lines. Restricted to same-currency deliveries: a variance computed across
    -- two currencies at a rate nobody recorded is a fabricated number.
    receipt_lines AS (
      SELECT
        wo.supplier_id,
        grl.quantity_received,
        grl.unit_cost_cents,
        pol.unit_cost_cents AS agreed_unit_cost_cents,
        (gr.currency = wo.currency) AS comparable
      FROM inventory_goods_receipt_lines grl
      JOIN inventory_goods_receipts gr ON gr.id = grl.goods_receipt_id
      JOIN window_orders wo ON wo.id = gr.purchase_order_id
      JOIN inventory_purchase_order_lines pol ON pol.id = grl.purchase_order_line_id
      WHERE grl.tenant_id = ${tenantId}::uuid
    ),
    receipt_stats AS (
      SELECT
        supplier_id,
        COALESCE(SUM(quantity_received), 0)::int                             AS received_units,
        COALESCE(SUM(quantity_received * unit_cost_cents), 0)::bigint        AS spend_cents,
        COUNT(*) FILTER (WHERE comparable)::int                              AS price_variance_sample,
        COALESCE(SUM(quantity_received * unit_cost_cents)
                 FILTER (WHERE comparable), 0)::bigint                       AS billed_cents,
        COALESCE(SUM(quantity_received * agreed_unit_cost_cents)
                 FILTER (WHERE comparable), 0)::bigint                       AS agreed_cents
      FROM receipt_lines
      GROUP BY supplier_id
    ),
    -- Fill rate over FINISHED orders only. A line on an open order is in transit,
    -- not short; counting it would score every supplier zero the day their order
    -- was raised.
    fill_stats AS (
      SELECT
        wo.supplier_id,
        COUNT(*)::int                                                        AS fill_rate_sample,
        COUNT(*) FILTER (WHERE pol.quantity_received < pol.quantity_ordered)::int AS short_lines
      FROM inventory_purchase_order_lines pol
      JOIN window_orders wo ON wo.id = pol.purchase_order_id
      WHERE pol.tenant_id = ${tenantId}::uuid
        AND wo.status IN ('received', 'closed')
      GROUP BY wo.supplier_id
    ),
    -- Damage read from the ledger, where the receipt already wrote it. No second
    -- record of the same fact.
    damage_stats AS (
      SELECT
        wo.supplier_id,
        COALESCE(SUM(-m.delta), 0)::int AS damaged_units
      FROM inventory_movements m
      JOIN inventory_goods_receipts gr ON gr.id = m.reference_id
      JOIN window_orders wo ON wo.id = gr.purchase_order_id
      WHERE m.tenant_id = ${tenantId}::uuid
        AND m.reason = 'damage'
        AND m.reference_type = 'GoodsReceipt'
      GROUP BY wo.supplier_id
    ),
    -- COPIED from the Phase 7.3 measurement, never re-derived here.
    lead_times AS (
      SELECT supplier_id, mean_days, promised_days, sample_count
      FROM inventory_supplier_lead_times
      WHERE tenant_id = ${tenantId}::uuid AND variant_id IS NULL
    )
    SELECT
      s.id                                          AS "supplierId",
      COALESCE(oc.orders_placed, 0)                 AS "ordersPlaced",
      COALESCE(ds.deliveries, 0)                    AS "deliveries",
      COALESCE(rs.spend_cents, 0)::int              AS "spendCents",
      COALESCE(rs.received_units, 0)                AS "receivedUnits",
      COALESCE(ds.on_time_sample, 0)                AS "onTimeSample",
      COALESCE(ds.on_time_count, 0)                 AS "onTimeCount",
      COALESCE(ds.late_deliveries, 0)               AS "lateDeliveries",
      COALESCE(ds.total_days_late, 0)               AS "totalDaysLate",
      COALESCE(fs.fill_rate_sample, 0)              AS "fillRateSample",
      COALESCE(fs.short_lines, 0)                   AS "shortLines",
      lt.mean_days::float8                          AS "leadTimeMeanDays",
      lt.promised_days                              AS "leadTimePromisedDays",
      COALESCE(lt.sample_count, 0)                  AS "leadTimeSample",
      COALESCE(rs.price_variance_sample, 0)         AS "priceVarianceSample",
      COALESCE(rs.billed_cents, 0)::int             AS "billedCents",
      COALESCE(rs.agreed_cents, 0)::int             AS "agreedCents",
      COALESCE(dm.damaged_units, 0)                 AS "damagedUnits"
    FROM inventory_suppliers s
    LEFT JOIN order_counts   oc ON oc.supplier_id = s.id
    LEFT JOIN delivery_stats ds ON ds.supplier_id = s.id
    LEFT JOIN receipt_stats  rs ON rs.supplier_id = s.id
    LEFT JOIN fill_stats     fs ON fs.supplier_id = s.id
    LEFT JOIN damage_stats   dm ON dm.supplier_id = s.id
    LEFT JOIN lead_times     lt ON lt.supplier_id = s.id
    WHERE s.tenant_id = ${tenantId}::uuid
      AND s.deleted_at IS NULL
  `;

  return rows.map(derive);
}

/** Turn counts into rates, and refuse to turn nothing into a rate. */
function derive(raw: RawAggregate): MeasuredSupplier {
  const onTimeRate = raw.onTimeSample > 0 ? round4(raw.onTimeCount / raw.onTimeSample) : null;
  const avgDaysLate =
    raw.lateDeliveries > 0 ? round2(Number(raw.totalDaysLate) / raw.lateDeliveries) : null;

  const fillRate =
    raw.fillRateSample > 0
      ? round4((raw.fillRateSample - raw.shortLines) / raw.fillRateSample)
      : null;

  const leadTimeVarianceDays =
    raw.leadTimeMeanDays !== null && raw.leadTimePromisedDays !== null
      ? round2(Number(raw.leadTimeMeanDays) - raw.leadTimePromisedDays)
      : null;

  // Percentage over the agreed price across everything comparable, weighted by
  // value — a 40% overcharge on one washer must not outweigh a 1% drift across
  // the whole year's engines.
  const agreed = Number(raw.agreedCents);
  const priceVarianceCents =
    raw.priceVarianceSample > 0 ? Math.round(Number(raw.billedCents) - agreed) : null;
  const priceVariancePct =
    raw.priceVarianceSample > 0 && agreed > 0
      ? round4(((Number(raw.billedCents) - agreed) / agreed) * 100)
      : null;

  const damageRate =
    raw.receivedUnits > 0
      ? round4(raw.damagedUnits / (raw.receivedUnits + raw.damagedUnits))
      : null;

  const components: ScorecardComponents = {
    onTimeRate,
    fillRate,
    priceVariancePct,
    damageRate,
  };
  const { score, grade, scoredComponents } = scoreSupplier(components);

  return {
    ...raw,
    onTimeRate,
    avgDaysLate,
    fillRate,
    leadTimeVarianceDays,
    priceVariancePct,
    priceVarianceCents,
    damageRate,
    score,
    grade,
    scoredComponents,
  };
}

/**
 * Write one supplier's card.
 *
 * Find-then-write rather than `upsert`: the uniqueness is the compound
 * (tenant_id, supplier_id) and the sweep is the only writer, serialised.
 */
async function upsertScorecard(
  tx: TxClient,
  tenantId: string,
  windowDays: number,
  row: MeasuredSupplier
): Promise<void> {
  const data = {
    windowDays,
    measuredAt: new Date(),
    ordersPlaced: row.ordersPlaced,
    deliveries: row.deliveries,
    spendCents: row.spendCents,
    receivedUnits: row.receivedUnits,
    onTimeRate: row.onTimeRate,
    onTimeSample: row.onTimeSample,
    lateDeliveries: row.lateDeliveries,
    avgDaysLate: row.avgDaysLate,
    fillRate: row.fillRate,
    fillRateSample: row.fillRateSample,
    shortLines: row.shortLines,
    leadTimeMeanDays: row.leadTimeMeanDays,
    leadTimePromisedDays: row.leadTimePromisedDays,
    leadTimeVarianceDays: row.leadTimeVarianceDays,
    leadTimeSample: row.leadTimeSample,
    priceVariancePct: row.priceVariancePct,
    priceVarianceCents: row.priceVarianceCents,
    priceVarianceSample: row.priceVarianceSample,
    damageRate: row.damageRate,
    damagedUnits: row.damagedUnits,
    score: row.score,
    grade: row.grade,
    scoredComponents: row.scoredComponents,
  };

  const existing = await tx.supplierScorecard.findFirst({
    where: { tenantId, supplierId: row.supplierId },
    select: { id: true },
  });
  if (existing) {
    await tx.supplierScorecard.update({ where: { id: existing.id }, data });
    return;
  }
  await tx.supplierScorecard.create({
    data: { tenantId, supplierId: row.supplierId, ...data },
  });
}

// ─── Reads ───────────────────────────────────────────────────────────────────

export interface ListScorecardsFilter {
  supplierId?: string;
  /** Only suppliers with a publishable score. Off by default, because "we cannot
   *  measure these five" is part of the answer to "how are my suppliers doing". */
  scoredOnly?: boolean;
  take?: number;
  skip?: number;
}

export interface SupplierScorecardReport {
  items: SupplierScorecardRow[];
  total: number;
  /** When the sweep last ran, or null if it never has. The screen needs this to
   *  tell "everything is fine" apart from "nothing has been looked at". */
  measuredAt: string | null;
  /** How many suppliers exist but carry no score, and therefore cannot be
   *  ranked. Reported rather than quietly filtered out. */
  unscored: number;
}

export async function listSupplierScorecards(
  ctx: ServiceContext,
  filter: ListScorecardsFilter = {}
): Promise<SupplierScorecardReport> {
  const take = Math.min(filter.take ?? 100, 500);
  return withTenant(ctx, async (tx) => {
    const where = {
      tenantId: ctx.tenantId,
      ...(filter.supplierId ? { supplierId: filter.supplierId } : {}),
      ...(filter.scoredOnly ? { score: { not: null } } : {}),
    };
    const [rows, total, unscored] = await Promise.all([
      tx.supplierScorecard.findMany({
        where,
        // Worst first: a league table exists to show you the problem, and a
        // supplier you cannot measure sorts last rather than looking perfect.
        orderBy: [{ score: 'asc' }, { spendCents: 'desc' }],
        take,
        skip: filter.skip ?? 0,
        include: { supplier: { select: { name: true, code: true } } },
      }),
      tx.supplierScorecard.count({ where }),
      tx.supplierScorecard.count({ where: { tenantId: ctx.tenantId, score: null } }),
    ]);
    const measuredAt = rows.reduce<Date | null>(
      (latest, row) => (latest === null || row.measuredAt > latest ? row.measuredAt : latest),
      null
    );
    return {
      items: rows.map(serialize),
      total,
      measuredAt: measuredAt?.toISOString() ?? null,
      unscored,
    };
  });
}

export async function getSupplierScorecard(
  ctx: ServiceContext,
  supplierId: string
): Promise<SupplierScorecardRow | null> {
  const row = await withTenant(ctx, (tx) =>
    tx.supplierScorecard.findFirst({
      where: { tenantId: ctx.tenantId, supplierId },
      include: { supplier: { select: { name: true, code: true } } },
    })
  );
  // Null rather than a zeroed card. A supplier the sweep has never reached is
  // not a supplier who scored nothing, and the surface says so in words.
  return row ? serialize(row) : null;
}

interface ScorecardRecord {
  supplierId: string;
  windowDays: number;
  measuredAt: Date;
  ordersPlaced: number;
  deliveries: number;
  spendCents: number;
  receivedUnits: number;
  onTimeRate: unknown;
  onTimeSample: number;
  lateDeliveries: number;
  avgDaysLate: unknown;
  fillRate: unknown;
  fillRateSample: number;
  shortLines: number;
  leadTimeMeanDays: unknown;
  leadTimePromisedDays: number | null;
  leadTimeVarianceDays: unknown;
  leadTimeSample: number;
  priceVariancePct: unknown;
  priceVarianceCents: number | null;
  priceVarianceSample: number;
  damageRate: unknown;
  damagedUnits: number;
  score: number | null;
  grade: string | null;
  scoredComponents: number;
  supplier?: { name: string | null; code: string | null } | null;
}

function serialize(row: ScorecardRecord): SupplierScorecardRow {
  return {
    supplierId: row.supplierId,
    supplierName: row.supplier?.name ?? null,
    supplierCode: row.supplier?.code ?? null,
    windowDays: row.windowDays,
    measuredAt: row.measuredAt.toISOString(),
    ordersPlaced: row.ordersPlaced,
    deliveries: row.deliveries,
    spendCents: row.spendCents,
    receivedUnits: row.receivedUnits,
    onTimeRate: nullableNum(row.onTimeRate),
    onTimeSample: row.onTimeSample,
    lateDeliveries: row.lateDeliveries,
    avgDaysLate: nullableNum(row.avgDaysLate),
    fillRate: nullableNum(row.fillRate),
    fillRateSample: row.fillRateSample,
    shortLines: row.shortLines,
    leadTimeMeanDays: nullableNum(row.leadTimeMeanDays),
    leadTimePromisedDays: row.leadTimePromisedDays,
    leadTimeVarianceDays: nullableNum(row.leadTimeVarianceDays),
    leadTimeSample: row.leadTimeSample,
    priceVariancePct: nullableNum(row.priceVariancePct),
    priceVarianceCents: row.priceVarianceCents,
    priceVarianceSample: row.priceVarianceSample,
    damageRate: nullableNum(row.damageRate),
    damagedUnits: row.damagedUnits,
    score: row.score,
    grade: row.grade,
    scoredComponents: row.scoredComponents,
  };
}

// ─── helpers ─────────────────────────────────────────────────────────────────

/** A Prisma Decimal in, a number or NULL out — and NULL stays NULL. Coercing an
 *  absent measurement to 0 here would undo the entire point of the column. */
function nullableNum(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function round2(n: number): number {
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
}

function round4(n: number): number {
  return Number.isFinite(n) ? Math.round(n * 10_000) / 10_000 : 0;
}
