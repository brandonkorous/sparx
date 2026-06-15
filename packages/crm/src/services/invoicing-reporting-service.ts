// invoicingReportingService — read-only invoicing cashflow metrics for the
// Invoicing overview's "collected over time" chart (docs/87 §8, docs/97 §5).
//
// The chart reads daily buckets from the `rollup_invoicing_daily_collected`
// table (pre-aggregated nightly by the reconcile below) for closed days, and
// recomputes the most recent open day(s) live so "today" is always fresh — no
// event-increment worker needed. Two independent daily series share one calendar
// axis: cash COLLECTED (billing_document_payments by received_at, net of refunds)
// and amount BILLED (billing_documents by finalized_at). The mechanics mirror
// commerce's revenueTimeseries (the reference implementation); invoicing differs
// only in deriving each day from two source tables instead of one.

import { withTenant, type TxClient } from '@sparx/db';

import type { ServiceContext } from '../errors';

const DEFAULT_CURRENCY = 'USD';

export interface DateRange {
  from: string; // ISO
  to: string; // ISO
}

export type RollupGrain = 'day' | 'week' | 'month';

export interface CollectedTimeseriesPoint {
  /** Start of the bucket, UTC date `YYYY-MM-DD`. */
  bucket: string;
  paymentsCount: number;
  invoicesCount: number;
  collectedCents: number;
  refundedCents: number;
  billedCents: number;
}

export interface CollectedTimeseries {
  range: { from: string; to: string; grain: RollupGrain };
  points: CollectedTimeseriesPoint[];
  totals: {
    paymentsCount: number;
    invoicesCount: number;
    collectedCents: number;
    refundedCents: number;
    billedCents: number;
  };
  currency: string;
}

export interface CollectedRollupReconcileResult {
  /** Days with at least one payment or finalized document in the window. */
  days: number;
  collectedCents: number;
  billedCents: number;
  windowStart: string;
}

// How many trailing days the read recomputes live on every call (today +
// yesterday at 1). The reconcile writes these too, but the live overlay wins so
// a payment recorded today shows up without waiting for the nightly job.
const OVERLAY_DAYS = 1;

// Trailing window the nightly reconcile recomputes from source-of-truth tables.
// At Phase-1 volumes this effectively recomputes all history each night (and is
// the one-shot backfill); narrow it once per-tenant document counts grow large.
const DEFAULT_RECONCILE_DAYS = 400;

const ZERO_MEASURES = {
  paymentsCount: 0,
  invoicesCount: 0,
  collectedCents: 0,
  refundedCents: 0,
  billedCents: 0,
} as const;

interface DayMeasures {
  paymentsCount: number;
  invoicesCount: number;
  collectedCents: number;
  refundedCents: number;
  billedCents: number;
}

interface DayRow extends DayMeasures {
  /** UTC date key `YYYY-MM-DD`. */
  key: string;
  /** UTC-midnight Date for the bucket (used as the rollup PK value). */
  date: Date;
}

function startOfUtcDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function addUtcDays(d: Date, n: number): Date {
  return new Date(d.getTime() + n * 86_400_000);
}

function utcDateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function eachUtcDay(from: Date, to: Date): Date[] {
  const out: Date[] = [];
  const end = startOfUtcDay(to).getTime();
  for (let d = startOfUtcDay(from); d.getTime() <= end; d = addUtcDays(d, 1)) out.push(d);
  return out;
}

// Handles the several shapes a Decimal SUM can take back from $queryRaw
// (Prisma.Decimal | string | number | bigint) → integer cents.
function rawToCents(v: unknown): number {
  if (v == null) return 0;
  if (typeof v === 'number') return Math.round(v * 100);
  if (typeof v === 'bigint') return Number(v) * 100;
  if (typeof v === 'string') {
    const n = Number.parseFloat(v);
    return Number.isFinite(n) ? Math.round(n * 100) : 0;
  }
  if (typeof v === 'object' && 'toNumber' in v && typeof v.toNumber === 'function') {
    return Math.round((v as { toNumber(): number }).toNumber() * 100);
  }
  return 0;
}

interface RawPaymentDayRow {
  bucket: Date;
  payments_count: number;
  gross_collected: unknown;
  refunded: unknown;
}

interface RawBilledDayRow {
  bucket: Date;
  invoices_count: number;
  billed: unknown;
}

// One pass per source table over the window, merged by UTC day. Payments are
// bucketed by `received_at` (net cash = deposits + payments − refunds); billed
// documents by `finalized_at`. RLS scopes both reads to the tenant. Shared by
// the live overlay/cold-start in collectedTimeseries and by the nightly
// reconcile.
async function aggregateCollectedByDay(
  tx: TxClient,
  from: Date,
  toExclusive: Date
): Promise<DayRow[]> {
  const [payments, billed] = await Promise.all([
    tx.$queryRaw<RawPaymentDayRow[]>`
      SELECT
        (received_at AT TIME ZONE 'UTC')::date              AS bucket,
        COUNT(*) FILTER (WHERE kind <> 'refund')::int       AS payments_count,
        COALESCE(SUM(amount) FILTER (WHERE kind <> 'refund'), 0) AS gross_collected,
        COALESCE(SUM(amount) FILTER (WHERE kind = 'refund'), 0)  AS refunded
      FROM billing_document_payments
      WHERE received_at >= ${from}
        AND received_at < ${toExclusive}
      GROUP BY 1
    `,
    tx.$queryRaw<RawBilledDayRow[]>`
      SELECT
        (finalized_at AT TIME ZONE 'UTC')::date AS bucket,
        COUNT(*)::int                           AS invoices_count,
        COALESCE(SUM(total), 0)                 AS billed
      FROM billing_documents
      WHERE deleted_at IS NULL
        AND voided_at IS NULL
        AND finalized_at IS NOT NULL
        AND finalized_at >= ${from}
        AND finalized_at < ${toExclusive}
      GROUP BY 1
    `,
  ]);

  const byKey = new Map<string, DayRow>();
  const rowFor = (bucket: Date): DayRow => {
    const date = startOfUtcDay(new Date(bucket));
    const key = utcDateKey(date);
    let row = byKey.get(key);
    if (!row) {
      row = { key, date, ...ZERO_MEASURES };
      byKey.set(key, row);
    }
    return row;
  };

  for (const p of payments) {
    const row = rowFor(p.bucket);
    row.paymentsCount = Number(p.payments_count ?? 0);
    row.refundedCents = rawToCents(p.refunded);
    row.collectedCents = rawToCents(p.gross_collected) - row.refundedCents;
  }
  for (const b of billed) {
    const row = rowFor(b.bucket);
    row.invoicesCount = Number(b.invoices_count ?? 0);
    row.billedCents = rawToCents(b.billed);
  }

  return [...byKey.values()].sort((a, b) => (a.key < b.key ? -1 : 1));
}

function bucketStartFor(dateKey: string, grain: 'week' | 'month'): string {
  const d = new Date(`${dateKey}T00:00:00.000Z`);
  if (grain === 'month') {
    return utcDateKey(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)));
  }
  // ISO week: snap back to Monday.
  const deltaToMonday = (d.getUTCDay() + 6) % 7;
  return utcDateKey(addUtcDays(startOfUtcDay(d), -deltaToMonday));
}

function foldByGrain(
  daily: CollectedTimeseriesPoint[],
  grain: 'week' | 'month'
): CollectedTimeseriesPoint[] {
  const map = new Map<string, CollectedTimeseriesPoint>();
  for (const p of daily) {
    const key = bucketStartFor(p.bucket, grain);
    const cur = map.get(key);
    if (cur) {
      cur.paymentsCount += p.paymentsCount;
      cur.invoicesCount += p.invoicesCount;
      cur.collectedCents += p.collectedCents;
      cur.refundedCents += p.refundedCents;
      cur.billedCents += p.billedCents;
    } else {
      map.set(key, { ...p, bucket: key });
    }
  }
  return [...map.values()].sort((a, b) => (a.bucket < b.bucket ? -1 : 1));
}

export async function collectedTimeseries(
  ctx: ServiceContext,
  input: { range: DateRange; grain?: RollupGrain }
): Promise<CollectedTimeseries> {
  const grain = input.grain ?? 'day';
  const from = startOfUtcDay(new Date(input.range.from));
  const to = startOfUtcDay(new Date(input.range.to));
  // First day served live (recomputed on every read). Everything before it is a
  // closed day read from the rollup.
  const overlayStart = addUtcDays(startOfUtcDay(new Date()), -OVERLAY_DAYS);

  return withTenant(ctx, async (tx) => {
    const toExclusive = addUtcDays(to, 1);
    const closedToExclusive = new Date(Math.min(toExclusive.getTime(), overlayStart.getTime()));
    const byKey = new Map<string, DayMeasures>();

    // 1) Closed days from the rollup. Cold-start fallback: if the rollup hasn't
    //    been reconciled yet, aggregate the closed window live so a fresh deploy
    //    still serves real history immediately (cheap at Phase-1 volumes).
    if (closedToExclusive.getTime() > from.getTime()) {
      const rollup = await tx.rollupInvoicingDailyCollected.findMany({
        where: { bucket: { gte: from, lt: closedToExclusive } },
        orderBy: { bucket: 'asc' },
      });
      if (rollup.length > 0) {
        for (const r of rollup) {
          byKey.set(utcDateKey(startOfUtcDay(new Date(r.bucket))), {
            paymentsCount: r.paymentsCount,
            invoicesCount: r.invoicesCount,
            collectedCents: Number(r.collectedCents),
            refundedCents: Number(r.refundedCents),
            billedCents: Number(r.billedCents),
          });
        }
      } else {
        for (const d of await aggregateCollectedByDay(tx, from, closedToExclusive)) {
          byKey.set(d.key, d);
        }
      }
    }

    // 2) Open days (today + yesterday) always recomputed live so they're fresh.
    const overlayFrom = new Date(Math.max(from.getTime(), overlayStart.getTime()));
    if (toExclusive.getTime() > overlayFrom.getTime()) {
      for (const d of await aggregateCollectedByDay(tx, overlayFrom, toExclusive)) {
        byKey.set(d.key, d);
      }
    }

    // 3) Continuous, zero-filled daily series so the chart has a clean axis.
    const daily: CollectedTimeseriesPoint[] = eachUtcDay(from, to).map((d) => ({
      bucket: utcDateKey(d),
      ...(byKey.get(utcDateKey(d)) ?? ZERO_MEASURES),
    }));

    const points = grain === 'day' ? daily : foldByGrain(daily, grain);
    const totals = daily.reduce(
      (acc, p) => ({
        paymentsCount: acc.paymentsCount + p.paymentsCount,
        invoicesCount: acc.invoicesCount + p.invoicesCount,
        collectedCents: acc.collectedCents + p.collectedCents,
        refundedCents: acc.refundedCents + p.refundedCents,
        billedCents: acc.billedCents + p.billedCents,
      }),
      { paymentsCount: 0, invoicesCount: 0, collectedCents: 0, refundedCents: 0, billedCents: 0 }
    );

    return {
      range: { from: utcDateKey(from), to: utcDateKey(to), grain },
      points,
      totals,
      currency: DEFAULT_CURRENCY,
    };
  });
}

// Nightly maintenance (docs/97 §5): recompute the trailing window from payments
// + finalized documents and overwrite the rollup. Delete-then-insert the window
// so late refunds / voids against older days self-heal in one pass. Run once
// over full history, this is also the backfill. Invoked per active tenant by
// `/internal/invoicing/collected-rollup`.
export async function reconcileCollectedRollup(
  ctx: ServiceContext,
  opts?: { sinceDays?: number }
): Promise<CollectedRollupReconcileResult> {
  const sinceDays = Math.max(0, opts?.sinceDays ?? DEFAULT_RECONCILE_DAYS);
  const today = startOfUtcDay(new Date());
  const windowStart = addUtcDays(today, -sinceDays);
  const toExclusive = addUtcDays(today, 1); // include today

  return withTenant(ctx, async (tx) => {
    const rows = await aggregateCollectedByDay(tx, windowStart, toExclusive);

    await tx.rollupInvoicingDailyCollected.deleteMany({ where: { bucket: { gte: windowStart } } });
    if (rows.length > 0) {
      await tx.rollupInvoicingDailyCollected.createMany({
        data: rows.map((r) => ({
          tenantId: ctx.tenantId,
          bucket: r.date,
          paymentsCount: r.paymentsCount,
          invoicesCount: r.invoicesCount,
          collectedCents: BigInt(r.collectedCents),
          refundedCents: BigInt(r.refundedCents),
          billedCents: BigInt(r.billedCents),
        })),
      });
    }

    return {
      days: rows.length,
      collectedCents: rows.reduce((s, r) => s + r.collectedCents, 0),
      billedCents: rows.reduce((s, r) => s + r.billedCents, 0),
      windowStart: utcDateKey(windowStart),
    };
  });
}
