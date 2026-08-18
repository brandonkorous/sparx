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

import { Prisma, withTenant, type TxClient } from '@wizeworks/db';
import { ORDER_CHANNEL_BUCKETS, channelKeyLabel, deriveChannelKey } from '@wizeworks/crm-schemas';

import type { ServiceContext } from '../errors';
import { CUSTOMER_NAME_SELECT, customerDisplayName } from './customer-name';

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

// Shared by topProducts (all orders) + channelTopProducts (one channel). OrderItem
// has a nullable productId pointing at the Commerce product spine; group by it,
// sum units + revenue over the (already date/status-filtered) orders matching
// `orderWhere`, then join back to Product for the title.
async function topProductsForOrders(
  tx: TxClient,
  orderWhere: Prisma.OrderWhereInput,
  range: { from: Date; to: Date },
  limit: number
): Promise<TopProductRow[]> {
  const groups = await tx.orderItem.groupBy({
    by: ['productId'],
    where: {
      productId: { not: null },
      order: {
        ...orderWhere,
        placedAt: { gte: range.from, lte: range.to },
        status: { not: 'cancelled' },
      },
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
}

export async function topProducts(
  ctx: ServiceContext,
  input: { range: DateRange; limit?: number }
): Promise<TopProductRow[]> {
  const { from, to } = bounds(input.range);
  const limit = input.limit ?? 10;
  return withTenant(ctx, (tx) => topProductsForOrders(tx, {}, { from, to }, limit));
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
      select: { id: true, ...CUSTOMER_NAME_SELECT },
    });
    const byId = new Map(customers.map((c) => [c.id, c]));

    return groups.map((g) => {
      const c = byId.get(g.customerId);
      return {
        customerId: g.customerId,
        customerName: customerDisplayName(c ?? null) ?? '—',
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

// ─── Dropship supplier SLA ───────────────────────────────────────────
//
// Fulfillment timeliness derived live from the DropshipOrder lifecycle
// timestamps (submittedAt → shippedAt → deliveredAt). "Routed" = any order that
// left `pending`; "fulfillment rate" = shipped ÷ routed; "on-time" = delivered
// within ON_TIME_DELIVERY_DAYS of submission, as a share of delivered orders.
// Ship/delivery durations average only the orders that reached each stage (and
// whose timestamps are monotonic). Overall figures are computed in their own
// pass so the averages stay order-weighted rather than supplier-averaged.

// Delivery-window target (days from submission) an order must beat to count
// "on-time". A routing operator's default expectation for a dropship leg.
const ON_TIME_DELIVERY_DAYS = 7;

export interface DropshipSlaMeasures {
  routedOrders: number;
  shippedOrders: number;
  deliveredOrders: number;
  failedOrders: number;
  /** Avg submittedAt → shippedAt, in hours (null until any order has shipped). */
  avgShipHours: number | null;
  /** Avg shippedAt → deliveredAt, in hours (null until any order is delivered). */
  avgDeliveryHours: number | null;
  /** shipped ÷ routed (0–1). */
  fulfillmentRate: number;
  /** delivered-within-SLA ÷ delivered (0–1, null until any order is delivered). */
  onTimeRate: number | null;
}

export interface DropshipSupplierSlaRow extends DropshipSlaMeasures {
  supplierId: string;
  supplierName: string;
}

export interface DropshipSupplierSlaReport extends DropshipSlaMeasures {
  rangeLabel: string;
  onTimeDeliveryDays: number;
  bySupplier: DropshipSupplierSlaRow[];
}

interface RawSlaRow {
  supplier_id?: string;
  routed: number;
  shipped: number;
  delivered: number;
  failed: number;
  avg_ship_hours: unknown;
  avg_delivery_hours: unknown;
  on_time: number;
}

function numOrNull(v: unknown): number | null {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function slaMeasures(r: RawSlaRow): DropshipSlaMeasures {
  const routed = Number(r.routed);
  const shipped = Number(r.shipped);
  const delivered = Number(r.delivered);
  return {
    routedOrders: routed,
    shippedOrders: shipped,
    deliveredOrders: delivered,
    failedOrders: Number(r.failed),
    avgShipHours: numOrNull(r.avg_ship_hours),
    avgDeliveryHours: numOrNull(r.avg_delivery_hours),
    fulfillmentRate: routed > 0 ? +(shipped / routed).toFixed(4) : 0,
    onTimeRate: delivered > 0 ? +(Number(r.on_time) / delivered).toFixed(4) : null,
  };
}

// FILTERed lifecycle aggregation, optionally grouped by supplier. The measure
// columns are identical for the overall pass (group=false) and the per-supplier
// pass (group=true) so `slaMeasures` reads both. RLS scopes to the tenant.
async function aggregateSla(
  tx: TxClient,
  from: Date,
  to: Date,
  group: boolean
): Promise<RawSlaRow[]> {
  const selectSupplier = group ? Prisma.sql`o.supplier_id,` : Prisma.empty;
  const groupBy = group ? Prisma.sql`GROUP BY o.supplier_id` : Prisma.empty;
  return tx.$queryRaw<RawSlaRow[]>`
    SELECT
      ${selectSupplier}
      COUNT(*) FILTER (WHERE o.status <> 'pending')::int     AS routed,
      COUNT(*) FILTER (WHERE o.shipped_at IS NOT NULL)::int  AS shipped,
      COUNT(*) FILTER (WHERE o.delivered_at IS NOT NULL)::int AS delivered,
      COUNT(*) FILTER (WHERE o.status = 'failed')::int       AS failed,
      AVG(EXTRACT(EPOCH FROM (o.shipped_at - o.submitted_at)) / 3600.0)
        FILTER (WHERE o.shipped_at IS NOT NULL AND o.submitted_at IS NOT NULL
                AND o.shipped_at >= o.submitted_at)          AS avg_ship_hours,
      AVG(EXTRACT(EPOCH FROM (o.delivered_at - o.shipped_at)) / 3600.0)
        FILTER (WHERE o.delivered_at IS NOT NULL AND o.shipped_at IS NOT NULL
                AND o.delivered_at >= o.shipped_at)          AS avg_delivery_hours,
      COUNT(*) FILTER (
        WHERE o.delivered_at IS NOT NULL AND o.submitted_at IS NOT NULL
          AND o.delivered_at <= o.submitted_at + (${ON_TIME_DELIVERY_DAYS})::int * interval '1 day'
      )::int                                                 AS on_time
    FROM dropship_orders o
    WHERE o.created_at >= ${from} AND o.created_at <= ${to}
    ${groupBy}
  `;
}

export async function dropshipSupplierSla(
  ctx: ServiceContext,
  range?: DateRange
): Promise<DropshipSupplierSlaReport> {
  const label = range ? rangeLabel(range) : 'All time';
  const from = range ? new Date(range.from) : new Date(0);
  const to = range ? new Date(range.to) : new Date();

  return withTenant(ctx, async (tx) => {
    const [perSupplier, totals, suppliers] = await Promise.all([
      aggregateSla(tx, from, to, true),
      aggregateSla(tx, from, to, false),
      tx.dropshipSupplier.findMany({
        where: { deletedAt: null },
        select: { id: true, name: true },
      }),
    ]);

    const supplierIndex = new Map(suppliers.map((s) => [s.id, s.name]));
    const bySupplier: DropshipSupplierSlaRow[] = perSupplier
      .filter((r) => Number(r.routed) > 0)
      .map((r) => ({
        supplierId: r.supplier_id ?? '',
        supplierName: supplierIndex.get(r.supplier_id ?? '') ?? r.supplier_id ?? '—',
        ...slaMeasures(r),
      }))
      .sort((a, b) => b.routedOrders - a.routedOrders);

    const overall =
      totals[0] != null
        ? slaMeasures(totals[0])
        : slaMeasures({
            routed: 0,
            shipped: 0,
            delivered: 0,
            failed: 0,
            avg_ship_hours: null,
            avg_delivery_hours: null,
            on_time: 0,
          });

    return {
      rangeLabel: label,
      onTimeDeliveryDays: ON_TIME_DELIVERY_DAYS,
      ...overall,
      bySupplier,
    };
  });
}

// ─── Dropship activity feed ──────────────────────────────────────────
//
// The most recently-touched routed orders, newest first — a lifecycle feed for
// the Dropship overview's "Recent activity" timeline. There is no per-event
// ledger, so `updatedAt` (bumped on every status/tracking change) is the proxy
// for "last thing that happened to this order".

export interface DropshipActivityItem {
  id: string;
  orderId: string;
  orderNumber: string | null;
  supplierId: string;
  supplierName: string;
  status: string;
  trackingNumber: string | null;
  updatedAt: string;
}

export async function dropshipActivity(
  ctx: ServiceContext,
  limit = 12
): Promise<DropshipActivityItem[]> {
  const take = Math.min(Math.max(limit, 1), 50);
  return withTenant(ctx, async (tx) => {
    const orders = await tx.dropshipOrder.findMany({
      orderBy: { updatedAt: 'desc' },
      take,
      select: {
        id: true,
        orderId: true,
        supplierId: true,
        status: true,
        trackingNumber: true,
        updatedAt: true,
        order: { select: { orderNumber: true } },
        supplier: { select: { name: true } },
      },
    });
    return orders.map((o) => ({
      id: o.id,
      orderId: o.orderId,
      orderNumber: o.order?.orderNumber ?? null,
      supplierId: o.supplierId,
      supplierName: o.supplier?.name ?? '—',
      status: o.status,
      trackingNumber: o.trackingNumber,
      updatedAt: o.updatedAt.toISOString(),
    }));
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

function mapRevenueRow(r: RawDayRow): DayRow {
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
}

// One GROUP-BY-day pass over non-cancelled orders in [from, toExclusive),
// SCOPED for a read (docs/131 §6). `propertyId` undefined = every site (the
// all-sites total, which includes orders whose site was deleted — the
// unattributed bucket); a value = only that site's orders (orphaned-null orders
// are correctly excluded from a single business's figures). Bucketed by
// placed_at's UTC date; RLS scopes to the tenant. Shared by the live overlay /
// cold-start in revenueTimeseries.
async function aggregateRevenueByDay(
  tx: TxClient,
  from: Date,
  toExclusive: Date,
  propertyId?: string
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
      ${propertyId ? Prisma.sql`AND property_id = ${propertyId}::uuid` : Prisma.empty}
    GROUP BY 1
    ORDER BY 1
  `;
  return rows.map(mapRevenueRow);
}

interface RawDayPropRow extends RawDayRow {
  property_id: string | null;
}

// The per-PROPERTY pass the nightly reconcile writes (docs/131 §6): one row per
// (property, day), null property_id = the unattributed bucket (an order that
// outlived its site). GROUP BY property_id so every site's daily figures are
// stored separately and a per-site read is an indexed lookup, not a re-scan.
async function aggregateRevenueByDayPerProperty(
  tx: TxClient,
  from: Date,
  toExclusive: Date
): Promise<(DayRow & { propertyId: string | null })[]> {
  const rows = await tx.$queryRaw<RawDayPropRow[]>`
    SELECT
      property_id,
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
    GROUP BY property_id, 2
    ORDER BY 2
  `;
  return rows.map((r) => ({ ...mapRevenueRow(r), propertyId: r.property_id }));
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

// Sum a day's measures into the bucket map. Accumulates rather than overwrites
// because the all-sites read (docs/131 §6) now finds MULTIPLE rollup rows per
// bucket — one per site plus the unattributed null — that must add up to the
// tenant total. The closed and open windows stay disjoint, so this never
// double-counts across them.
function addDayMeasures(byKey: Map<string, DayMeasures>, key: string, m: DayMeasures): void {
  const cur = byKey.get(key);
  byKey.set(
    key,
    cur
      ? {
          ordersCount: cur.ordersCount + m.ordersCount,
          grossCents: cur.grossCents + m.grossCents,
          discountCents: cur.discountCents + m.discountCents,
          refundedCents: cur.refundedCents + m.refundedCents,
          netCents: cur.netCents + m.netCents,
        }
      : { ...m }
  );
}

export async function revenueTimeseries(
  ctx: ServiceContext,
  input: { range: DateRange; grain?: RollupGrain; propertyId?: string }
): Promise<RevenueTimeseries> {
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
    //    and let addDayMeasures sum them back to the tenant total.
    if (closedToExclusive.getTime() > from.getTime()) {
      const rollup = await tx.rollupCommerceDailyRevenue.findMany({
        where: {
          bucket: { gte: from, lt: closedToExclusive },
          ...(propertyId ? { propertyId } : {}),
        },
        orderBy: { bucket: 'asc' },
      });
      if (rollup.length > 0) {
        for (const r of rollup) {
          addDayMeasures(byKey, utcDateKey(startOfUtcDay(new Date(r.bucket))), {
            ordersCount: r.ordersCount,
            grossCents: Number(r.grossCents),
            discountCents: Number(r.discountCents),
            refundedCents: Number(r.refundedCents),
            netCents: Number(r.netCents),
          });
        }
      } else {
        for (const d of await aggregateRevenueByDay(tx, from, closedToExclusive, propertyId)) {
          addDayMeasures(byKey, d.key, d);
        }
      }
    }

    // 2) Open days (today + yesterday) always recomputed live so they're fresh.
    const overlayFrom = new Date(Math.max(from.getTime(), overlayStart.getTime()));
    if (toExclusive.getTime() > overlayFrom.getTime()) {
      for (const d of await aggregateRevenueByDay(tx, overlayFrom, toExclusive, propertyId)) {
        addDayMeasures(byKey, d.key, d);
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
    // Per (property, day) rows (docs/131 §6). Delete-then-insert the whole window
    // for the tenant regardless of property — every site's rows are rewritten in
    // one pass, so a late refund on any site self-heals and a site with no orders
    // that day simply has no row.
    const rows = await aggregateRevenueByDayPerProperty(tx, windowStart, toExclusive);

    await tx.rollupCommerceDailyRevenue.deleteMany({ where: { bucket: { gte: windowStart } } });
    if (rows.length > 0) {
      await tx.rollupCommerceDailyRevenue.createMany({
        data: rows.map((r) => ({
          tenantId: ctx.tenantId,
          propertyId: r.propertyId,
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

// ─── Dropship orders timeseries (rollup, docs/97) ────────────────────
//
// The Dropship overview's "order volume" chart reads daily buckets from the
// `rollup_dropship_daily_orders` table for closed days and recomputes the most
// recent open day(s) live. Buckets dropship orders by `created_at`'s UTC date
// over the fulfilled-ish set (submitted | shipped | delivered) — the same
// statuses `dropshipMarginReport` counts, so the chart and the margin headline
// agree. Per day: routed order count, supplier cost (Σ over each order's
// `line_items` JSON of quantity × unitPriceCents) and the storefront revenue
// attributed to those orders (order_items whose variant's dropship_source_id is
// the order's supplier). Profit/margin are derived (revenue − cost). Reuses the
// UTC-day/grain helpers and the OVERLAY/RECONCILE constants from the revenue
// rollup above.

export interface DropshipOrdersTimeseriesPoint {
  /** Start of the bucket, UTC date `YYYY-MM-DD`. */
  bucket: string;
  ordersCount: number;
  revenueCents: number;
  costCents: number;
  /** Derived: revenueCents − costCents. */
  profitCents: number;
}

export interface DropshipOrdersTimeseries {
  range: { from: string; to: string; grain: RollupGrain };
  points: DropshipOrdersTimeseriesPoint[];
  totals: {
    ordersCount: number;
    revenueCents: number;
    costCents: number;
    profitCents: number;
    marginPct: number;
  };
  currency: string;
}

export interface DropshipOrdersRollupReconcileResult {
  /** Days with at least one routed dropship order in the reconciled window. */
  days: number;
  ordersCount: number;
  windowStart: string;
}

interface DropshipDayMeasures {
  ordersCount: number;
  revenueCents: number;
  costCents: number;
}

const DROPSHIP_ZERO: DropshipDayMeasures = {
  ordersCount: 0,
  revenueCents: 0,
  costCents: 0,
};

interface DropshipDayRow extends DropshipDayMeasures {
  /** UTC date key `YYYY-MM-DD`. */
  key: string;
  /** UTC-midnight Date for the bucket (used as the rollup PK value). */
  date: Date;
}

// Unlike `rawToCents` (which scales Decimal *dollar* SUMs by 100), the dropship
// SUMs already come back in integer cents — line_items.unitPriceCents and
// quantity × ROUND(unit_price × 100) are both cents — so this must NOT re-scale.
function rawCents(v: unknown): number {
  if (v == null) return 0;
  if (typeof v === 'number') return Math.round(v);
  if (typeof v === 'bigint') return Number(v);
  if (typeof v === 'string') {
    const n = Number.parseFloat(v);
    return Number.isFinite(n) ? Math.round(n) : 0;
  }
  if (typeof v === 'object' && 'toNumber' in v && typeof v.toNumber === 'function') {
    return Math.round((v as { toNumber(): number }).toNumber());
  }
  return 0;
}

interface RawDropshipDayRow {
  bucket: Date;
  orders_count: number;
  revenue: unknown;
  cost: unknown;
}

function mapDropshipRow(r: RawDropshipDayRow): DropshipDayRow {
  const date = startOfUtcDay(new Date(r.bucket));
  return {
    key: utcDateKey(date),
    date,
    ordersCount: Number(r.orders_count ?? 0),
    revenueCents: rawCents(r.revenue),
    costCents: rawCents(r.cost),
  };
}

// One GROUP-BY-day pass over routed dropship orders in [from, toExclusive),
// bucketed by created_at's UTC date. Cost expands each order's `line_items`
// JSON; revenue joins the order's storefront items to the variant whose
// dropship_source_id matches the order's supplier — the same attribution
// `dropshipMarginReport` does, aggregated per day in SQL. The revenue CTE is
// bounded to the window's orders so the live overlay stays cheap. RLS scopes
// every table to the tenant. Shared by the live overlay/cold-start read.
//
// Site attribution (docs/131 §6): a DropshipOrder has no site of its own, so it
// inherits its storefront Order's `property_id` (joined below). `propertyId`
// undefined = every site (all-sites total, includes orphaned orders); a value =
// only that site.
async function aggregateDropshipByDay(
  tx: TxClient,
  from: Date,
  toExclusive: Date,
  propertyId?: string
): Promise<DropshipDayRow[]> {
  const rows = await tx.$queryRaw<RawDropshipDayRow[]>`
    WITH ds AS (
      SELECT
        o.order_id    AS order_id,
        o.supplier_id AS supplier_id,
        (o.created_at AT TIME ZONE 'UTC')::date AS bucket,
        COALESCE((
          SELECT SUM(
            COALESCE((li ->> 'quantity')::numeric, 0)
            * COALESCE((li ->> 'unitPriceCents')::numeric, 0)
          )
          FROM jsonb_array_elements(
            CASE WHEN jsonb_typeof(o.line_items) = 'array' THEN o.line_items ELSE '[]'::jsonb END
          ) AS li
        ), 0) AS cost_cents
      FROM dropship_orders o
      JOIN orders ord ON ord.id = o.order_id
      WHERE o.status IN ('submitted', 'shipped', 'delivered')
        AND o.created_at >= ${from}
        AND o.created_at < ${toExclusive}
        ${propertyId ? Prisma.sql`AND ord.property_id = ${propertyId}::uuid` : Prisma.empty}
    ),
    rev AS (
      SELECT
        oi.order_id           AS order_id,
        pv.dropship_source_id AS supplier_id,
        SUM(oi.quantity * ROUND(oi.unit_price * 100)) AS revenue_cents
      FROM order_items oi
      JOIN commerce_product_variants pv ON pv.id = oi.variant_id
      WHERE pv.dropship_source_id IS NOT NULL
        AND oi.order_id IN (SELECT order_id FROM ds)
      GROUP BY oi.order_id, pv.dropship_source_id
    )
    SELECT
      ds.bucket                           AS bucket,
      COUNT(*)::int                       AS orders_count,
      COALESCE(SUM(rev.revenue_cents), 0) AS revenue,
      COALESCE(SUM(ds.cost_cents), 0)     AS cost
    FROM ds
    LEFT JOIN rev
      ON rev.order_id = ds.order_id
     AND rev.supplier_id = ds.supplier_id
    GROUP BY ds.bucket
    ORDER BY ds.bucket
  `;
  return rows.map(mapDropshipRow);
}

interface RawDropshipDayPropRow extends RawDropshipDayRow {
  property_id: string | null;
}

// The per-PROPERTY pass the nightly reconcile writes (docs/131 §6): one row per
// (site, day) via the storefront order's property_id, null = the unattributed
// bucket (a routed order whose site was deleted).
async function aggregateDropshipByDayPerProperty(
  tx: TxClient,
  from: Date,
  toExclusive: Date
): Promise<(DropshipDayRow & { propertyId: string | null })[]> {
  const rows = await tx.$queryRaw<RawDropshipDayPropRow[]>`
    WITH ds AS (
      SELECT
        o.order_id       AS order_id,
        o.supplier_id    AS supplier_id,
        ord.property_id  AS property_id,
        (o.created_at AT TIME ZONE 'UTC')::date AS bucket,
        COALESCE((
          SELECT SUM(
            COALESCE((li ->> 'quantity')::numeric, 0)
            * COALESCE((li ->> 'unitPriceCents')::numeric, 0)
          )
          FROM jsonb_array_elements(
            CASE WHEN jsonb_typeof(o.line_items) = 'array' THEN o.line_items ELSE '[]'::jsonb END
          ) AS li
        ), 0) AS cost_cents
      FROM dropship_orders o
      JOIN orders ord ON ord.id = o.order_id
      WHERE o.status IN ('submitted', 'shipped', 'delivered')
        AND o.created_at >= ${from}
        AND o.created_at < ${toExclusive}
    ),
    rev AS (
      SELECT
        oi.order_id           AS order_id,
        pv.dropship_source_id AS supplier_id,
        SUM(oi.quantity * ROUND(oi.unit_price * 100)) AS revenue_cents
      FROM order_items oi
      JOIN commerce_product_variants pv ON pv.id = oi.variant_id
      WHERE pv.dropship_source_id IS NOT NULL
        AND oi.order_id IN (SELECT order_id FROM ds)
      GROUP BY oi.order_id, pv.dropship_source_id
    )
    SELECT
      ds.property_id                      AS property_id,
      ds.bucket                           AS bucket,
      COUNT(*)::int                       AS orders_count,
      COALESCE(SUM(rev.revenue_cents), 0) AS revenue,
      COALESCE(SUM(ds.cost_cents), 0)     AS cost
    FROM ds
    LEFT JOIN rev
      ON rev.order_id = ds.order_id
     AND rev.supplier_id = ds.supplier_id
    GROUP BY ds.property_id, ds.bucket
    ORDER BY ds.bucket
  `;
  return rows.map((r) => ({ ...mapDropshipRow(r), propertyId: r.property_id }));
}

function foldDropshipByGrain(
  daily: DropshipOrdersTimeseriesPoint[],
  grain: 'week' | 'month'
): DropshipOrdersTimeseriesPoint[] {
  const map = new Map<string, DropshipOrdersTimeseriesPoint>();
  for (const p of daily) {
    const key = bucketStartFor(p.bucket, grain);
    const cur = map.get(key);
    if (cur) {
      cur.ordersCount += p.ordersCount;
      cur.revenueCents += p.revenueCents;
      cur.costCents += p.costCents;
      cur.profitCents += p.profitCents;
    } else {
      map.set(key, { ...p, bucket: key });
    }
  }
  return [...map.values()].sort((a, b) => (a.bucket < b.bucket ? -1 : 1));
}

function toDropshipPoint(bucket: string, m: DropshipDayMeasures): DropshipOrdersTimeseriesPoint {
  return {
    bucket,
    ordersCount: m.ordersCount,
    revenueCents: m.revenueCents,
    costCents: m.costCents,
    profitCents: m.revenueCents - m.costCents,
  };
}

// Accumulate a day's dropship measures into the bucket map — sums the per-site
// rollup rows back to the tenant total for an all-sites read (docs/131 §6). See
// addDayMeasures on the revenue side for why this accumulates.
function addDropshipMeasures(
  byKey: Map<string, DropshipDayMeasures>,
  key: string,
  m: DropshipDayMeasures
): void {
  const cur = byKey.get(key);
  byKey.set(
    key,
    cur
      ? {
          ordersCount: cur.ordersCount + m.ordersCount,
          revenueCents: cur.revenueCents + m.revenueCents,
          costCents: cur.costCents + m.costCents,
        }
      : { ...m }
  );
}

export async function dropshipOrdersTimeseries(
  ctx: ServiceContext,
  input: { range: DateRange; grain?: RollupGrain; propertyId?: string }
): Promise<DropshipOrdersTimeseries> {
  const grain = input.grain ?? 'day';
  const propertyId = input.propertyId;
  const from = startOfUtcDay(new Date(input.range.from));
  const to = startOfUtcDay(new Date(input.range.to));
  const overlayStart = addUtcDays(startOfUtcDay(new Date()), -OVERLAY_DAYS);

  return withTenant(ctx, async (tx) => {
    const toExclusive = addUtcDays(to, 1);
    const closedToExclusive = new Date(Math.min(toExclusive.getTime(), overlayStart.getTime()));
    const byKey = new Map<string, DropshipDayMeasures>();

    // 1) Closed days from the rollup, with a live cold-start fallback so a fresh
    //    deploy serves real history before the first reconcile runs. Per-site
    //    (docs/131 §6): filter to the one site, or sum every site's rows.
    if (closedToExclusive.getTime() > from.getTime()) {
      const rollup = await tx.rollupDropshipDailyOrders.findMany({
        where: {
          bucket: { gte: from, lt: closedToExclusive },
          ...(propertyId ? { propertyId } : {}),
        },
        orderBy: { bucket: 'asc' },
      });
      if (rollup.length > 0) {
        for (const r of rollup) {
          addDropshipMeasures(byKey, utcDateKey(startOfUtcDay(new Date(r.bucket))), {
            ordersCount: r.ordersCount,
            revenueCents: Number(r.revenueCents),
            costCents: Number(r.costCents),
          });
        }
      } else {
        for (const d of await aggregateDropshipByDay(tx, from, closedToExclusive, propertyId)) {
          addDropshipMeasures(byKey, d.key, d);
        }
      }
    }

    // 2) Open days (today + yesterday) always recomputed live so they're fresh.
    const overlayFrom = new Date(Math.max(from.getTime(), overlayStart.getTime()));
    if (toExclusive.getTime() > overlayFrom.getTime()) {
      for (const d of await aggregateDropshipByDay(tx, overlayFrom, toExclusive, propertyId)) {
        addDropshipMeasures(byKey, d.key, d);
      }
    }

    // 3) Continuous, zero-filled daily series so the chart has a clean axis.
    const daily: DropshipOrdersTimeseriesPoint[] = eachUtcDay(from, to).map((d) =>
      toDropshipPoint(utcDateKey(d), byKey.get(utcDateKey(d)) ?? DROPSHIP_ZERO)
    );

    const points = grain === 'day' ? daily : foldDropshipByGrain(daily, grain);
    const totalsBase = daily.reduce(
      (acc, p) => ({
        ordersCount: acc.ordersCount + p.ordersCount,
        revenueCents: acc.revenueCents + p.revenueCents,
        costCents: acc.costCents + p.costCents,
      }),
      { ordersCount: 0, revenueCents: 0, costCents: 0 }
    );
    const profitCents = totalsBase.revenueCents - totalsBase.costCents;

    return {
      range: { from: utcDateKey(from), to: utcDateKey(to), grain },
      points,
      totals: {
        ...totalsBase,
        profitCents,
        marginPct:
          totalsBase.revenueCents > 0
            ? +((profitCents / totalsBase.revenueCents) * 100).toFixed(1)
            : 0,
      },
      currency: DEFAULT_CURRENCY,
    };
  });
}

// Nightly maintenance (docs/97 §5): recompute the trailing window from the
// source-of-truth dropship orders + storefront items and overwrite the rollup.
// Delete-then-insert the window so status changes (a pending order becoming
// shipped) and late edits self-heal in one pass. Run once over full history,
// this is also the backfill. Invoked per active tenant by
// `/internal/dropship/orders-rollup`.
export async function reconcileDropshipOrdersRollup(
  ctx: ServiceContext,
  opts?: { sinceDays?: number }
): Promise<DropshipOrdersRollupReconcileResult> {
  const sinceDays = Math.max(0, opts?.sinceDays ?? DEFAULT_RECONCILE_DAYS);
  const today = startOfUtcDay(new Date());
  const windowStart = addUtcDays(today, -sinceDays);
  const toExclusive = addUtcDays(today, 1); // include today

  return withTenant(ctx, async (tx) => {
    const rows = await aggregateDropshipByDayPerProperty(tx, windowStart, toExclusive);

    await tx.rollupDropshipDailyOrders.deleteMany({ where: { bucket: { gte: windowStart } } });
    if (rows.length > 0) {
      await tx.rollupDropshipDailyOrders.createMany({
        data: rows.map((r) => ({
          tenantId: ctx.tenantId,
          propertyId: r.propertyId,
          bucket: r.date,
          ordersCount: r.ordersCount,
          revenueCents: BigInt(r.revenueCents),
          costCents: BigInt(r.costCents),
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

// ─── Discount performance (live aggregate, docs/97) ──────────────────
//
// Per-discount redemption economics over a window: how many times each code was
// used, how much it gave away, and across how many distinct orders. Reads the
// `commerce_discount_usages` ledger (one row per redemption, `applied_cents`
// already in cents) joined to the discount for its code/name/type. A live
// aggregate — redemption volume is modest and the read is bounded by tenant
// (RLS) + a date range. Powers the Commerce overview's discount surface.

const DISCOUNT_DEFAULT_DAYS = 90;
const CHANNEL_DEFAULT_DAYS = 30;

export interface DiscountPerfRow {
  discountId: string;
  code: string | null;
  name: string;
  type: string;
  status: string;
  redemptions: number;
  discountCents: number;
  uniqueOrders: number;
}

export interface DiscountPerformance {
  rangeLabel: string;
  totalRedemptions: number;
  totalDiscountCents: number;
  activeDiscounts: number;
  byDiscount: DiscountPerfRow[];
  currency: string;
}

interface RawDiscountRow {
  discount_id: string;
  redemptions: number;
  discount_cents: unknown;
  unique_orders: number;
}

export async function discountPerformance(
  ctx: ServiceContext,
  input?: { range?: DateRange; limit?: number }
): Promise<DiscountPerformance> {
  const limit = Math.min(Math.max(input?.limit ?? 8, 1), 50);
  const to = input?.range ? new Date(input.range.to) : new Date();
  const from = input?.range
    ? new Date(input.range.from)
    : new Date(Date.now() - DISCOUNT_DEFAULT_DAYS * 86_400_000);
  const label = input?.range ? rangeLabel(input.range) : `Last ${DISCOUNT_DEFAULT_DAYS} days`;

  return withTenant(ctx, async (tx) => {
    const [rows, totals, activeDiscounts] = await Promise.all([
      tx.$queryRaw<RawDiscountRow[]>`
        SELECT
          discount_id,
          COUNT(*)::int                          AS redemptions,
          COALESCE(SUM(applied_cents), 0)::bigint AS discount_cents,
          COUNT(DISTINCT order_id)::int          AS unique_orders
        FROM commerce_discount_usages
        WHERE redeemed_at >= ${from} AND redeemed_at <= ${to}
        GROUP BY discount_id
        ORDER BY discount_cents DESC
        LIMIT ${limit}
      `,
      tx.discountUsage.aggregate({
        where: { redeemedAt: { gte: from, lte: to } },
        _count: { _all: true },
        _sum: { appliedCents: true },
      }),
      tx.discount.count({ where: { status: 'active', deletedAt: null } }),
    ]);

    const discounts =
      rows.length > 0
        ? await tx.discount.findMany({
            where: { id: { in: rows.map((r) => r.discount_id) } },
            select: { id: true, code: true, name: true, type: true, status: true },
          })
        : [];
    const byId = new Map(discounts.map((d) => [d.id, d]));

    const byDiscount: DiscountPerfRow[] = rows.map((r) => {
      const d = byId.get(r.discount_id);
      return {
        discountId: r.discount_id,
        code: d?.code ?? null,
        name: d?.name ?? '—',
        type: d?.type ?? 'unknown',
        status: d?.status ?? 'unknown',
        redemptions: Number(r.redemptions ?? 0),
        discountCents: Number(r.discount_cents ?? 0),
        uniqueOrders: Number(r.unique_orders ?? 0),
      };
    });

    return {
      rangeLabel: label,
      totalRedemptions: totals._count._all,
      totalDiscountCents: totals._sum.appliedCents ?? 0,
      activeDiscounts,
      byDiscount,
      currency: DEFAULT_CURRENCY,
    };
  });
}

// ─── Channel breakdown (live aggregate, docs/97) ─────────────────────
//
// Orders + revenue split by the order's `channel` (storefront | b2b_portal |
// admin | import | mcp). This is the derivable half of "traffic sources" — the
// referrer/UTM half needs site-analytics event capture (workload B). Buckets
// non-cancelled orders by `placed_at` over the window. Live aggregate.

export interface ChannelRow {
  channel: string;
  orders: number;
  revenueCents: number;
  sharePct: number;
}

export interface ChannelBreakdown {
  rangeLabel: string;
  totalOrders: number;
  totalRevenueCents: number;
  byChannel: ChannelRow[];
  currency: string;
}

export async function channelBreakdown(
  ctx: ServiceContext,
  range?: DateRange
): Promise<ChannelBreakdown> {
  const to = range ? new Date(range.to) : new Date();
  const from = range
    ? new Date(range.from)
    : new Date(Date.now() - CHANNEL_DEFAULT_DAYS * 86_400_000);
  const label = range ? rangeLabel(range) : `Last ${CHANNEL_DEFAULT_DAYS} days`;

  return withTenant(ctx, async (tx) => {
    const groups = await tx.order.groupBy({
      by: ['channel'],
      where: { placedAt: { gte: from, lte: to }, status: { not: 'cancelled' } },
      _count: { _all: true },
      _sum: { total: true },
    });

    const rows = groups.map((g) => ({
      channel: g.channel ?? 'unknown',
      orders: g._count._all,
      revenueCents: decimalToCents(g._sum.total),
    }));
    const totalRevenueCents = rows.reduce((s, r) => s + r.revenueCents, 0);
    const totalOrders = rows.reduce((s, r) => s + r.orders, 0);

    const byChannel: ChannelRow[] = rows
      .map((r) => ({
        ...r,
        sharePct:
          totalRevenueCents > 0 ? +((r.revenueCents / totalRevenueCents) * 100).toFixed(1) : 0,
      }))
      .sort((a, b) => b.revenueCents - a.revenueCents);

    return {
      rangeLabel: label,
      totalOrders,
      totalRevenueCents,
      byChannel,
      currency: DEFAULT_CURRENCY,
    };
  });
}

// ─── Attribution breakdown — "where today's buyers came from" (docs/128) ──────
//
// The referrer/traffic-source half that channelBreakdown above flagged as needing
// event capture. Orders + revenue split by the order's derived `attribution_source`
// (search | direct | social | referral), with a NULL source folded into an
// explicit `unattributed` bucket. Honest by construction (docs/128 §5): a sale
// with no matching same-day web traffic — staff / B2B / POS / phone / renewal, or
// a visit on a different day — belongs in `unattributed`, never dropped or zeroed.
// `unresolvedOrders` counts rows never scanned (attribution_resolved_at IS NULL —
// placed before attribution shipped), so the UI can caveat the cutover window
// rather than imply those sales genuinely had no source. Live aggregate.

export interface AttributionRow {
  source: string; // search | direct | social | referral | unattributed
  orders: number;
  revenueCents: number;
  sharePct: number;
}

export interface AttributionBreakdown {
  rangeLabel: string;
  totalOrders: number;
  totalRevenueCents: number;
  bySource: AttributionRow[];
  // Orders in the window with attribution_resolved_at IS NULL — never looked at
  // (pre-cutover, or a resolver that never ran). A subset of the `unattributed`
  // bucket, surfaced so the UI states the cutover limit plainly (docs/128 §8).
  unresolvedOrders: number;
  currency: string;
}

export async function attributionBreakdown(
  ctx: ServiceContext,
  range?: DateRange
): Promise<AttributionBreakdown> {
  const to = range ? new Date(range.to) : new Date();
  const from = range
    ? new Date(range.from)
    : new Date(Date.now() - CHANNEL_DEFAULT_DAYS * 86_400_000);
  const label = range ? rangeLabel(range) : `Last ${CHANNEL_DEFAULT_DAYS} days`;

  return withTenant(ctx, async (tx) => {
    const baseWhere = { placedAt: { gte: from, lte: to }, status: { not: 'cancelled' } };

    const groups = await tx.order.groupBy({
      by: ['attributionSource'],
      where: baseWhere,
      _count: { _all: true },
      _sum: { total: true },
    });

    // Collapse the null-source group into the explicit `unattributed` key. groupBy
    // yields at most one null group, so a plain map suffices, but reduce-merge is
    // defensive against a stray empty-string source ever appearing.
    const merged = new Map<string, { orders: number; revenueCents: number }>();
    for (const g of groups) {
      const key =
        g.attributionSource && g.attributionSource.length > 0
          ? g.attributionSource
          : 'unattributed';
      const prev = merged.get(key) ?? { orders: 0, revenueCents: 0 };
      merged.set(key, {
        orders: prev.orders + g._count._all,
        revenueCents: prev.revenueCents + decimalToCents(g._sum.total),
      });
    }

    const totalRevenueCents = [...merged.values()].reduce((s, r) => s + r.revenueCents, 0);
    const totalOrders = [...merged.values()].reduce((s, r) => s + r.orders, 0);

    const bySource: AttributionRow[] = [...merged.entries()]
      .map(([source, r]) => ({
        source,
        orders: r.orders,
        revenueCents: r.revenueCents,
        sharePct:
          totalRevenueCents > 0 ? +((r.revenueCents / totalRevenueCents) * 100).toFixed(1) : 0,
      }))
      .sort((a, b) => b.revenueCents - a.revenueCents);

    const unresolvedOrders = await tx.order.count({
      where: { ...baseWhere, attributionResolvedAt: null },
    });

    return {
      rangeLabel: label,
      totalOrders,
      totalRevenueCents,
      bySource,
      unresolvedOrders,
      currency: DEFAULT_CURRENCY,
    };
  });
}

// ─── Email-campaign revenue (docs/impl transactional-email Slice 10) ──────────
// The per-campaign drill of the `email` attribution source: which SENT EMAIL the
// revenue came from. Only `email`-source orders carry a campaign, so it's the
// email slice of attributionBreakdown one level deeper — answering "how much did
// the Welcome email actually make" for a non-technical owner.

export interface EmailCampaignRevenueRow {
  campaign: string;
  orders: number;
  revenueCents: number;
  sharePct: number;
}

export interface EmailCampaignRevenueBreakdown {
  rangeLabel: string;
  totalOrders: number;
  totalRevenueCents: number;
  byCampaign: EmailCampaignRevenueRow[];
  currency: string;
}

export async function emailCampaignRevenue(
  ctx: ServiceContext,
  range?: DateRange
): Promise<EmailCampaignRevenueBreakdown> {
  const to = range ? new Date(range.to) : new Date();
  const from = range
    ? new Date(range.from)
    : new Date(Date.now() - CHANNEL_DEFAULT_DAYS * 86_400_000);
  const label = range ? rangeLabel(range) : `Last ${CHANNEL_DEFAULT_DAYS} days`;

  return withTenant(ctx, async (tx) => {
    const groups = await tx.order.groupBy({
      by: ['attributionCampaign'],
      where: {
        placedAt: { gte: from, lte: to },
        status: { not: 'cancelled' },
        attributionSource: 'email',
        attributionCampaign: { not: null },
      },
      _count: { _all: true },
      _sum: { total: true },
    });

    const rows = groups.map((g) => ({
      campaign: g.attributionCampaign ?? 'Email',
      orders: g._count._all,
      revenueCents: decimalToCents(g._sum.total),
    }));
    const totalRevenueCents = rows.reduce((s, r) => s + r.revenueCents, 0);
    const totalOrders = rows.reduce((s, r) => s + r.orders, 0);

    const byCampaign: EmailCampaignRevenueRow[] = rows
      .map((r) => ({
        ...r,
        sharePct:
          totalRevenueCents > 0 ? +((r.revenueCents / totalRevenueCents) * 100).toFixed(1) : 0,
      }))
      .sort((a, b) => b.revenueCents - a.revenueCents);

    return {
      rangeLabel: label,
      totalOrders,
      totalRevenueCents,
      byCampaign,
      currency: DEFAULT_CURRENCY,
    };
  });
}

// ─── Channel revenue consolidation (docs/27 §8, docs/106 §4.4) ────────────────
//
// The richer sibling of channelBreakdown: it CONSOLIDATES every sales channel —
// native (storefront, b2b_portal, …) AND each external marketplace — into one
// revenue picture. The key difference is the derived channel key: a marketplace
// order keys by its `source` slug (tiktok_shop, etsy, …), so TikTok Shop and Etsy
// are distinct lines instead of collapsing into one "marketplace" bucket. It also
// surfaces `channelFeeCents` (the marketplace commission) so net-of-fees revenue
// reconciles. Powers GET /v1/commerce/reports/channel-revenue + the get_channel_*
// MCP tools + the Settings → Channels performance surface.

interface ChannelTotals {
  orders: number;
  grossCents: number;
  refundedCents: number;
  feeCents: number;
}

function emptyChannelTotals(): ChannelTotals {
  return { orders: 0, grossCents: 0, refundedCents: 0, feeCents: 0 };
}

function defaultedBounds(range?: DateRange): { from: Date; to: Date; label: string } {
  const to = range ? new Date(range.to) : new Date();
  const from = range
    ? new Date(range.from)
    : new Date(Date.now() - CHANNEL_DEFAULT_DAYS * 86_400_000);
  const label = range ? rangeLabel(range) : `Last ${CHANNEL_DEFAULT_DAYS} days`;
  return { from, to, label };
}

/** Translate a derived channel key back into the order WHERE that produced it.
 *  A key that isn't one of the fixed buckets is a marketplace source slug (robust
 *  against a new marketplace whose slug isn't labelled yet). */
function channelKeyWhere(key: string): Prisma.OrderWhereInput {
  if (!ORDER_CHANNEL_BUCKETS.has(key)) return { channel: 'marketplace', source: key };
  if (key === 'unknown') return { channel: null };
  if (key === 'marketplace') return { channel: 'marketplace', source: null };
  return { channel: key };
}

export interface ChannelRevenueRow {
  /** Derived channel key — a bucket (storefront, b2b_portal, …) or a marketplace
   *  source slug (tiktok_shop, etsy, …). */
  channel: string;
  /** Human label for the key (e.g. "TikTok Shop"). */
  label: string;
  orders: number;
  grossRevenueCents: number;
  refundedCents: number;
  netRevenueCents: number;
  /** Marketplace commission withheld (0 for native channels). */
  channelFeeCents: number;
  /** Net revenue after refunds AND channel fees — what the tenant keeps. */
  netAfterFeesCents: number;
  averageOrderValueCents: number;
  /** Share of total gross revenue across all channels (0–100, one decimal). */
  sharePct: number;
}

export interface ChannelRevenueReport {
  rangeLabel: string;
  totalOrders: number;
  totalGrossRevenueCents: number;
  totalRefundedCents: number;
  totalChannelFeeCents: number;
  totalNetAfterFeesCents: number;
  byChannel: ChannelRevenueRow[];
  currency: string;
}

/** Revenue split across every channel for the window (marketplace orders broken
 *  out by source). Defaults to the last 30 days when no range is given. */
export async function channelComparison(
  ctx: ServiceContext,
  range?: DateRange
): Promise<ChannelRevenueReport> {
  const { from, to, label } = defaultedBounds(range);

  return withTenant(ctx, async (tx) => {
    const groups = await tx.order.groupBy({
      by: ['channel', 'source'],
      where: { placedAt: { gte: from, lte: to }, status: { not: 'cancelled' } },
      _count: { _all: true },
      _sum: { total: true, refundTotal: true, channelFeeCents: true },
    });

    // Fold the (channel, source) groups onto the derived key so every marketplace
    // source is its own line and the native buckets stay whole.
    const acc = new Map<string, ChannelTotals>();
    for (const g of groups) {
      const key = deriveChannelKey(g.channel, g.source);
      const cur = acc.get(key) ?? emptyChannelTotals();
      cur.orders += g._count._all;
      cur.grossCents += decimalToCents(g._sum.total);
      cur.refundedCents += decimalToCents(g._sum.refundTotal);
      cur.feeCents += g._sum.channelFeeCents ?? 0;
      acc.set(key, cur);
    }

    const totalGross = [...acc.values()].reduce((s, v) => s + v.grossCents, 0);
    const byChannel: ChannelRevenueRow[] = [...acc.entries()]
      .map(([key, v]) => ({
        channel: key,
        label: channelKeyLabel(key),
        orders: v.orders,
        grossRevenueCents: v.grossCents,
        refundedCents: v.refundedCents,
        netRevenueCents: v.grossCents - v.refundedCents,
        channelFeeCents: v.feeCents,
        netAfterFeesCents: v.grossCents - v.refundedCents - v.feeCents,
        averageOrderValueCents: v.orders > 0 ? Math.round(v.grossCents / v.orders) : 0,
        sharePct: totalGross > 0 ? +((v.grossCents / totalGross) * 100).toFixed(1) : 0,
      }))
      .sort((a, b) => b.grossRevenueCents - a.grossRevenueCents);

    const totals = [...acc.values()].reduce(
      (s, v) => {
        s.orders += v.orders;
        s.refunded += v.refundedCents;
        s.fee += v.feeCents;
        return s;
      },
      { orders: 0, refunded: 0, fee: 0 }
    );

    return {
      rangeLabel: label,
      totalOrders: totals.orders,
      totalGrossRevenueCents: totalGross,
      totalRefundedCents: totals.refunded,
      totalChannelFeeCents: totals.fee,
      totalNetAfterFeesCents: totalGross - totals.refunded - totals.fee,
      byChannel,
      currency: DEFAULT_CURRENCY,
    };
  });
}

// A single channel's view omits `sharePct` — share-of-total is only meaningful in
// the comparison, which queries every channel together.
export interface ChannelRevenueSummary extends Omit<ChannelRevenueRow, 'sharePct'> {
  rangeLabel: string;
  currency: string;
}

/** One channel's revenue for the window. `channel` is a derived key — a bucket or
 *  a marketplace source slug. Defaults to the last 30 days. */
export async function channelRevenue(
  ctx: ServiceContext,
  input: { channel: string; range?: DateRange }
): Promise<ChannelRevenueSummary> {
  const { from, to, label } = defaultedBounds(input.range);

  return withTenant(ctx, async (tx) => {
    const agg = await tx.order.aggregate({
      where: {
        ...channelKeyWhere(input.channel),
        placedAt: { gte: from, lte: to },
        status: { not: 'cancelled' },
      },
      _count: { _all: true },
      _sum: { total: true, refundTotal: true, channelFeeCents: true },
    });

    const gross = decimalToCents(agg._sum.total);
    const refunded = decimalToCents(agg._sum.refundTotal);
    const fee = agg._sum.channelFeeCents ?? 0;
    const orders = agg._count._all;

    return {
      channel: input.channel,
      label: channelKeyLabel(input.channel),
      rangeLabel: label,
      orders,
      grossRevenueCents: gross,
      refundedCents: refunded,
      netRevenueCents: gross - refunded,
      channelFeeCents: fee,
      netAfterFeesCents: gross - refunded - fee,
      averageOrderValueCents: orders > 0 ? Math.round(gross / orders) : 0,
      currency: DEFAULT_CURRENCY,
    };
  });
}

/** Top products sold through one channel for the window. */
export async function channelTopProducts(
  ctx: ServiceContext,
  input: { channel: string; range?: DateRange; limit?: number }
): Promise<TopProductRow[]> {
  const { from, to } = defaultedBounds(input.range);
  const limit = input.limit ?? 10;
  return withTenant(ctx, (tx) =>
    topProductsForOrders(tx, channelKeyWhere(input.channel), { from, to }, limit)
  );
}
