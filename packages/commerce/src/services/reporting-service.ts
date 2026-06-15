// reportingService — read-only metrics surfaced in the dashboard home,
// the analytics tab, and the MCP read tools.
//
// Every query runs live against the operational tables (orders, carts,
// subscriptions, inventory). Once a tenant's order volume justifies
// pre-aggregation, the same shapes will be served from a nightly
// rollup table populated by a worker — call sites are stable.
//
// Money: the CRM Order spine carries Decimal totals (dollars); the
// Commerce tables carry integer cents. Reports surface integer cents
// consistently so the dashboard doesn't have to juggle two formats.

import { withTenant, type TxClient } from '@sparx/db';

import type { ServiceContext } from '../errors';

const DEFAULT_CURRENCY = 'USD';

export interface DateRange {
  from: string; // ISO
  to: string; // ISO
}

function bounds(range: DateRange): { from: Date; to: Date } {
  return { from: new Date(range.from), to: new Date(range.to) };
}

function rangeLabel(range: DateRange): string {
  return `${range.from.slice(0, 10)} → ${range.to.slice(0, 10)}`;
}

function decimalToCents(d: { toNumber(): number } | number | null | undefined): number {
  if (d == null) return 0;
  const n = typeof d === 'number' ? d : d.toNumber();
  return Math.round(n * 100);
}

// ─── Revenue ─────────────────────────────────────────────────────────

export interface RevenueSummary {
  rangeLabel: string;
  ordersCount: number;
  grossRevenueCents: number;
  refundedCents: number;
  netRevenueCents: number;
  averageOrderValueCents: number;
  currency: string;
}

export async function revenueSummary(
  ctx: ServiceContext,
  range: DateRange
): Promise<RevenueSummary> {
  const { from, to } = bounds(range);

  return withTenant(ctx, async (tx) => {
    const agg = await tx.order.aggregate({
      where: {
        placedAt: { gte: from, lte: to },
        status: { not: 'cancelled' },
      },
      _count: { _all: true },
      _sum: { total: true, refundTotal: true },
    });

    const gross = decimalToCents(agg._sum.total);
    const refunded = decimalToCents(agg._sum.refundTotal);
    const ordersCount = agg._count._all;

    return {
      rangeLabel: rangeLabel(range),
      ordersCount,
      grossRevenueCents: gross,
      refundedCents: refunded,
      netRevenueCents: gross - refunded,
      averageOrderValueCents: ordersCount > 0 ? Math.round(gross / ordersCount) : 0,
      currency: DEFAULT_CURRENCY,
    };
  });
}

// ─── Top products ────────────────────────────────────────────────────

export interface TopProductRow {
  productId: string;
  productTitle: string;
  unitsSold: number;
  revenueCents: number;
}

export async function topProducts(
  ctx: ServiceContext,
  input: { range: DateRange; limit?: number }
): Promise<TopProductRow[]> {
  const { from, to } = bounds(input.range);
  const limit = input.limit ?? 10;

  return withTenant(ctx, async (tx) => {
    // OrderItem has a nullable productId that points at the Commerce
    // product spine. We group by that, sum units + revenue, then join
    // back to Product for the title.
    const groups = await tx.orderItem.groupBy({
      by: ['productId'],
      where: {
        productId: { not: null },
        order: { placedAt: { gte: from, lte: to }, status: { not: 'cancelled' } },
      },
      _sum: { quantity: true, lineTotal: true },
      orderBy: { _sum: { lineTotal: 'desc' } },
      take: limit,
    });

    const productIds = groups.map((g) => g.productId).filter((id): id is string => id !== null);
    if (productIds.length === 0) return [];

    const products = await tx.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true, title: true },
    });
    const titleById = new Map(products.map((p) => [p.id, p.title]));

    return groups.map((g) => ({
      productId: g.productId ?? '',
      productTitle: g.productId ? (titleById.get(g.productId) ?? '—') : '—',
      unitsSold: g._sum?.quantity ?? 0,
      revenueCents: decimalToCents(g._sum?.lineTotal ?? null),
    }));
  });
}

// ─── Top customers ───────────────────────────────────────────────────

export interface TopCustomerRow {
  customerId: string;
  customerName: string;
  ordersCount: number;
  totalSpentCents: number;
}

export async function topCustomers(
  ctx: ServiceContext,
  input: { range: DateRange; limit?: number }
): Promise<TopCustomerRow[]> {
  const { from, to } = bounds(input.range);
  const limit = input.limit ?? 10;

  return withTenant(ctx, async (tx) => {
    const groups = await tx.order.groupBy({
      by: ['customerId'],
      where: {
        placedAt: { gte: from, lte: to },
        status: { not: 'cancelled' },
      },
      _count: { _all: true },
      _sum: { total: true },
      orderBy: { _sum: { total: 'desc' } },
      take: limit,
    });

    if (groups.length === 0) return [];

    const customerIds = groups.map((g) => g.customerId);
    const customers = await tx.customer.findMany({
      where: { id: { in: customerIds } },
      select: { id: true, name: true, email: true },
    });
    const byId = new Map(customers.map((c) => [c.id, c]));

    return groups.map((g) => {
      const c = byId.get(g.customerId);
      return {
        customerId: g.customerId,
        customerName: c?.name ?? c?.email ?? '—',
        ordersCount: g._count._all,
        totalSpentCents: decimalToCents(g._sum.total),
      };
    });
  });
}

// ─── Conversion funnel ───────────────────────────────────────────────

export interface ConversionFunnel {
  rangeLabel: string;
  sessions: number;
  cartsCreated: number;
  checkoutsStarted: number;
  ordersPlaced: number;
  cartToCheckoutRate: number;
  checkoutToOrderRate: number;
  overallConversion: number;
}

export async function conversionFunnel(
  ctx: ServiceContext,
  range: DateRange
): Promise<ConversionFunnel> {
  const { from, to } = bounds(range);

  return withTenant(ctx, async (tx) => {
    const [cartsCreated, checkoutsStarted, ordersPlaced] = await Promise.all([
      tx.cart.count({ where: { createdAt: { gte: from, lte: to } } }),
      tx.checkoutSession.count({ where: { createdAt: { gte: from, lte: to } } }),
      tx.order.count({
        where: { placedAt: { gte: from, lte: to }, status: { not: 'cancelled' } },
      }),
    ]);

    // Sessions tracking requires analytics tooling that hasn't landed
    // yet; surface as 0 + the existing funnel stages so the dashboard
    // strip works today and grows seamlessly when sessions arrive.
    const sessions = 0;
    const rate = (a: number, b: number) => (b > 0 ? a / b : 0);

    return {
      rangeLabel: rangeLabel(range),
      sessions,
      cartsCreated,
      checkoutsStarted,
      ordersPlaced,
      cartToCheckoutRate: rate(checkoutsStarted, cartsCreated),
      checkoutToOrderRate: rate(ordersPlaced, checkoutsStarted),
      overallConversion: rate(ordersPlaced, cartsCreated),
    };
  });
}

// ─── Abandoned carts ─────────────────────────────────────────────────

export interface AbandonedCartReport {
  rangeLabel: string;
  abandonedCount: number;
  recoveredCount: number;
  recoveryRate: number;
  recoveredRevenueCents: number;
}

export async function abandonedCarts(
  ctx: ServiceContext,
  range: DateRange
): Promise<AbandonedCartReport> {
  const { from, to } = bounds(range);

  return withTenant(ctx, async (tx) => {
    const [abandonedCount, recoveredAgg] = await Promise.all([
      tx.cart.count({
        where: { abandonedAt: { gte: from, lte: to } },
      }),
      tx.cart.aggregate({
        where: { recoveredAt: { gte: from, lte: to } },
        _count: { _all: true },
        _sum: { totalCents: true },
      }),
    ]);

    const recoveredCount = recoveredAgg._count._all;
    const totalLooked = abandonedCount + recoveredCount;

    return {
      rangeLabel: rangeLabel(range),
      abandonedCount,
      recoveredCount,
      recoveryRate: totalLooked > 0 ? recoveredCount / totalLooked : 0,
      recoveredRevenueCents: recoveredAgg._sum.totalCents ?? 0,
    };
  });
}

// ─── Subscription metrics ────────────────────────────────────────────

export interface SubscriptionMetrics {
  activeCount: number;
  mrrCents: number;
  churnedThisPeriod: number;
  newThisPeriod: number;
  currency: string;
}

export async function subscriptionMetrics(
  ctx: ServiceContext,
  range: DateRange
): Promise<SubscriptionMetrics> {
  const { from, to } = bounds(range);

  return withTenant(ctx, async (tx) => {
    const [active, churned, newInPeriod] = await Promise.all([
      tx.subscription.findMany({
        where: { status: { in: ['active', 'trialing', 'past_due'] } },
        include: { items: true },
      }),
      tx.subscription.count({
        where: { status: 'cancelled', cancelledAt: { gte: from, lte: to } },
      }),
      tx.subscription.count({
        where: { createdAt: { gte: from, lte: to } },
      }),
    ]);

    let mrrCents = 0;
    for (const sub of active) {
      const perCycle = sub.items.reduce((sum, it) => sum + it.unitPriceCents * it.quantity, 0);
      const factor = monthlyFactorFor(sub.intervalUnit, sub.intervalCount);
      mrrCents += Math.round(perCycle * sub.deliveriesPerCycle * factor);
    }

    return {
      activeCount: active.length,
      mrrCents,
      churnedThisPeriod: churned,
      newThisPeriod: newInPeriod,
      currency: active[0]?.currency ?? DEFAULT_CURRENCY,
    };
  });
}

function monthlyFactorFor(unit: string, count: number): number {
  if (count <= 0) return 0;
  switch (unit) {
    case 'day':
      return 30 / count;
    case 'week':
      return 30 / (7 * count);
    case 'month':
      return 1 / count;
    case 'year':
      return 1 / (12 * count);
    default:
      return 0;
  }
}

// ─── Dropship margin ─────────────────────────────────────────────────

export interface DropshipMarginBySupplier {
  supplierId: string;
  supplierName: string;
  orders: number;
  costCents: number;
  revenueCents: number;
  profitCents: number;
  marginPct: number;
}

export interface DropshipMarginReport {
  rangeLabel: string;
  totalOrders: number;
  costCents: number;
  revenueCents: number;
  profitCents: number;
  marginPct: number;
  bySupplier: DropshipMarginBySupplier[];
  currency: string;
}

function lineItemsCost(lineItems: unknown): number {
  if (!Array.isArray(lineItems)) return 0;
  return (lineItems as { quantity?: number; unitPriceCents?: number }[]).reduce(
    (sum, li) => sum + (li.quantity ?? 0) * (li.unitPriceCents ?? 0),
    0
  );
}

export async function dropshipMarginReport(
  ctx: ServiceContext,
  range?: DateRange
): Promise<DropshipMarginReport> {
  const label = range ? rangeLabel(range) : 'All time';
  const from = range ? new Date(range.from) : undefined;
  const to = range ? new Date(range.to) : undefined;

  return withTenant(ctx, async (tx) => {
    const dateFilter =
      from || to ? { createdAt: { ...(from && { gte: from }), ...(to && { lte: to }) } } : {};

    const [dsOrders, suppliers] = await Promise.all([
      tx.dropshipOrder.findMany({
        where: { status: { in: ['submitted', 'shipped', 'delivered'] }, ...dateFilter },
        select: { id: true, orderId: true, supplierId: true, lineItems: true },
      }),
      tx.dropshipSupplier.findMany({
        where: { deletedAt: null },
        select: { id: true, name: true },
      }),
    ]);

    const orderIds = [...new Set(dsOrders.map((d) => d.orderId))];
    const orderItems =
      orderIds.length > 0
        ? await tx.orderItem.findMany({
            where: {
              orderId: { in: orderIds },
              variant: { dropshipSourceId: { not: null } },
            },
            select: {
              orderId: true,
              quantity: true,
              unitPrice: true,
              variant: { select: { dropshipSourceId: true } },
            },
          })
        : [];

    // revenue map: orderId → supplierId → cents
    const revenueMap = new Map<string, Map<string, number>>();
    for (const item of orderItems) {
      const supplierId = item.variant?.dropshipSourceId;
      if (!supplierId) continue;
      const bySupplier = revenueMap.get(item.orderId) ?? new Map<string, number>();
      bySupplier.set(
        supplierId,
        (bySupplier.get(supplierId) ?? 0) + item.quantity * Math.round(Number(item.unitPrice) * 100)
      );
      revenueMap.set(item.orderId, bySupplier);
    }

    const supplierIndex = new Map(suppliers.map((s) => [s.id, s.name]));
    const agg = new Map<string, { cost: number; revenue: number; orders: number }>();
    let totalCost = 0;
    let totalRevenue = 0;

    for (const dso of dsOrders) {
      const cost = lineItemsCost(dso.lineItems);
      const revenue = revenueMap.get(dso.orderId)?.get(dso.supplierId) ?? 0;
      totalCost += cost;
      totalRevenue += revenue;
      const entry = agg.get(dso.supplierId) ?? { cost: 0, revenue: 0, orders: 0 };
      entry.cost += cost;
      entry.revenue += revenue;
      entry.orders++;
      agg.set(dso.supplierId, entry);
    }

    const bySupplier: DropshipMarginBySupplier[] = [...agg.entries()]
      .map(([id, s]) => ({
        supplierId: id,
        supplierName: supplierIndex.get(id) ?? id,
        orders: s.orders,
        costCents: s.cost,
        revenueCents: s.revenue,
        profitCents: s.revenue - s.cost,
        marginPct: s.revenue > 0 ? +(((s.revenue - s.cost) / s.revenue) * 100).toFixed(1) : 0,
      }))
      .sort((a, b) => b.profitCents - a.profitCents);

    const marginPct =
      totalRevenue > 0 ? +(((totalRevenue - totalCost) / totalRevenue) * 100).toFixed(1) : 0;

    return {
      rangeLabel: label,
      totalOrders: dsOrders.length,
      costCents: totalCost,
      revenueCents: totalRevenue,
      profitCents: totalRevenue - totalCost,
      marginPct,
      bySupplier,
      currency: DEFAULT_CURRENCY,
    };
  });
}

// ─── Inventory valuation ─────────────────────────────────────────────

export interface InventoryValuation {
  totalUnits: number;
  totalCostCents: number;
  totalRetailCents: number;
  currency: string;
  asOf: string;
}

export async function inventoryValuation(ctx: ServiceContext): Promise<InventoryValuation> {
  return withTenant(ctx, async (tx) => {
    // Sum on-hand units across every warehouse, then join to variant
    // pricing/cost. Done as two queries rather than one wide join so
    // the variant lookup is constant-time and the level scan is
    // straight off the (tenantId, variantId) index.
    const levels = await tx.inventoryLevel.groupBy({
      by: ['variantId'],
      _sum: { onHand: true },
    });

    if (levels.length === 0) {
      return {
        totalUnits: 0,
        totalCostCents: 0,
        totalRetailCents: 0,
        currency: DEFAULT_CURRENCY,
        asOf: new Date().toISOString(),
      };
    }

    const variantIds = levels.map((l) => l.variantId);
    const variants = await tx.productVariant.findMany({
      where: { id: { in: variantIds } },
      select: { id: true, priceCents: true, costCents: true },
    });
    const byId = new Map(variants.map((v) => [v.id, v]));

    let totalUnits = 0;
    let totalCostCents = 0;
    let totalRetailCents = 0;

    for (const lvl of levels) {
      const v = byId.get(lvl.variantId);
      if (!v) continue;
      const units = lvl._sum.onHand ?? 0;
      totalUnits += units;
      totalCostCents += (v.costCents ?? 0) * units;
      totalRetailCents += v.priceCents * units;
    }

    return {
      totalUnits,
      totalCostCents,
      totalRetailCents,
      currency: DEFAULT_CURRENCY,
      asOf: new Date().toISOString(),
    };
  });
}

// ─── Revenue timeseries (rollup, docs/97) ────────────────────────────
//
// The Commerce overview's revenue chart reads daily buckets from the
// `rollup_commerce_daily_revenue` table (pre-aggregated nightly by the
// reconcile below) for closed days, and recomputes the most recent open day(s)
// live so "today" is always fresh — no event-increment worker needed. Buckets
// are by `placed_at`'s UTC date; `net_cents` matches revenueSummary's net so
// the chart and the headline KPI never disagree.

export type RollupGrain = 'day' | 'week' | 'month';

export interface RevenueTimeseriesPoint {
  /** Start of the bucket, UTC date `YYYY-MM-DD`. */
  bucket: string;
  ordersCount: number;
  grossCents: number;
  discountCents: number;
  refundedCents: number;
  netCents: number;
}

export interface RevenueTimeseries {
  range: { from: string; to: string; grain: RollupGrain };
  points: RevenueTimeseriesPoint[];
  totals: {
    ordersCount: number;
    grossCents: number;
    discountCents: number;
    refundedCents: number;
    netCents: number;
  };
  currency: string;
}

export interface RevenueRollupReconcileResult {
  /** Days with at least one non-cancelled order in the reconciled window. */
  days: number;
  ordersCount: number;
  windowStart: string;
}

// How many trailing days the read recomputes live on every call (today +
// yesterday at 1). The reconcile writes these too, but the live overlay wins so
// a same-day order shows up without waiting for the nightly job.
const OVERLAY_DAYS = 1;

// Trailing window the nightly reconcile recomputes from source-of-truth orders.
// At Phase-1 volumes this effectively recomputes all history each night (and is
// the one-shot backfill); narrow it once per-tenant order counts grow large.
const DEFAULT_RECONCILE_DAYS = 400;

const ZERO_MEASURES = {
  ordersCount: 0,
  grossCents: 0,
  discountCents: 0,
  refundedCents: 0,
  netCents: 0,
} as const;

interface DayMeasures {
  ordersCount: number;
  grossCents: number;
  discountCents: number;
  refundedCents: number;
  netCents: number;
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
// (Prisma.Decimal | string | number) → integer cents.
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

interface RawDayRow {
  bucket: Date;
  orders_count: number;
  gross: unknown;
  discount: unknown;
  refunded: unknown;
  collected: unknown;
}

// One GROUP-BY-day pass over non-cancelled orders in [from, toExclusive).
// Bucketed by placed_at's UTC date. RLS scopes the read to the tenant. Shared by
// the live overlay/cold-start in revenueTimeseries and by the nightly reconcile.
async function aggregateRevenueByDay(
  tx: TxClient,
  from: Date,
  toExclusive: Date
): Promise<DayRow[]> {
  const rows = await tx.$queryRaw<RawDayRow[]>`
    SELECT
      (placed_at AT TIME ZONE 'UTC')::date AS bucket,
      COUNT(*)::int                        AS orders_count,
      COALESCE(SUM(subtotal), 0)           AS gross,
      COALESCE(SUM(discount_total), 0)     AS discount,
      COALESCE(SUM(refund_total), 0)       AS refunded,
      COALESCE(SUM(total), 0)              AS collected
    FROM orders
    WHERE status <> 'cancelled'
      AND placed_at >= ${from}
      AND placed_at < ${toExclusive}
    GROUP BY 1
    ORDER BY 1
  `;

  return rows.map((r) => {
    const date = startOfUtcDay(new Date(r.bucket));
    const refundedCents = rawToCents(r.refunded);
    return {
      key: utcDateKey(date),
      date,
      ordersCount: Number(r.orders_count ?? 0),
      grossCents: rawToCents(r.gross),
      discountCents: rawToCents(r.discount),
      refundedCents,
      netCents: rawToCents(r.collected) - refundedCents,
    };
  });
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
  daily: RevenueTimeseriesPoint[],
  grain: 'week' | 'month'
): RevenueTimeseriesPoint[] {
  const map = new Map<string, RevenueTimeseriesPoint>();
  for (const p of daily) {
    const key = bucketStartFor(p.bucket, grain);
    const cur = map.get(key);
    if (cur) {
      cur.ordersCount += p.ordersCount;
      cur.grossCents += p.grossCents;
      cur.discountCents += p.discountCents;
      cur.refundedCents += p.refundedCents;
      cur.netCents += p.netCents;
    } else {
      map.set(key, { ...p, bucket: key });
    }
  }
  return [...map.values()].sort((a, b) => (a.bucket < b.bucket ? -1 : 1));
}

export async function revenueTimeseries(
  ctx: ServiceContext,
  input: { range: DateRange; grain?: RollupGrain }
): Promise<RevenueTimeseries> {
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
      const rollup = await tx.rollupCommerceDailyRevenue.findMany({
        where: { bucket: { gte: from, lt: closedToExclusive } },
        orderBy: { bucket: 'asc' },
      });
      if (rollup.length > 0) {
        for (const r of rollup) {
          byKey.set(utcDateKey(startOfUtcDay(new Date(r.bucket))), {
            ordersCount: r.ordersCount,
            grossCents: Number(r.grossCents),
            discountCents: Number(r.discountCents),
            refundedCents: Number(r.refundedCents),
            netCents: Number(r.netCents),
          });
        }
      } else {
        for (const d of await aggregateRevenueByDay(tx, from, closedToExclusive)) {
          byKey.set(d.key, d);
        }
      }
    }

    // 2) Open days (today + yesterday) always recomputed live so they're fresh.
    const overlayFrom = new Date(Math.max(from.getTime(), overlayStart.getTime()));
    if (toExclusive.getTime() > overlayFrom.getTime()) {
      for (const d of await aggregateRevenueByDay(tx, overlayFrom, toExclusive)) {
        byKey.set(d.key, d);
      }
    }

    // 3) Continuous, zero-filled daily series so the chart has a clean axis.
    const daily: RevenueTimeseriesPoint[] = eachUtcDay(from, to).map((d) => ({
      bucket: utcDateKey(d),
      ...(byKey.get(utcDateKey(d)) ?? ZERO_MEASURES),
    }));

    const points = grain === 'day' ? daily : foldByGrain(daily, grain);
    const totals = daily.reduce(
      (acc, p) => ({
        ordersCount: acc.ordersCount + p.ordersCount,
        grossCents: acc.grossCents + p.grossCents,
        discountCents: acc.discountCents + p.discountCents,
        refundedCents: acc.refundedCents + p.refundedCents,
        netCents: acc.netCents + p.netCents,
      }),
      { ordersCount: 0, grossCents: 0, discountCents: 0, refundedCents: 0, netCents: 0 }
    );

    return {
      range: { from: utcDateKey(from), to: utcDateKey(to), grain },
      points,
      totals,
      currency: DEFAULT_CURRENCY,
    };
  });
}

// Nightly maintenance (docs/97 §5): recompute the trailing window from orders
// and overwrite the rollup. Delete-then-insert the window so late refunds /
// cancellations against older days self-heal in one pass. Run once over full
// history, this is also the backfill. Invoked per active tenant by
// `/internal/commerce/revenue-rollup`.
export async function reconcileRevenueRollup(
  ctx: ServiceContext,
  opts?: { sinceDays?: number }
): Promise<RevenueRollupReconcileResult> {
  const sinceDays = Math.max(0, opts?.sinceDays ?? DEFAULT_RECONCILE_DAYS);
  const today = startOfUtcDay(new Date());
  const windowStart = addUtcDays(today, -sinceDays);
  const toExclusive = addUtcDays(today, 1); // include today

  return withTenant(ctx, async (tx) => {
    const rows = await aggregateRevenueByDay(tx, windowStart, toExclusive);

    await tx.rollupCommerceDailyRevenue.deleteMany({ where: { bucket: { gte: windowStart } } });
    if (rows.length > 0) {
      await tx.rollupCommerceDailyRevenue.createMany({
        data: rows.map((r) => ({
          tenantId: ctx.tenantId,
          bucket: r.date,
          ordersCount: r.ordersCount,
          grossCents: BigInt(r.grossCents),
          discountCents: BigInt(r.discountCents),
          refundedCents: BigInt(r.refundedCents),
          netCents: BigInt(r.netCents),
        })),
      });
    }

    return {
      days: rows.length,
      ordersCount: rows.reduce((s, r) => s + r.ordersCount, 0),
      windowStart: utcDateKey(windowStart),
    };
  });
}
