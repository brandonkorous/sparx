// Dropship profitability analytics — aggregates cost vs. revenue across
// dropship orders to surface margin data per supplier and in total.
//
//   GET /v1/dropship/analytics           → overall summary + per-supplier breakdown
//   GET /v1/dropship/analytics/orders    → per-order margin detail

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { withTenant } from '@wizeworks/db';
import { ok, paged } from '@wizeworks/api-core/envelope';
import { requireRole } from '@wizeworks/api-core/auth';
import { requireDropshipModule, toDropshipContext } from '../../../lib/dropship-context.js';

interface LineItem {
  sku: string;
  quantity: number;
  unitPriceCents: number; // cost price
}

const AnalyticsQuery = z.object({
  supplierId: z.string().uuid().optional(),
  from: z.string().optional(), // ISO date e.g. 2026-01-01
  to: z.string().optional(),
});

const OrdersQuery = z.object({
  supplierId: z.string().uuid().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  take: z.coerce.number().int().min(1).max(250).default(50),
  skip: z.coerce.number().int().min(0).default(0),
});

function lineItemsCost(lineItems: unknown): number {
  if (!Array.isArray(lineItems)) return 0;
  return (lineItems as LineItem[]).reduce(
    (sum, li) => sum + (li.quantity ?? 0) * (li.unitPriceCents ?? 0),
    0
  );
}

// eslint-disable-next-line @typescript-eslint/require-await -- FastifyPluginAsync signature
const dropshipAnalyticsRoutes: FastifyPluginAsync = async (app) => {
  // ── Summary + per-supplier breakdown ─────────────────────────────────────────

  app.get('/v1/dropship/analytics', async (request, reply) => {
    await requireDropshipModule(request);
    requireRole(request, 'admin');
    const { tenantId } = toDropshipContext(request);
    const query = AnalyticsQuery.parse(request.query);

    const [dsOrders, orderItems, suppliers] = await withTenant({ tenantId }, async (tx) => {
      const dsWhere: Prisma.DropshipOrderWhereInput = {
        tenantId,
        status: { in: ['submitted', 'shipped', 'delivered'] },
      };
      if (query.supplierId) dsWhere.supplierId = query.supplierId;
      if (query.from || query.to) {
        dsWhere.createdAt = {
          ...(query.from && { gte: new Date(query.from) }),
          ...(query.to && { lte: new Date(query.to) }),
        };
      }

      const dsos = await tx.dropshipOrder.findMany({
        where: dsWhere,
        select: {
          id: true,
          orderId: true,
          supplierId: true,
          lineItems: true,
          status: true,
        },
      });

      // Fetch revenue for the linked order items
      const orderIds = [...new Set(dsos.map((d) => d.orderId))];
      const items =
        orderIds.length > 0
          ? await tx.orderItem.findMany({
              where: {
                tenantId,
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

      const sups = await tx.dropshipSupplier.findMany({
        where: { tenantId, deletedAt: null },
        select: { id: true, name: true },
      });

      return [dsos, items, sups] as const;
    });

    // Build a revenue map: orderId → supplierId → revenueCents
    const revenueMap = new Map<string, Map<string, number>>();
    for (const item of orderItems) {
      const supplierId = item.variant?.dropshipSourceId;
      if (!supplierId) continue;
      const orderMap = revenueMap.get(item.orderId) ?? new Map<string, number>();
      const existing = orderMap.get(supplierId) ?? 0;
      orderMap.set(supplierId, existing + item.quantity * Math.round(Number(item.unitPrice) * 100));
      revenueMap.set(item.orderId, orderMap);
    }

    // Aggregate by supplier
    const supplierMap = new Map<
      string,
      { name: string; costCents: number; revenueCents: number; orders: number }
    >();
    for (const sup of suppliers) {
      supplierMap.set(sup.id, { name: sup.name, costCents: 0, revenueCents: 0, orders: 0 });
    }

    let totalCostCents = 0;
    let totalRevenueCents = 0;
    let totalOrders = 0;

    for (const dso of dsOrders) {
      const cost = lineItemsCost(dso.lineItems);
      const revenue = revenueMap.get(dso.orderId)?.get(dso.supplierId) ?? 0;

      totalCostCents += cost;
      totalRevenueCents += revenue;
      totalOrders++;

      const supEntry = supplierMap.get(dso.supplierId);
      if (supEntry) {
        supEntry.costCents += cost;
        supEntry.revenueCents += revenue;
        supEntry.orders++;
      }
    }

    const margin =
      totalRevenueCents > 0 ? ((totalRevenueCents - totalCostCents) / totalRevenueCents) * 100 : 0;

    const bySupplier = [...supplierMap.entries()]
      .filter(([, s]) => s.orders > 0)
      .map(([id, s]) => ({
        supplierId: id,
        supplierName: s.name,
        orders: s.orders,
        costCents: s.costCents,
        revenueCents: s.revenueCents,
        profitCents: s.revenueCents - s.costCents,
        marginPct:
          s.revenueCents > 0
            ? +(((s.revenueCents - s.costCents) / s.revenueCents) * 100).toFixed(1)
            : 0,
      }))
      .sort((a, b) => b.profitCents - a.profitCents);

    return reply.send(
      ok({
        totalOrders,
        costCents: totalCostCents,
        revenueCents: totalRevenueCents,
        profitCents: totalRevenueCents - totalCostCents,
        marginPct: +margin.toFixed(1),
        bySupplier,
      })
    );
  });

  // ── Per-order detail ──────────────────────────────────────────────────────────

  app.get('/v1/dropship/analytics/orders', async (request, reply) => {
    await requireDropshipModule(request);
    requireRole(request, 'admin');
    const { tenantId } = toDropshipContext(request);
    const query = OrdersQuery.parse(request.query);

    const [dsOrders, total] = await withTenant({ tenantId }, async (tx) => {
      const where: Prisma.DropshipOrderWhereInput = {
        tenantId,
        status: { in: ['submitted', 'shipped', 'delivered'] },
      };
      if (query.supplierId) where.supplierId = query.supplierId;
      if (query.from || query.to) {
        where.createdAt = {
          ...(query.from && { gte: new Date(query.from) }),
          ...(query.to && { lte: new Date(query.to) }),
        };
      }
      return Promise.all([
        tx.dropshipOrder.findMany({
          where,
          include: {
            order: {
              select: {
                orderNumber: true,
                items: {
                  where: { variant: { dropshipSourceId: { not: null } } },
                  select: { quantity: true, unitPrice: true },
                },
              },
            },
            supplier: { select: { name: true } },
          },
          orderBy: { createdAt: 'desc' },
          take: query.take,
          skip: query.skip,
        }),
        tx.dropshipOrder.count({ where }),
      ]);
    });

    const rows = dsOrders.map((dso) => {
      const costCents = lineItemsCost(dso.lineItems);
      const revenueCents = dso.order.items.reduce(
        (sum, item) => sum + item.quantity * Math.round(Number(item.unitPrice) * 100),
        0
      );
      const profitCents = revenueCents - costCents;
      const marginPct = revenueCents > 0 ? +((profitCents / revenueCents) * 100).toFixed(1) : 0;

      return {
        id: dso.id,
        orderId: dso.orderId,
        orderNumber: dso.order.orderNumber,
        supplierId: dso.supplierId,
        supplierName: dso.supplier.name,
        status: dso.status,
        costCents,
        revenueCents,
        profitCents,
        marginPct,
        createdAt: dso.createdAt.toISOString(),
      };
    });

    return reply.send(paged(rows, { total, skip: query.skip, take: query.take }));
  });
};

export default dropshipAnalyticsRoutes;
