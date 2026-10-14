// Dropship orders — visibility into supplier orders for a given commerce order,
// and a manual route-trigger for admin use.
//
//   GET  /v1/dropship/orders               → list (filter by status, orderId)
//   GET  /v1/dropship/orders/:id           → get one
//   POST /v1/dropship/orders/route/:orderId → trigger order routing for an order
//   PATCH /v1/dropship/orders/:id          → the owner records it placed or shipped

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { withTenant } from '@wizeworks/db';
import { ok, paged } from '@wizeworks/api-core/envelope';
import { requireRole } from '@wizeworks/api-core/auth';
import { notFound, validationError } from '@wizeworks/api-core/errors';
import { createPublisher, publishEvent, type PublisherLogger } from '@wizeworks/events';
import { requireDropshipModule, toDropshipContext } from '../../../lib/dropship-context.js';
import { nextDropshipStatus, recordDropshipShipment } from '../../../lib/dropship-shipment.js';
import { publishDomainEvent } from '../../../lib/staff-events.js';

const pubLogger: PublisherLogger = {
  info: (obj, msg) => console.info(msg ?? '', obj),
  warn: (obj, msg) => console.warn(msg ?? '', obj),
  error: (obj, msg) => console.error(msg ?? '', obj),
};
const publisher = createPublisher({ logger: pubLogger });

const PathId = z.object({ id: z.string().uuid() });
const PathOrderId = z.object({ orderId: z.string().uuid() });

/**
 * What the owner records on a supplier order they place by hand (sparx persona
 * issue 170): that they placed it, with the supplier's own order number if they
 * gave one, and that it shipped, with the carrier and tracking.
 */
const RecordBody = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('placed'),
    supplierOrderId: z.string().trim().max(255).optional(),
  }),
  z.object({
    action: z.literal('shipped'),
    carrier: z.string().trim().max(63).optional(),
    trackingNumber: z.string().trim().max(127).optional(),
    trackingUrl: z.string().trim().url().max(2048).optional(),
  }),
]);

// Sortable columns are a server-side whitelist — the enum rejects anything off
// the list rather than interpolating a client string into the orderBy. Sort is
// server-side because the list pages (a client sort of one page is a wrong
// answer once there is a page 2).
const OrderSort = z.enum(['createdAt', 'status', 'supplierId']);

const ListQuery = z.object({
  orderId: z.string().uuid().optional(),
  supplierId: z.string().uuid().optional(),
  status: z
    .enum(['pending', 'submitted', 'shipped', 'delivered', 'failed', 'cancelled'])
    .optional(),
  sort_by: OrderSort.optional(),
  order: z.enum(['asc', 'desc']).optional(),
  take: z.coerce.number().int().min(1).max(250).default(50),
  skip: z.coerce.number().int().min(0).default(0),
});

function toOrderView(o: {
  id: string;
  orderId: string;
  supplierId: string;
  supplierOrderId: string | null;
  status: string;
  trackingNumber: string | null;
  trackingUrl: string | null;
  errorMessage: string | null;
  lineItems: unknown;
  submittedAt: Date | null;
  shippedAt: Date | null;
  deliveredAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  // The customer order this was routed from — its human number, so the list can
  // show "#1043" instead of a raw uuid. Populated by the `order` include.
  order?: { orderNumber: string | null } | null;
}) {
  return {
    id: o.id,
    orderId: o.orderId,
    orderNumber: o.order?.orderNumber ?? null,
    supplierId: o.supplierId,
    supplierOrderId: o.supplierOrderId,
    status: o.status,
    trackingNumber: o.trackingNumber,
    trackingUrl: o.trackingUrl,
    errorMessage: o.errorMessage,
    lineItems: o.lineItems,
    submittedAt: o.submittedAt?.toISOString() ?? null,
    shippedAt: o.shippedAt?.toISOString() ?? null,
    deliveredAt: o.deliveredAt?.toISOString() ?? null,
    createdAt: o.createdAt.toISOString(),
    updatedAt: o.updatedAt.toISOString(),
  };
}

// eslint-disable-next-line @typescript-eslint/require-await -- FastifyPluginAsync signature
const dropshipOrderRoutes: FastifyPluginAsync = async (app) => {
  app.get('/v1/dropship/orders', async (request, reply) => {
    await requireDropshipModule(request);
    requireRole(request, 'editor');
    const { tenantId } = toDropshipContext(request);
    const query = ListQuery.parse(request.query);

    const [orders, total] = await withTenant({ tenantId }, async (tx) => {
      const where: {
        tenantId: string;
        orderId?: string;
        supplierId?: string;
        status?: string;
      } = { tenantId };
      if (query.orderId) where.orderId = query.orderId;
      if (query.supplierId) where.supplierId = query.supplierId;
      if (query.status) where.status = query.status;
      const orderBy: Prisma.DropshipOrderOrderByWithRelationInput = {
        [query.sort_by ?? 'createdAt']: query.order ?? 'desc',
      };
      return Promise.all([
        tx.dropshipOrder.findMany({
          where,
          include: { order: { select: { orderNumber: true } } },
          orderBy,
          take: query.take,
          skip: query.skip,
        }),
        tx.dropshipOrder.count({ where }),
      ]);
    });

    return reply.send(
      paged(orders.map(toOrderView), { total, skip: query.skip, take: query.take })
    );
  });

  app.get('/v1/dropship/orders/:id', async (request, reply) => {
    await requireDropshipModule(request);
    requireRole(request, 'editor');
    const { tenantId } = toDropshipContext(request);
    const { id } = PathId.parse(request.params);

    const order = await withTenant({ tenantId }, async (tx) => {
      return tx.dropshipOrder.findFirst({
        where: { id, tenantId },
        include: { order: { select: { orderNumber: true } } },
      });
    });
    if (!order) throw notFound('Dropship order not found');

    return reply.send(ok(toOrderView(order)));
  });

  // The owner records what happened to an order they place with a supplier by
  // hand. "Shipped" also records the shipment on the customer's order, which is
  // what moves it on and sends the customer their tracking (sparx persona issue
  // 170).
  app.patch('/v1/dropship/orders/:id', async (request, reply) => {
    await requireDropshipModule(request);
    requireRole(request, 'editor');
    const { tenantId, userId } = toDropshipContext(request);
    const { id } = PathId.parse(request.params);
    const body = RecordBody.parse(request.body);

    const current = await withTenant({ tenantId }, (tx) =>
      tx.dropshipOrder.findFirst({ where: { id, tenantId } })
    );
    if (!current) throw notFound('Dropship order not found');
    const next = nextDropshipStatus(current.status, body.action);
    if (!next) {
      throw validationError(
        body.action === 'placed'
          ? 'This order has already been placed with the supplier.'
          : 'This order has already shipped.'
      );
    }

    const now = new Date();
    const updated = await withTenant({ tenantId }, (tx) =>
      tx.dropshipOrder.update({
        where: { id },
        data:
          body.action === 'placed'
            ? {
                status: next,
                submittedAt: now,
                errorMessage: null,
                ...(body.supplierOrderId ? { supplierOrderId: body.supplierOrderId } : {}),
              }
            : {
                status: next,
                shippedAt: now,
                errorMessage: null,
                ...(current.submittedAt ? {} : { submittedAt: now }),
                trackingNumber: body.trackingNumber ?? null,
                trackingUrl: body.trackingUrl ?? null,
              },
        include: { order: { select: { orderNumber: true } } },
      })
    );

    if (body.action === 'shipped') {
      await recordDropshipShipment(tenantId, userId, {
        dropshipOrderId: id,
        carrier: body.carrier ?? null,
        trackingNumber: body.trackingNumber ?? null,
        trackingUrl: body.trackingUrl ?? null,
      });
    }
    await publishDomainEvent(
      body.action === 'placed' ? 'dropship.order.submitted' : 'dropship.order.shipped',
      tenantId,
      userId,
      {
        dropshipOrderId: id,
        orderId: current.orderId,
        supplierId: current.supplierId,
        ...(body.action === 'placed'
          ? { supplierOrderId: updated.supplierOrderId }
          : {
              trackingNumber: body.trackingNumber ?? null,
              trackingUrl: body.trackingUrl ?? null,
              carrier: body.carrier ?? null,
            }),
      }
    );

    return reply.send(ok(toOrderView(updated)));
  });

  // Manual trigger — routes a commerce order through dropship suppliers.
  // Normally triggered automatically via order.placed / order.paid event,
  // but exposed here for manual recovery or admin use.
  app.post('/v1/dropship/orders/route/:orderId', async (request, reply) => {
    await requireDropshipModule(request);
    requireRole(request, 'admin');
    const { tenantId, userId } = toDropshipContext(request);
    const { orderId } = PathOrderId.parse(request.params);

    const order = await withTenant({ tenantId }, async (tx) => {
      return tx.order.findFirst({ where: { id: orderId, tenantId } });
    });
    if (!order) throw notFound('Order not found');

    await publishEvent(publisher, 'dropship.order.route', tenantId, userId, { orderId }, pubLogger);

    return reply.send(ok({ orderId, status: 'routing_queued' }));
  });
};

export default dropshipOrderRoutes;
