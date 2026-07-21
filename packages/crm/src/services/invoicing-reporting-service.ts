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

import { Prisma, withTenant, type TxClient } from '@sparx/db';

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

// Per-property variants (docs/131 §6): the reconcile pass carries the site each
// row belongs to. Non-nullable — the site is always resolvable (see
// aggregateCollectedByDayPerProperty).
interface RawPaymentDayPropRow extends RawPaymentDayRow {
  property_id: string;
}

interface RawBilledDayPropRow extends RawBilledDayRow {
  property_id: string;
}

// One pass per source table over the window, merged by UTC day, SCOPED for a
// read (docs/131 §6). Payments are bucketed by `received_at` (net cash =
// deposits + payments − refunds); billed documents by `finalized_at`.
// `propertyId` undefined = every site (the tenant-wide total); a value = only
// that site's cashflow. The site is authoritative on `billing_documents`:
// `billing_document_payments.property_id` is nullable and untrusted, so each
// payment is JOINed to its parent document (`document_id` → `billing_documents`)
// and filtered/grouped by the DOCUMENT's non-null `property_id`. RLS scopes both
// reads to the tenant. Shared by the live overlay/cold-start in
// collectedTimeseries.
async function aggregateCollectedByDay(
  tx: TxClient,
  from: Date,
  toExclusive: Date,
  propertyId?: string
): Promise<DayRow[]> {
  const [payments, billed] = await Promise.all([
    tx.$queryRaw<RawPaymentDayRow[]>`
      SELECT
        (p.received_at AT TIME ZONE 'UTC')::date              AS bucket,
        COUNT(*) FILTER (WHERE p.kind <> 'refund')::int       AS payments_count,
        COALESCE(SUM(p.amount) FILTER (WHERE p.kind <> 'refund'), 0) AS gross_collected,
        COALESCE(SUM(p.amount) FILTER (WHERE p.kind = 'refund'), 0)  AS refunded
      FROM billing_document_payments p
      JOIN billing_documents d ON d.id = p.document_id
      WHERE p.received_at >= ${from}
        AND p.received_at < ${toExclusive}
        ${propertyId ? Prisma.sql`AND d.property_id = ${propertyId}::uuid` : Prisma.empty}
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
        ${propertyId ? Prisma.sql`AND property_id = ${propertyId}::uuid` : Prisma.empty}
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

// The per-PROPERTY pass the nightly reconcile writes (docs/131 §6): one row per
// (site, day) across BOTH source series, merged by (property, day). Unlike the
// commerce revenue rollup, `RollupInvoicingDailyCollected.propertyId` is NON-NULL
// — the site is ALWAYS resolvable because `billing_documents.property_id` is not
// null, so there is no unattributed bucket here. Payments inherit the site from
// their parent document (JOIN on `document_id`, never the payment's own nullable
// `property_id`); billed documents group by their own `property_id`. GROUP BY the
// site so every business's daily figures are stored separately and a per-site
// read is an indexed lookup, not a re-scan.
async function aggregateCollectedByDayPerProperty(
  tx: TxClient,
  from: Date,
  toExclusive: Date
): Promise<(DayRow & { propertyId: string })[]> {
  const [payments, billed] = await Promise.all([
    tx.$queryRaw<RawPaymentDayPropRow[]>`
      SELECT
        d.property_id                                        AS property_id,
        (p.received_at AT TIME ZONE 'UTC')::date              AS bucket,
        COUNT(*) FILTER (WHERE p.kind <> 'refund')::int       AS payments_count,
        COALESCE(SUM(p.amount) FILTER (WHERE p.kind <> 'refund'), 0) AS gross_collected,
        COALESCE(SUM(p.amount) FILTER (WHERE p.kind = 'refund'), 0)  AS refunded
      FROM billing_document_payments p
      JOIN billing_documents d ON d.id = p.document_id
      WHERE p.received_at >= ${from}
        AND p.received_at < ${toExclusive}
      GROUP BY d.property_id, 2
    `,
    tx.$queryRaw<RawBilledDayPropRow[]>`
      SELECT
        property_id                             AS property_id,
        (finalized_at AT TIME ZONE 'UTC')::date AS bucket,
        COUNT(*)::int                           AS invoices_count,
        COALESCE(SUM(total), 0)                 AS billed
      FROM billing_documents
      WHERE deleted_at IS NULL
        AND voided_at IS NULL
        AND finalized_at IS NOT NULL
        AND finalized_at >= ${from}
        AND finalized_at < ${toExclusive}
      GROUP BY property_id, 2
    `,
  ]);

  const byKey = new Map<string, DayRow & { propertyId: string }>();
  const rowFor = (propertyId: string, bucket: Date): DayRow & { propertyId: string } => {
    const date = startOfUtcDay(new Date(bucket));
    const dayKey = utcDateKey(date);
    // (property, day) composite key — the space joiner can never appear in a UUID
    // or a `YYYY-MM-DD` string, so it cannot alias two distinct pairs.
    const mapKey = `${propertyId} ${dayKey}`;
    let row = byKey.get(mapKey);
    if (!row) {
      row = { key: dayKey, date, propertyId, ...ZERO_MEASURES };
      byKey.set(mapKey, row);
    }
    return row;
  };

  for (const p of payments) {
    const row = rowFor(p.property_id, p.bucket);
    row.paymentsCount = Number(p.payments_count ?? 0);
    row.refundedCents = rawToCents(p.refunded);
    row.collectedCents = rawToCents(p.gross_collected) - row.refundedCents;
  }
  for (const b of billed) {
    const row = rowFor(b.property_id, b.bucket);
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

// Sum a day's measures into the bucket map. Accumulates rather than overwrites
// because the all-sites read (docs/131 §6) now finds MULTIPLE rollup rows per
// bucket — one per site — that must add up to the tenant total. The closed and
// open windows stay disjoint, so this never double-counts across them.
function addCollectedMeasures(byKey: Map<string, DayMeasures>, key: string, m: DayMeasures): void {
  const cur = byKey.get(key);
  byKey.set(
    key,
    cur
      ? {
          paymentsCount: cur.paymentsCount + m.paymentsCount,
          invoicesCount: cur.invoicesCount + m.invoicesCount,
          collectedCents: cur.collectedCents + m.collectedCents,
          refundedCents: cur.refundedCents + m.refundedCents,
          billedCents: cur.billedCents + m.billedCents,
        }
      : { ...m }
  );
}

export async function collectedTimeseries(
  ctx: ServiceContext,
  input: { range: DateRange; grain?: RollupGrain; propertyId?: string }
): Promise<CollectedTimeseries> {
  const grain = input.grain ?? 'day';
  const propertyId = input.propertyId;
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
    //    Per-site (docs/131 §6): filter to the one site, or read every site row
    //    and let addCollectedMeasures sum them back to the tenant total.
    if (closedToExclusive.getTime() > from.getTime()) {
      const rollup = await tx.rollupInvoicingDailyCollected.findMany({
        where: {
          bucket: { gte: from, lt: closedToExclusive },
          ...(propertyId ? { propertyId } : {}),
        },
        orderBy: { bucket: 'asc' },
      });
      if (rollup.length > 0) {
        for (const r of rollup) {
          addCollectedMeasures(byKey, utcDateKey(startOfUtcDay(new Date(r.bucket))), {
            paymentsCount: r.paymentsCount,
            invoicesCount: r.invoicesCount,
            collectedCents: Number(r.collectedCents),
            refundedCents: Number(r.refundedCents),
            billedCents: Number(r.billedCents),
          });
        }
      } else {
        for (const d of await aggregateCollectedByDay(tx, from, closedToExclusive, propertyId)) {
          addCollectedMeasures(byKey, d.key, d);
        }
      }
    }

    // 2) Open days (today + yesterday) always recomputed live so they're fresh.
    const overlayFrom = new Date(Math.max(from.getTime(), overlayStart.getTime()));
    if (toExclusive.getTime() > overlayFrom.getTime()) {
      for (const d of await aggregateCollectedByDay(tx, overlayFrom, toExclusive, propertyId)) {
        addCollectedMeasures(byKey, d.key, d);
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
    // Per (property, day) rows (docs/131 §6). Delete-then-insert the whole window
    // for the tenant regardless of property — every site's rows are rewritten in
    // one pass, so a late refund/void on any site self-heals and a site with no
    // activity that day simply has no row.
    const rows = await aggregateCollectedByDayPerProperty(tx, windowStart, toExclusive);

    await tx.rollupInvoicingDailyCollected.deleteMany({ where: { bucket: { gte: windowStart } } });
    if (rows.length > 0) {
      await tx.rollupInvoicingDailyCollected.createMany({
        data: rows.map((r) => ({
          tenantId: ctx.tenantId,
          propertyId: r.propertyId,
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

// ─── Collections summary + days-to-pay + debtors (live aggregates) ───
//
// Point-in-time summaries read live (not rollup-backed): the working sets — open
// documents, recent payments, recently-paid docs — are small and every query
// rides an existing index (`[tenantId, status, dueAt]`, `[tenantId, documentId,
// receivedAt]`). Powers the Invoicing overview's Collections card, the Avg-
// days-to-pay KPI, the open-balance-by-stage breakdown, and the "who owes you"
// debtor list. Money in the source tables is Decimal *dollars*; everything here
// surfaces integer cents to match the rest of the reporting layer.

// How far back recently-paid documents are sampled for the days-to-pay figure.
// A trailing window keeps the metric reflective of *current* paying behaviour
// rather than dragging in years-old settlements.
const DAYS_TO_PAY_WINDOW = 180;

function dollarsToCents(v: unknown): number {
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

function rawFloat(v: unknown): number | null {
  if (v == null) return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v === 'string') {
    const n = Number.parseFloat(v);
    return Number.isFinite(n) ? n : null;
  }
  if (typeof v === 'object' && 'toNumber' in v && typeof v.toNumber === 'function') {
    return (v as { toNumber(): number }).toNumber();
  }
  return null;
}

export interface CollectionsSummary {
  collectedThisMonthCents: number;
  collectedLastMonthCents: number;
  /** Documents settled in full in the last 30 days. */
  paidInFull: { count: number; totalCents: number };
  /** Deposits currently held against still-open documents. */
  depositsCents: number;
  avgDaysToPay: number | null;
  medianDaysToPay: number | null;
  paidCount: number;
  /** Open balance split by document lifecycle: not-yet-finalized estimates,
   *  finalized-and-within-terms invoices, and past-due. */
  openBalance: {
    estimatesCents: number;
    estimatesCount: number;
    invoicedOpenCents: number;
    invoicedOpenCount: number;
    overdueCents: number;
    overdueCount: number;
  };
  currency: string;
}

interface RawCollected {
  this_month: unknown;
  last_month: unknown;
}
interface RawDaysToPay {
  avg_days: unknown;
  median_days: unknown;
  paid_count: number;
}
interface RawOpenBalance {
  est_cents: unknown;
  est_count: number;
  inv_cents: unknown;
  inv_count: number;
  ovd_cents: unknown;
  ovd_count: number;
}

export async function collectionsSummary(ctx: ServiceContext): Promise<CollectionsSummary> {
  return withTenant(ctx, async (tx) => {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86_400_000);
    const daysToPayStart = new Date(Date.now() - DAYS_TO_PAY_WINDOW * 86_400_000);

    const [collectedRows, daysRows, openRows, paidAgg, depositAgg] = await Promise.all([
      tx.$queryRaw<RawCollected[]>`
        SELECT
          COALESCE(SUM(CASE WHEN kind = 'refund' THEN -amount ELSE amount END)
            FILTER (WHERE received_at >= date_trunc('month', now())), 0) AS this_month,
          COALESCE(SUM(CASE WHEN kind = 'refund' THEN -amount ELSE amount END)
            FILTER (WHERE received_at >= date_trunc('month', now()) - interval '1 month'
                      AND received_at <  date_trunc('month', now())), 0) AS last_month
        FROM billing_document_payments
      `,
      tx.$queryRaw<RawDaysToPay[]>`
        SELECT
          AVG(EXTRACT(EPOCH FROM (paid_at - finalized_at)) / 86400.0)::float AS avg_days,
          (percentile_cont(0.5) WITHIN GROUP (
            ORDER BY EXTRACT(EPOCH FROM (paid_at - finalized_at)) / 86400.0))::float AS median_days,
          COUNT(*)::int AS paid_count
        FROM billing_documents
        WHERE status = 'paid'
          AND paid_at IS NOT NULL
          AND finalized_at IS NOT NULL
          AND paid_at >= finalized_at
          AND paid_at >= ${daysToPayStart}
          AND deleted_at IS NULL
          AND voided_at IS NULL
      `,
      tx.$queryRaw<RawOpenBalance[]>`
        SELECT
          COALESCE(SUM(total - amount_paid) FILTER (WHERE finalized_at IS NULL), 0)              AS est_cents,
          COUNT(*) FILTER (WHERE finalized_at IS NULL)::int                                       AS est_count,
          COALESCE(SUM(total - amount_paid) FILTER (
            WHERE finalized_at IS NOT NULL AND status <> 'overdue'
              AND (due_at IS NULL OR due_at >= now())), 0)                                         AS inv_cents,
          COUNT(*) FILTER (
            WHERE finalized_at IS NOT NULL AND status <> 'overdue'
              AND (due_at IS NULL OR due_at >= now()))::int                                        AS inv_count,
          COALESCE(SUM(total - amount_paid) FILTER (
            WHERE finalized_at IS NOT NULL
              AND (status = 'overdue' OR (due_at IS NOT NULL AND due_at < now()))), 0)             AS ovd_cents,
          COUNT(*) FILTER (
            WHERE finalized_at IS NOT NULL
              AND (status = 'overdue' OR (due_at IS NOT NULL AND due_at < now())))::int            AS ovd_count
        FROM billing_documents
        WHERE deleted_at IS NULL AND voided_at IS NULL
          AND status NOT IN ('paid', 'void')
          AND (total - amount_paid) > 0.005
      `,
      tx.billingDocument.aggregate({
        where: { status: 'paid', paidAt: { gte: thirtyDaysAgo }, deletedAt: null, voidedAt: null },
        _count: { _all: true },
        _sum: { total: true },
      }),
      tx.billingDocument.aggregate({
        where: { deletedAt: null, voidedAt: null, status: { notIn: ['paid', 'void'] } },
        _sum: { depositTotal: true },
      }),
    ]);

    const collected = collectedRows[0];
    const days = daysRows[0];
    const open = openRows[0];

    return {
      collectedThisMonthCents: dollarsToCents(collected?.this_month),
      collectedLastMonthCents: dollarsToCents(collected?.last_month),
      paidInFull: {
        count: paidAgg._count._all,
        totalCents: dollarsToCents(paidAgg._sum.total),
      },
      depositsCents: dollarsToCents(depositAgg._sum.depositTotal),
      avgDaysToPay:
        days?.avg_days != null ? Math.round((rawFloat(days.avg_days) ?? 0) * 10) / 10 : null,
      medianDaysToPay:
        days?.median_days != null ? Math.round((rawFloat(days.median_days) ?? 0) * 10) / 10 : null,
      paidCount: Number(days?.paid_count ?? 0),
      openBalance: {
        estimatesCents: dollarsToCents(open?.est_cents),
        estimatesCount: Number(open?.est_count ?? 0),
        invoicedOpenCents: dollarsToCents(open?.inv_cents),
        invoicedOpenCount: Number(open?.inv_count ?? 0),
        overdueCents: dollarsToCents(open?.ovd_cents),
        overdueCount: Number(open?.ovd_count ?? 0),
      },
      currency: DEFAULT_CURRENCY,
    };
  });
}

export interface DebtorRow {
  customerId: string;
  name: string;
  openInvoices: number;
  outstandingCents: number;
  /** Days past the oldest overdue document's due date; null if none past due. */
  oldestOverdueDays: number | null;
}

interface RawDebtor {
  customer_id: string;
  open_invoices: number;
  outstanding: unknown;
  oldest_days: unknown;
}

export async function customerBreakdown(
  ctx: ServiceContext,
  opts?: { limit?: number }
): Promise<DebtorRow[]> {
  const limit = Math.min(Math.max(opts?.limit ?? 5, 1), 50);

  return withTenant(ctx, async (tx) => {
    const rows = await tx.$queryRaw<RawDebtor[]>`
      SELECT
        customer_id,
        COUNT(*)::int                  AS open_invoices,
        COALESCE(SUM(total - amount_paid), 0) AS outstanding,
        MAX(CASE WHEN due_at IS NOT NULL AND due_at < now()
              THEN EXTRACT(EPOCH FROM (now() - due_at)) / 86400.0 ELSE NULL END) AS oldest_days
      FROM billing_documents
      WHERE deleted_at IS NULL AND voided_at IS NULL
        AND status NOT IN ('paid', 'void')
        AND (total - amount_paid) > 0.005
        AND customer_id IS NOT NULL
      GROUP BY customer_id
      ORDER BY outstanding DESC
      LIMIT ${limit}
    `;
    if (rows.length === 0) return [];

    const customers = await tx.customer.findMany({
      where: { id: { in: rows.map((r) => r.customer_id) } },
      select: { id: true, firstName: true, lastName: true, email: true },
    });
    const byId = new Map(customers.map((c) => [c.id, c]));

    return rows.map((r) => {
      const c = byId.get(r.customer_id);
      const joined = c ? [c.firstName, c.lastName].filter(Boolean).join(' ').trim() : '';
      const name = joined.length > 0 ? joined : (c?.email ?? '—');
      const oldest = rawFloat(r.oldest_days);
      return {
        customerId: r.customer_id,
        name,
        openInvoices: Number(r.open_invoices ?? 0),
        outstandingCents: dollarsToCents(r.outstanding),
        oldestOverdueDays: oldest != null ? Math.floor(oldest) : null,
      };
    });
  });
}
