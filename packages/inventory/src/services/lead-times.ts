// Measured lead time — how long a supplier ACTUALLY takes (docs/146 Phase 7.3,
// and the input Phase 7.9 needs to stop using the promise).
//
// A supplier record carries `leadTimeDays`, and that number is whatever someone
// typed when the supplier was set up — usually copied off a quote, usually
// optimistic, and never revisited. Every reorder point built on it inherits the
// optimism. Meanwhile the platform has been recording the answer all along: a
// purchase order has a `submittedAt`, and the goods receipts against it have a
// `receivedAt`. The gap between them is the truth.
//
// ── What one measurement is ──────────────────────────────────────────────────
//
// `orderedAt` (stamped when the order is SENT, not when the draft was typed) →
// the FIRST receipt against that line. First rather than last,
// because the question a reorder point asks is "when can I expect stock", and a
// part-shipment that covers the immediate need has answered it. Using the final
// receipt would score a supplier who delivered 90% in four days and the tail six
// weeks later as a six-week supplier, which is not how the buyer experiences
// them.
//
// ── Two grains, and why the per-variant one matters ──────────────────────────
//
// A supplier's overall figure is what you use when you have nothing better. But
// suppliers are rarely uniform: they stock the fast-moving part and drop-ship
// the rare one, and the difference is routinely a fortnight. So a per-(supplier,
// variant) row is measured too and preferred wherever it has enough samples.
//
// ── Sample size is reported, never hidden ────────────────────────────────────
//
// One delivery is an anecdote and three is barely a measurement. `sampleCount`
// rides on every row and the surface says it out loud, because "we measured your
// last 14 deliveries: 11.4 days, ±3.1" and "one delivery took 4 days" deserve
// completely different confidence and an operator can only tell them apart if
// they are told.

import { mean, stdDev } from '@sparx/commerce-schemas';
import { withTenant } from '@sparx/db';
import type { TxClient } from '@sparx/db';

import type { ServiceContext } from '../errors';

/** Below this, the figure is reported but never preferred over a stated one. */
export const MIN_RELIABLE_SAMPLES = 3;

/** How far back to look. Two years, so a supplier's recent behaviour dominates
 *  without one bad winter three years ago following them forever. */
const LOOKBACK_DAYS = 730;

/** Rows written per transaction. */
const WRITE_CHUNK = 200;

export interface LeadTimeRow {
  supplierId: string;
  supplierName: string | null;
  /** Null on the supplier's overall figure. */
  variantId: string | null;
  variantSku: string | null;
  sampleCount: number;
  meanDays: number;
  stdDevDays: number;
  minDays: number;
  maxDays: number;
  /** What they said it would be, at the time of measuring. */
  promisedDays: number | null;
  /** Share of deliveries that arrived on or before the promise. Null when they
   *  never stated one — which is itself worth showing. */
  onTimeRate: number | null;
  /** How far the measurement sits from the promise. Positive = slower than
   *  promised. Null when there is no promise to compare against. */
  varianceDays: number | null;
  /** False below `MIN_RELIABLE_SAMPLES` — the surface must not present a
   *  two-delivery average as a measurement. */
  isReliable: boolean;
  lastReceiptAt: string | null;
  measuredAt: string;
}

export interface LeadTimeSweepResult {
  suppliersMeasured: number;
  variantPairsMeasured: number;
  observations: number;
}

/** One (order line → first receipt) pair. */
interface ObservationRow {
  supplierId: string;
  variantId: string;
  days: number;
  promisedDays: number | null;
  receivedAt: Date;
}

/**
 * Re-measure every supplier's lead time from the receipts, and write the two
 * grains.
 *
 * Idempotent: it recomputes from scratch each time rather than accumulating, so
 * a re-run inside the same day changes nothing and a receipt corrected after the
 * fact is picked up on the next pass instead of leaving a stale average behind
 * forever.
 */
export async function recomputeLeadTimes(ctx: ServiceContext): Promise<LeadTimeSweepResult> {
  const observations = await withTenant(ctx, (tx) => collectObservations(tx, ctx.tenantId));

  const bySupplier = new Map<string, ObservationRow[]>();
  const byPair = new Map<string, ObservationRow[]>();
  for (const o of observations) {
    push(bySupplier, o.supplierId, o);
    push(byPair, `${o.supplierId}::${o.variantId}`, o);
  }

  const writes: {
    supplierId: string;
    variantId: string | null;
    stats: ReturnType<typeof summarise>;
  }[] = [];
  for (const [supplierId, rows] of bySupplier) {
    writes.push({ supplierId, variantId: null, stats: summarise(rows) });
  }
  for (const [key, rows] of byPair) {
    const [supplierId, variantId] = key.split('::');
    if (!supplierId || !variantId) continue;
    writes.push({ supplierId, variantId, stats: summarise(rows) });
  }

  for (let i = 0; i < writes.length; i += WRITE_CHUNK) {
    const chunk = writes.slice(i, i + WRITE_CHUNK);
    await withTenant(ctx, async (tx) => {
      for (const w of chunk) {
        await upsertLeadTime(tx, ctx.tenantId, w.supplierId, w.variantId, w.stats);
      }
    });
  }

  return {
    suppliersMeasured: bySupplier.size,
    variantPairsMeasured: byPair.size,
    observations: observations.length,
  };
}

/**
 * Every (order line → first receipt of that line) pair inside the lookback.
 *
 * `DISTINCT ON` takes the earliest receipt per line, which is the definition of
 * "when could I have had stock". Orders never submitted are excluded — a draft
 * that sat for a month is a buyer's delay, not a supplier's.
 */
async function collectObservations(tx: TxClient, tenantId: string): Promise<ObservationRow[]> {
  return tx.$queryRaw<ObservationRow[]>`
    WITH first_receipt AS (
      SELECT DISTINCT ON (grl.purchase_order_line_id)
             grl.purchase_order_line_id AS line_id,
             gr.received_at             AS received_at
      FROM inventory_goods_receipt_lines grl
      JOIN inventory_goods_receipts gr ON gr.id = grl.goods_receipt_id
      WHERE grl.tenant_id = ${tenantId}::uuid
        AND grl.purchase_order_line_id IS NOT NULL
        AND gr.received_at IS NOT NULL
        AND gr.received_at >= now() - make_interval(days => ${LOOKBACK_DAYS}::int)
      ORDER BY grl.purchase_order_line_id, gr.received_at ASC
    )
    SELECT
      po.supplier_id                                                  AS "supplierId",
      pol.variant_id                                                  AS "variantId",
      GREATEST(0, EXTRACT(EPOCH FROM (fr.received_at - po.ordered_at)) / 86400)::float8 AS "days",
      s.lead_time_days                                                AS "promisedDays",
      fr.received_at                                                  AS "receivedAt"
    FROM first_receipt fr
    JOIN inventory_purchase_order_lines pol ON pol.id = fr.line_id
    JOIN inventory_purchase_orders po ON po.id = pol.purchase_order_id
    JOIN inventory_suppliers s ON s.id = po.supplier_id AND s.deleted_at IS NULL
    WHERE po.tenant_id = ${tenantId}::uuid
      AND po.ordered_at IS NOT NULL
      AND fr.received_at >= po.ordered_at
  `;
}

interface LeadTimeStats {
  sampleCount: number;
  meanDays: number;
  stdDevDays: number;
  minDays: number;
  maxDays: number;
  promisedDays: number | null;
  onTimeRate: number | null;
  lastReceiptAt: Date | null;
}

/** The measurement itself — the shared statistics, applied to one bucket. */
function summarise(rows: ObservationRow[]): LeadTimeStats {
  const days = rows.map((r) => Math.max(0, Number(r.days)));
  const promised = rows.find((r) => r.promisedDays !== null)?.promisedDays ?? null;
  const onTime =
    promised === null
      ? null
      : round4(days.filter((d) => d <= promised).length / Math.max(1, days.length));
  const receipts = rows
    .map((r) => r.receivedAt)
    .filter((d): d is Date => d instanceof Date)
    .sort((a, b) => b.getTime() - a.getTime());

  return {
    sampleCount: days.length,
    meanDays: round2(mean(days)),
    stdDevDays: round2(stdDev(days)),
    minDays: days.length === 0 ? 0 : Math.floor(Math.min(...days)),
    maxDays: days.length === 0 ? 0 : Math.ceil(Math.max(...days)),
    promisedDays: promised,
    onTimeRate: onTime,
    lastReceiptAt: receipts[0] ?? null,
  };
}

/**
 * Write one grain.
 *
 * Not `upsert`: the uniqueness is a pair of PARTIAL indexes (one for the overall
 * row, one for the per-variant rows) rather than a Prisma `@@unique`, so there
 * is no compound key for Prisma to target. Find-then-write is correct here — the
 * sweep is the only writer and it is serialised.
 */
async function upsertLeadTime(
  tx: TxClient,
  tenantId: string,
  supplierId: string,
  variantId: string | null,
  stats: LeadTimeStats
): Promise<void> {
  const existing = await tx.supplierLeadTime.findFirst({
    where: { tenantId, supplierId, variantId },
    select: { id: true },
  });
  const data = {
    sampleCount: stats.sampleCount,
    meanDays: stats.meanDays,
    stdDevDays: stats.stdDevDays,
    minDays: stats.minDays,
    maxDays: stats.maxDays,
    promisedDays: stats.promisedDays,
    onTimeRate: stats.onTimeRate,
    lastReceiptAt: stats.lastReceiptAt,
    measuredAt: new Date(),
  };
  if (existing) {
    await tx.supplierLeadTime.update({ where: { id: existing.id }, data });
    return;
  }
  await tx.supplierLeadTime.create({ data: { tenantId, supplierId, variantId, ...data } });
}

// ─── Reads ───────────────────────────────────────────────────────────────────

export interface ListLeadTimesFilter {
  supplierId?: string;
  variantId?: string;
  /** Include the per-variant rows. Off by default — the league table wants one
   *  row per supplier, not four hundred. */
  includeVariants?: boolean;
  take?: number;
}

export async function listLeadTimes(
  ctx: ServiceContext,
  filter: ListLeadTimesFilter = {}
): Promise<{ items: LeadTimeRow[]; total: number }> {
  const take = Math.min(filter.take ?? 100, 500);
  return withTenant(ctx, async (tx) => {
    const where = {
      tenantId: ctx.tenantId,
      ...(filter.supplierId ? { supplierId: filter.supplierId } : {}),
      ...(filter.variantId
        ? { variantId: filter.variantId }
        : filter.includeVariants
          ? {}
          : { variantId: null }),
    };
    const [rows, total] = await Promise.all([
      tx.supplierLeadTime.findMany({
        where,
        orderBy: [{ sampleCount: 'desc' }, { meanDays: 'desc' }],
        take,
        include: {
          supplier: { select: { name: true } },
          variant: { select: { sku: true } },
        },
      }),
      tx.supplierLeadTime.count({ where }),
    ]);
    return { items: rows.map(toLeadTimeRow), total };
  });
}

function toLeadTimeRow(row: {
  supplierId: string;
  variantId: string | null;
  sampleCount: number;
  meanDays: unknown;
  stdDevDays: unknown;
  minDays: number;
  maxDays: number;
  promisedDays: number | null;
  onTimeRate: unknown;
  lastReceiptAt: Date | null;
  measuredAt: Date;
  supplier?: { name: string | null } | null;
  variant?: { sku: string | null } | null;
}): LeadTimeRow {
  const meanDays = num(row.meanDays);
  return {
    supplierId: row.supplierId,
    supplierName: row.supplier?.name ?? null,
    variantId: row.variantId,
    variantSku: row.variant?.sku ?? null,
    sampleCount: row.sampleCount,
    meanDays,
    stdDevDays: num(row.stdDevDays),
    minDays: row.minDays,
    maxDays: row.maxDays,
    promisedDays: row.promisedDays,
    onTimeRate: row.onTimeRate === null ? null : num(row.onTimeRate),
    varianceDays: row.promisedDays === null ? null : round2(meanDays - row.promisedDays),
    isReliable: row.sampleCount >= MIN_RELIABLE_SAMPLES,
    lastReceiptAt: row.lastReceiptAt?.toISOString() ?? null,
    measuredAt: row.measuredAt.toISOString(),
  };
}

export interface ResolvedLeadTime {
  days: number;
  stdDevDays: number;
  source: 'measured' | 'supplier' | 'level' | 'default';
  sampleCount: number;
  supplierId: string | null;
}

/** What the platform assumes when nothing at all is known. Two weeks is the
 *  category's rule of thumb and it is at least not zero, which would produce a
 *  reorder point of "buy when you run out". */
export const DEFAULT_LEAD_TIME_DAYS = 14;

/**
 * The lead time to plan one level with, and where it came from.
 *
 * The order is measured (enough samples) → the supplier's stated figure → the
 * level's own → the platform default. `source` travels with the number all the
 * way to the screen, because "measured across 14 deliveries" and "the default
 * because we know nothing about this item" must not look the same.
 *
 * Only the MEASURED branch carries a σ. A stated lead time has no variance to
 * report — not a variance of zero, which would claim the supplier is
 * metronomic — so safety stock falls back to the demand term alone, which is
 * exactly what a tool with no measurements can honestly do.
 */
export async function resolveLeadTimeOnTx(
  tx: TxClient,
  params: {
    tenantId: string;
    variantId: string;
    warehouseId: string;
    levelLeadTimeDays: number | null;
  }
): Promise<ResolvedLeadTime> {
  const rows = await tx.$queryRaw<
    {
      supplierId: string | null;
      statedDays: number | null;
      measuredDays: number | null;
      measuredStdDev: number | null;
      sampleCount: number | null;
    }[]
  >`
    SELECT
      sup.supplier_id                        AS "supplierId",
      sup.lead_time_days                     AS "statedDays",
      COALESCE(lt_variant.mean_days, lt_all.mean_days)::float8       AS "measuredDays",
      COALESCE(lt_variant.std_dev_days, lt_all.std_dev_days)::float8 AS "measuredStdDev",
      COALESCE(lt_variant.sample_count, lt_all.sample_count)::int    AS "sampleCount"
    FROM (
      SELECT s.id AS supplier_id, s.lead_time_days
      FROM inventory_supplier_variants sv
      JOIN inventory_suppliers s ON s.id = sv.supplier_id
      WHERE sv.tenant_id = ${params.tenantId}::uuid
        AND sv.variant_id = ${params.variantId}::uuid
        AND s.deleted_at IS NULL AND s.is_active = true
      ORDER BY sv.is_preferred DESC, sv.unit_cost_cents ASC NULLS LAST
      LIMIT 1
    ) sup
    LEFT JOIN inventory_supplier_lead_times lt_variant
      ON lt_variant.tenant_id = ${params.tenantId}::uuid
     AND lt_variant.supplier_id = sup.supplier_id
     AND lt_variant.variant_id = ${params.variantId}::uuid
     AND lt_variant.sample_count >= ${MIN_RELIABLE_SAMPLES}
    LEFT JOIN inventory_supplier_lead_times lt_all
      ON lt_all.tenant_id = ${params.tenantId}::uuid
     AND lt_all.supplier_id = sup.supplier_id
     AND lt_all.variant_id IS NULL
     AND lt_all.sample_count >= ${MIN_RELIABLE_SAMPLES}
  `;

  const row = rows[0];
  const measured = row?.measuredDays ?? null;
  if (row && measured !== null && measured > 0) {
    return {
      days: round2(measured),
      stdDevDays: round2(row.measuredStdDev ?? 0),
      source: 'measured',
      sampleCount: row.sampleCount ?? 0,
      supplierId: row.supplierId,
    };
  }
  if (row?.statedDays != null && row.statedDays > 0) {
    return {
      days: row.statedDays,
      stdDevDays: 0,
      source: 'supplier',
      sampleCount: 0,
      supplierId: row.supplierId,
    };
  }
  if (params.levelLeadTimeDays != null && params.levelLeadTimeDays > 0) {
    return {
      days: params.levelLeadTimeDays,
      stdDevDays: 0,
      source: 'level',
      sampleCount: 0,
      supplierId: row?.supplierId ?? null,
    };
  }
  return {
    days: DEFAULT_LEAD_TIME_DAYS,
    stdDevDays: 0,
    source: 'default',
    sampleCount: 0,
    supplierId: row?.supplierId ?? null,
  };
}

// ─── helpers ─────────────────────────────────────────────────────────────────

function push<K, V>(map: Map<K, V[]>, key: K, value: V): void {
  const existing = map.get(key);
  if (existing) existing.push(value);
  else map.set(key, [value]);
}

function num(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function round2(n: number): number {
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
}

function round4(n: number): number {
  return Number.isFinite(n) ? Math.round(n * 10_000) / 10_000 : 0;
}
