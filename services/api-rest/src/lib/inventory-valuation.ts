// Inventory valuation snapshots (docs/97 §5) — the "value over time" series on
// the Inventory overview.
//
// Valuation is a POINT-IN-TIME measure: stock_levels carry only a current
// quantity (no per-day movement ledger), so a day's value can only be captured
// as of a run — there is no historical backfill. The nightly cron upserts
// today's snapshot; the read live-overlays the current valuation for today so the
// chart is fresh before tonight's run. The computation mirrors the live
// `/v1/inventory/reports/summary` valuation exactly (Σ on_hand × cost / retail).
//
// Every function takes a tenant-scoped TxClient (caller wraps withTenant), so RLS
// isolates all reads/writes.

import type { TxClient } from '@sparx/db';

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

/** Current inventory valuation: total on-hand units + value at cost / retail.
 *  Mirrors the summary report — sum on-hand per variant, join variant pricing. */
export async function computeValuation(tx: TxClient): Promise<Valuation> {
  const variantSums = await tx.stockLevel.groupBy({
    by: ['variantId'],
    _sum: { onHand: true },
  });
  const variantIds = variantSums.map((v) => v.variantId);
  const variants =
    variantIds.length > 0
      ? await tx.productVariant.findMany({
          where: { id: { in: variantIds } },
          select: { id: true, priceCents: true, costCents: true },
        })
      : [];
  const byId = new Map(variants.map((v) => [v.id, v]));

  let totalUnits = 0;
  let totalCostCents = 0;
  let totalRetailCents = 0;
  for (const vs of variantSums) {
    const onHand = vs._sum.onHand ?? 0;
    totalUnits += onHand;
    const v = byId.get(vs.variantId);
    if (v) {
      totalCostCents += (v.costCents ?? 0) * onHand;
      totalRetailCents += v.priceCents * onHand;
    }
  }
  return { totalUnits, totalCostCents, totalRetailCents };
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
