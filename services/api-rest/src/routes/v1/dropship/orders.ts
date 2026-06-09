// Dropship orders — visibility into supplier orders for a given commerce order,
// and a manual route-trigger for admin use.
//
//   GET  /v1/dropship/orders               → list (filter by status, orderId)
//   GET  /v1/dropship/orders/:id           → get one
//   POST /v1/dropship/orders/route/:orderId → trigger order routing for an order

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { withTenant, type TxClient } from '@sparx/db';
import { ok, paged } from '@sparx/api-core/envelope';
import { requireRole } from '@sparx/api-core/auth';
import { notFound } from '@sparx/api-core/errors';
import { createPublisher, publishEvent, type PublisherLogger } from '@sparx/events';
import { requireDropshipModule, toDropshipContext } from '../../../lib/dropship-context.js';

type AnyTx = TxClient & Record<string, any>;

const PathId = z.object({ id: z.string().uuid() });
const PathOrderId = z.object({ orderId: z.string().uuid() });

const ListQuery = z.object({
  orderId: z.string().uuid().optional(),
  supplierId: z.string().uuid().optional(),
  status: z
    .enum(['pending', 'submitted', 'shipped', 'delivered', 'failed', 'cancelled'])
    .optional(),
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
}) {
  return {
    id: o.id,
    orderId: o.orderId,
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

const dropshipOrderRoutes: FastifyPluginAsync = async (app) => {
  const publisher = createPublisher(app.log as unknown as PublisherLogger);

  app.get('/v1/dropship/orders', async (request, reply) => {
    await requireDropshipModule(request);
    requireRole(request, 'admin', 'owner', 'staff');
    const { tenantId } = toDropshipContext(request);
    const query = ListQuery.parse(request.query);

    const [orders, total] = await withTenant({ tenantId } as any, async (tx) => {
      const where: any = { tenantId };
      if (query.orderId) where.orderId = query.orderId;
      if (query.supplierId) where.supplierId = query.supplierId;
      if (query.status) where.status = query.status;
      return Promise.all([
        (tx as AnyTx).dropshipOrder.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          take: query.take,
          skip: query.skip,
        }),
        (tx as AnyTx).dropshipOrder.count({ where }),
      ]);
    });

    return reply.send(
      paged(orders.map(toOrderView), { total, skip: query.skip, take: query.take })
    );
  });

  app.get('/v1/dropship/orders/:id', async (request, reply) => {
    await requireDropshipModule(request);
    requireRole(request, 'admin', 'owner', 'staff');
    const { tenantId } = toDropshipContext(request);
    const { id } = PathId.parse(request.params);

    const order = await withTenant({ tenantId } as any, async (tx) => {
      return (tx as AnyTx).dropshipOrder.findFirst({ where: { id, tenantId } });
    });
    if (!order) throw notFound('Dropship order not found');

    return reply.send(ok(toOrderView(order)));
  });

  // Manual trigger — routes a commerce order through dropship suppliers.
  // Normally triggered automatically via order.placed / order.paid event,
  // but exposed here for manual recovery or admin use.
  app.post('/v1/dropship/orders/route/:orderId', async (request, reply) => {
    await requireDropshipModule(request);
    requireRole(request, 'admin', 'owner');
    const { tenantId, userId } = toDropshipContext(request);
    const { orderId } = PathOrderId.parse(request.params);

    const order = await withTenant({ tenantId } as any, async (tx) => {
      return (tx as AnyTx).order.findFirst({ where: { id: orderId, tenantId } });
    });
    if (!order) throw notFound('Order not found');

    await publishEvent(publisher, 'dropship.order.route', tenantId, userId, { orderId }, app.log);

    return reply.send(ok({ orderId, status: 'routing_queued' }));
  });
};

export default dropshipOrderRoutes;
