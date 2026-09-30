// Orders, as files a spreadsheet or another system can open.
//
//   GET /v1/export/orders       → one row per order
//   GET /v1/export/order-lines  → one row per line on those orders
//
// Two files rather than one with the lines packed into a cell. A cell holding
// "2 x Sourdough; 1 x Rye" cannot be filtered, summed or re-imported, and "how
// many loaves of rye did I sell in March" is exactly the question a person opens
// this file to answer. The line file carries the order number and date on every
// row, so it stands on its own and joins back to the order file on that number.
//
// Gated like every other order read (requireOrderAccess: Commerce, B2B or CRM),
// not on Commerce alone. Orders are a shared spine; a CRM-only tenant has them
// too, and the promise is that she can take hers with her.
//
// Amounts on Order and OrderItem are stored as decimals in MAJOR units
// (Decimal(12, 2)), so they are written as they are, two places, no symbol.

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import type { Prisma } from '@wizeworks/db';
import { orderService } from '@wizeworks/crm';
import { csvSafeText } from '@wizeworks/inventory';
import { requireRole } from '@wizeworks/api-core/auth';
import { withRequestTenant } from '@wizeworks/api-core/db';
import { requireOrderAccess, toOrderContext } from '../../lib/order-context.js';
import { reachableSiteIds } from '../../lib/property.js';
import {
  EXPORT_ROW_CAP,
  collectPages,
  decimalAmount,
  sendCsvExport,
} from '../../lib/record-export.js';

const ExportQuery = z.object({
  status: z.string().max(20).optional(),
  take: z.coerce.number().int().min(1).max(EXPORT_ROW_CAP).optional(),
});

/** The list service's own page ceiling. */
const PAGE = 250;

/**
 * How much of an order has gone out, from its lines.
 *
 * Measured, not stored: there is no fulfillment column on Order (its `status`
 * mixes "fulfilled" with "cancelled" and "refunded"), so the answer is the sum
 * of what each line says was sent. An order with no lines has no answer and
 * gets a blank, never "unfulfilled".
 */
function fulfillmentOf(ordered: number, sent: number): string | null {
  if (ordered <= 0) return null;
  if (sent <= 0) return 'unfulfilled';
  if (sent >= ordered) return 'fulfilled';
  return 'partially_fulfilled';
}

function personName(customer: {
  firstName: string | null;
  lastName: string | null;
  companyName: string | null;
}): string | null {
  const full = [customer.firstName, customer.lastName].filter(Boolean).join(' ').trim();
  return full !== '' ? full : (customer.companyName ?? null);
}

// eslint-disable-next-line @typescript-eslint/require-await
const orderExportRoutes: FastifyPluginAsync = async (app) => {
  app.get('/v1/export/orders', async (request, reply) => {
    const auth = requireRole(request, 'viewer');
    await requireOrderAccess(request);
    const q = ExportQuery.parse(request.query);
    const ctx = toOrderContext(request);
    const propertyIds = reachableSiteIds(auth);

    const orders = await collectPages(PAGE, q.take ?? EXPORT_ROW_CAP, (skip, take) =>
      orderService.list(ctx, {
        status: q.status,
        propertyIds,
        take,
        skip,
        sortBy: 'placedAt',
        order: 'desc',
      })
    );

    // Line counts and what has been sent, for every exported order, in one
    // grouped read rather than one per order.
    const lineTotals = new Map<string, { lines: number; ordered: number; sent: number }>();
    const ids = orders.map((o) => o.id);
    for (let i = 0; i < ids.length; i += 1_000) {
      const chunk = ids.slice(i, i + 1_000);
      const groups = await withRequestTenant(request, (tx) =>
        tx.orderItem.groupBy({
          by: ['orderId'],
          where: { orderId: { in: chunk } },
          _count: { _all: true },
          _sum: { quantity: true, quantityFulfilled: true },
        })
      );
      for (const g of groups) {
        lineTotals.set(g.orderId, {
          lines: g._count._all,
          ordered: g._sum.quantity ?? 0,
          sent: g._sum.quantityFulfilled ?? 0,
        });
      }
    }

    return sendCsvExport(reply, {
      name: 'orders',
      headers: [
        'order_number',
        'placed_at',
        'status',
        'payment_status',
        'fulfillment_status',
        'customer_name',
        'customer_email',
        'business',
        'channel',
        'currency',
        'subtotal',
        'discount',
        'shipping',
        'tax',
        'surcharge',
        'total',
        'amount_paid',
        'refunded',
        'line_count',
        'item_quantity',
      ],
      rows: orders.map((o) => {
        const lines = lineTotals.get(o.id);
        return [
          o.orderNumber,
          o.placedAt,
          o.status,
          o.paymentStatus,
          lines ? fulfillmentOf(lines.ordered, lines.sent) : null,
          csvSafeText(personName(o.customer)),
          o.customer.email,
          csvSafeText(o.customer.b2bAccount?.companyName ?? null),
          o.channel,
          o.currency,
          decimalAmount(o.subtotal),
          decimalAmount(o.discountTotal),
          decimalAmount(o.shippingTotal),
          decimalAmount(o.taxTotal),
          decimalAmount(o.surchargeTotal),
          decimalAmount(o.total),
          decimalAmount(o.amountPaid),
          decimalAmount(o.refundTotal),
          lines?.lines ?? 0,
          lines?.ordered ?? 0,
        ];
      }),
    });
  });

  app.get('/v1/export/order-lines', async (request, reply) => {
    const auth = requireRole(request, 'viewer');
    await requireOrderAccess(request);
    const q = ExportQuery.parse(request.query);
    const propertyIds = reachableSiteIds(auth);

    // The same site ceiling the order list applies (docs/131 §3.3): a member
    // restricted to some businesses gets only those businesses' lines.
    const orderWhere: Prisma.OrderWhereInput = {
      ...(q.status ? { status: q.status } : {}),
      ...(propertyIds ? { propertyId: { in: propertyIds } } : {}),
    };

    const lines = await withRequestTenant(request, (tx) =>
      tx.orderItem.findMany({
        where: { order: orderWhere },
        orderBy: [{ order: { placedAt: 'desc' } }, { orderId: 'asc' }, { createdAt: 'asc' }],
        take: q.take ?? EXPORT_ROW_CAP,
        select: {
          sku: true,
          name: true,
          quantity: true,
          uomCode: true,
          unitsPerUom: true,
          unitPrice: true,
          lineSubtotal: true,
          discountAmount: true,
          taxAmount: true,
          lineTotal: true,
          quantityFulfilled: true,
          quantityRefunded: true,
          order: {
            select: { orderNumber: true, placedAt: true, status: true, currency: true },
          },
        },
      })
    );

    return sendCsvExport(reply, {
      name: 'order-lines',
      headers: [
        'order_number',
        'placed_at',
        'order_status',
        'sku',
        'item',
        'quantity',
        'sold_as',
        'unit_price',
        'currency',
        'line_subtotal',
        'discount',
        'tax',
        'line_total',
        'quantity_sent',
        'quantity_refunded',
      ],
      rows: lines.map((l) => [
        l.order.orderNumber,
        l.order.placedAt,
        l.order.status,
        csvSafeText(l.sku),
        csvSafeText(l.name),
        l.quantity,
        // "PR x 2" for a customer who bought two pairs; blank when sold singly.
        l.uomCode
          ? `${l.uomCode} x ${String(Math.round(l.quantity / (l.unitsPerUom || 1)))}`
          : null,
        decimalAmount(l.unitPrice),
        l.order.currency,
        decimalAmount(l.lineSubtotal),
        decimalAmount(l.discountAmount),
        decimalAmount(l.taxAmount),
        decimalAmount(l.lineTotal),
        l.quantityFulfilled,
        l.quantityRefunded,
      ]),
    });
  });
};

export default orderExportRoutes;
