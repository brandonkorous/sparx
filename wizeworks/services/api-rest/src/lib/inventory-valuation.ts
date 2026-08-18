// Inventory valuation snapshots (docs/97 §5) — the "value over time" series on
// the Inventory overview.
//
// Valuation is captured as a daily SNAPSHOT: the nightly cron upserts today's
// row, and the read live-overlays today's current valuation so the chart is fresh
// before tonight's run. We snapshot (rather than reconstruct from the movement
// ledger) because a past day's value depends on that day's moving-average cost
// basis, which isn't cheaply reconstructable — so the series builds forward from
// first capture (no historical backfill).
//
// The computation reads the MASTER stock model (inventory_levels, docs/100 P1c)
// and mirrors the live `/v1/inventory/reports/summary` valuation exactly: cost =
// Σ(on_hand × moving-average cost), retail = Σ(on_hand × variant price). The cost
// basis falls back avg_cost_cents → unit_cost_cents → variant.cost_cents.
//
// Every function takes a tenant-scoped TxClient (caller wraps withTenant), so RLS
// isolates all reads/writes.

import type { TxClient } from '@wizeworks/db';

// ── UTC-day helpers ──────────────────────────────────────────────────
export function startOfUtcDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}
export function addUtcDays(d: Date, n: number): Date {
  return new Date(d.getTime() + n * 86_400_000);
}
function utcDateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export interface Valuation {
  totalUnits: number;
  totalCostCents: number;
  totalRetailCents: number;
}

interface ValuationRow {
  totalUnits: bigint;
  totalCostCents: bigint;
  totalRetailCents: bigint;
}

/** Current inventory valuation: total on-hand units + value at cost / retail.
 *  Reads the master inventory_levels, costing each level at its moving-average
 *  basis (avg → unit → variant cost), retail at the variant price. Excludes
 *  archived warehouses + deleted variants. */
export async function computeValuation(tx: TxClient): Promise<Valuation> {
  const [row] = await tx.$queryRaw<ValuationRow[]>`
    SELECT
      COALESCE(SUM(l.on_hand), 0)::bigint AS "totalUnits",
      COALESCE(SUM(l.on_hand * COALESCE(l.avg_cost_cents, l.unit_cost_cents, v.cost_cents, 0)), 0)::bigint AS "totalCostCents",
      COALESCE(SUM(l.on_hand * v.price_cents), 0)::bigint AS "totalRetailCents"
    FROM inventory_levels l
    JOIN commerce_product_variants v ON v.id = l.variant_id AND v.deleted_at IS NULL
    JOIN inventory_warehouses w ON w.id = l.warehouse_id AND w.deleted_at IS NULL
  `;
  return {
    totalUnits: Number(row?.totalUnits ?? 0),
    totalCostCents: Number(row?.totalCostCents ?? 0),
    totalRetailCents: Number(row?.totalRetailCents ?? 0),
  };
}

/** Capture today's valuation as an immutable daily snapshot (upsert). */
export async function snapshotInventoryValuation(
  tx: TxClient,
  tenantId: string,
  bucket: Date
): Promise<Valuation> {
  const v = await computeValuation(tx);
  const data = {
    totalUnits: v.totalUnits,
    totalCostCents: BigInt(v.totalCostCents),
    totalRetailCents: BigInt(v.totalRetailCents),
  };
  await tx.rollupInventoryDailyValuation.upsert({
    where: { tenantId_bucket: { tenantId, bucket } },
    create: { tenantId, bucket, ...data },
    update: data,
  });
  return v;
}

// ── Read (snapshots + live-overlay today) ────────────────────────────
export interface ValuationPoint {
  bucket: string;
  units: number;
  costCents: number;
  retailCents: number;
}
export interface ValuationTimeseries {
  range: { from: string; to: string };
  points: ValuationPoint[];
}

export async function valuationTimeseries(
  tx: TxClient,
  from: Date,
  to: Date,
  toExclusive: Date
): Promise<ValuationTimeseries> {
  const rows = await tx.rollupInventoryDailyValuation.findMany({
    where: { bucket: { gte: from, lt: toExclusive } },
    orderBy: { bucket: 'asc' },
  });
  const byKey = new Map<string, ValuationPoint>();
  for (const r of rows) {
    const key = utcDateKey(startOfUtcDay(new Date(r.bucket)));
    byKey.set(key, {
      bucket: key,
      units: r.totalUnits,
      costCents: Number(r.totalCostCents),
      retailCents: Number(r.totalRetailCents),
    });
  }

  // Live-overlay today's current valuation if tonight's snapshot hasn't run yet.
  const today = startOfUtcDay(new Date());
  const todayKey = utcDateKey(today);
  if (
    today.getTime() >= from.getTime() &&
    today.getTime() < toExclusive.getTime() &&
    !byKey.has(todayKey)
  ) {
    const v = await computeValuation(tx);
    if (v.totalUnits > 0 || v.totalCostCents > 0) {
      byKey.set(todayKey, {
        bucket: todayKey,
        units: v.totalUnits,
        costCents: v.totalCostCents,
        retailCents: v.totalRetailCents,
      });
    }
  }

  return {
    range: { from: utcDateKey(from), to: utcDateKey(to) },
    points: [...byKey.values()].sort((a, b) => (a.bucket < b.bucket ? -1 : 1)),
  };
}
