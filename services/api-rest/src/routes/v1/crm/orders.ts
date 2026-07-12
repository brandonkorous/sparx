// CRM orders — list / get / create / update / cancel + nested payments /
// fulfillments / refunds.
//
//   GET    /v1/crm/orders                       → list (filterable)
//   POST   /v1/crm/orders                       → create
//   GET    /v1/crm/orders/:id                   → fetch one (with items)
//   PATCH  /v1/crm/orders/:id                   → update
//   POST   /v1/crm/orders/:id/cancel            → cancel
//   GET    /v1/crm/orders/:id/payments          → list payments for order
//   POST   /v1/crm/orders/:id/payments          → record a payment
//   POST   /v1/crm/orders/:id/payments/:paymentId/void  → void a payment
//   GET    /v1/crm/orders/:id/fulfillments      → list fulfillments
//   POST   /v1/crm/orders/:id/fulfillments      → create a fulfillment
//   PATCH  /v1/crm/orders/:id/fulfillments/:fId → update a fulfillment
//   GET    /v1/crm/orders/:id/fulfillments/:fId/rates       → live carrier rate quotes
//   GET    /v1/crm/orders/:id/fulfillments/:fId/labels      → purchased labels
//   POST   /v1/crm/orders/:id/fulfillments/:fId/buy-label   → buy a label from a rate
//   POST   /v1/crm/orders/:id/fulfillments/:fId/void-label  → void a purchased label
//   GET    /v1/crm/orders/:id/fulfillments/:fId/track       → live tracking status
//   GET    /v1/crm/orders/:id/refunds           → list refunds
//   POST   /v1/crm/orders/:id/refunds           → record a refund

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import {
  orderService,
  orderPaymentsService,
  orderFulfillmentsService,
  orderRefundsService,
} from '@sparx/crm';
import { listFulfillmentLabels, quoteOutboundRates, shippingService } from '@sparx/commerce';
import { ok, paged } from '@sparx/api-core/envelope';
import { requireRole } from '@sparx/api-core/auth';
import { requireCrmOrCommerceModule, toCrmContext } from '../../../lib/crm-context.js';
import { requireCommerceModule, toCommerceContext } from '../../../lib/commerce-context.js';

const PathId = z.object({ id: z.string().uuid() });
const PaymentPath = z.object({
  id: z.string().uuid(),
  paymentId: z.string().uuid(),
});
const FulfillmentPath = z.object({
  id: z.string().uuid(),
  fulfillmentId: z.string().uuid(),
});
const BuyLabelBody = z.object({ rateRef: z.string().min(1).max(255) });
const VoidLabelBody = z.object({ labelRef: z.string().min(1).max(255) });
const TrackQuery = z.object({
  trackingNumber: z.string().min(1).max(127),
  carrier: z.string().min(1).max(63),
});

const ListQuery = z.object({
  customer_id: z.string().uuid().optional(),
  b2b_account_id: z.string().uuid().optional(),
  status: z.string().optional(),
  payment_status: z.string().optional(),
  // High-level origin bucket — storefront | b2b_portal | admin | import | mcp |
  // marketplace (docs/106 §4.4). The dashboard Orders "Channel" filter.
  channel: z.string().optional(),
  // Origin-site filter (docs/58 D1) — the dashboard Orders Site filter. Omitted
  // → the whole tenant; an id → orders placed on that site (null-origin orders
  // are excluded, so they only appear under "All sites").
  property: z.string().uuid().optional(),
  take: z.coerce.number().int().min(1).max(250).optional(),
  skip: z.coerce.number().int().min(0).optional(),
  sort_by: z.enum(['placedAt', 'updatedAt', 'createdAt']).optional(),
});

const orderRoutes: FastifyPluginAsync = (app) => {
  app.get('/v1/crm/orders', async (request) => {
    requireRole(request, 'viewer');
    await requireCrmOrCommerceModule(request);
    const q = ListQuery.parse(request.query);
    const { items, total } = await orderService.list(toCrmContext(request), {
      customerId: q.customer_id,
      b2bAccountId: q.b2b_account_id,
      status: q.status,
      paymentStatus: q.payment_status,
      channel: q.channel,
      propertyId: q.property,
      take: q.take,
      skip: q.skip,
      sortBy: q.sort_by,
    });
    return paged(items, { total, per_page: q.take ?? 50 });
  });

  app.get('/v1/crm/orders/:id', async (request) => {
    requireRole(request, 'viewer');
    await requireCrmOrCommerceModule(request);
    const { id } = PathId.parse(request.params);
    const order = await orderService.get(toCrmContext(request), id);
    return ok(order);
  });

  app.post('/v1/crm/orders', async (request, reply) => {
    requireRole(request, 'editor');
    await requireCrmOrCommerceModule(request);
    const order = await orderService.create(toCrmContext(request), request.body);
    reply.code(201);
    return ok(order);
  });

  app.patch('/v1/crm/orders/:id', async (request) => {
    requireRole(request, 'editor');
    await requireCrmOrCommerceModule(request);
    const { id } = PathId.parse(request.params);
    const order = await orderService.update(toCrmContext(request), id, request.body);
    return ok(order);
  });

  app.post('/v1/crm/orders/:id/cancel', async (request) => {
    requireRole(request, 'editor');
    await requireCrmOrCommerceModule(request);
    const { id } = PathId.parse(request.params);
    // The service takes a free-form input that already includes the orderId.
    // Pass it through, but make sure the URL param wins so callers can't pass
    // a body whose `orderId` doesn't match the path.
    const body = (request.body ?? {}) as Record<string, unknown>;
    const order = await orderService.cancel(toCrmContext(request), { ...body, orderId: id });
    return ok(order);
  });

  // ── payments ────────────────────────────────────────────────────────────

  app.get('/v1/crm/orders/:id/payments', async (request) => {
    requireRole(request, 'viewer');
    await requireCrmOrCommerceModule(request);
    const { id } = PathId.parse(request.params);
    const rows = await orderPaymentsService.listForOrder(toCrmContext(request), id);
    return ok(rows);
  });

  app.post('/v1/crm/orders/:id/payments', async (request, reply) => {
    requireRole(request, 'editor');
    await requireCrmOrCommerceModule(request);
    const { id } = PathId.parse(request.params);
    const body = (request.body ?? {}) as Record<string, unknown>;
    const payment = await orderPaymentsService.recordPayment(toCrmContext(request), {
      ...body,
      orderId: id,
    });
    reply.code(201);
    return ok(payment);
  });

  app.post('/v1/crm/orders/:id/payments/:paymentId/void', async (request) => {
    requireRole(request, 'editor');
    await requireCrmOrCommerceModule(request);
    const { id, paymentId } = PaymentPath.parse(request.params);
    const body = (request.body ?? {}) as Record<string, unknown>;
    const payment = await orderPaymentsService.voidPayment(toCrmContext(request), {
      ...body,
      orderId: id,
      paymentId,
    });
    return ok(payment);
  });

  // ── fulfillments ────────────────────────────────────────────────────────

  app.get('/v1/crm/orders/:id/fulfillments', async (request) => {
    requireRole(request, 'viewer');
    await requireCrmOrCommerceModule(request);
    const { id } = PathId.parse(request.params);
    const rows = await orderFulfillmentsService.listForOrder(toCrmContext(request), id);
    return ok(rows);
  });

  app.post('/v1/crm/orders/:id/fulfillments', async (request, reply) => {
    requireRole(request, 'editor');
    await requireCrmOrCommerceModule(request);
    const { id } = PathId.parse(request.params);
    const body = (request.body ?? {}) as Record<string, unknown>;
    const fulfillment = await orderFulfillmentsService.createFulfillment(toCrmContext(request), {
      ...body,
      orderId: id,
    });
    reply.code(201);
    return ok(fulfillment);
  });

  app.patch('/v1/crm/orders/:id/fulfillments/:fulfillmentId', async (request) => {
    requireRole(request, 'editor');
    await requireCrmOrCommerceModule(request);
    const { id, fulfillmentId } = FulfillmentPath.parse(request.params);
    const body = (request.body ?? {}) as Record<string, unknown>;
    const fulfillment = await orderFulfillmentsService.updateFulfillment(toCrmContext(request), {
      ...body,
      orderId: id,
      fulfillmentId,
    });
    return ok(fulfillment);
  });

  // ── carrier labels (real Shippo integration — docs/09) ────────────────────

  app.get('/v1/crm/orders/:id/fulfillments/:fulfillmentId/rates', async (request) => {
    requireRole(request, 'viewer');
    await requireCrmOrCommerceModule(request);
    await requireCommerceModule(request);
    const { fulfillmentId } = FulfillmentPath.parse(request.params);
    const rates = await quoteOutboundRates(toCommerceContext(request), fulfillmentId);
    return ok(rates);
  });

  app.get('/v1/crm/orders/:id/fulfillments/:fulfillmentId/labels', async (request) => {
    requireRole(request, 'viewer');
    await requireCrmOrCommerceModule(request);
    await requireCommerceModule(request);
    const { fulfillmentId } = FulfillmentPath.parse(request.params);
    const labels = await listFulfillmentLabels(toCommerceContext(request), fulfillmentId);
    return ok(labels);
  });

  app.post('/v1/crm/orders/:id/fulfillments/:fulfillmentId/buy-label', async (request, reply) => {
    requireRole(request, 'editor');
    await requireCrmOrCommerceModule(request);
    await requireCommerceModule(request);
    const { fulfillmentId } = FulfillmentPath.parse(request.params);
    const { rateRef } = BuyLabelBody.parse(request.body);
    const result = await shippingService.buyLabel(toCommerceContext(request), {
      fulfillmentId,
      rateRef,
    });
    reply.code(201);
    return ok(result);
  });

  app.post('/v1/crm/orders/:id/fulfillments/:fulfillmentId/void-label', async (request) => {
    requireRole(request, 'editor');
    await requireCrmOrCommerceModule(request);
    await requireCommerceModule(request);
    const { fulfillmentId } = FulfillmentPath.parse(request.params);
    const { labelRef } = VoidLabelBody.parse(request.body);
    await shippingService.voidLabel(toCommerceContext(request), { fulfillmentId, labelRef });
    return ok({ voided: true });
  });

  app.get('/v1/crm/orders/:id/fulfillments/:fulfillmentId/track', async (request) => {
    requireRole(request, 'viewer');
    await requireCrmOrCommerceModule(request);
    await requireCommerceModule(request);
    const { trackingNumber, carrier } = TrackQuery.parse(request.query);
    const status = await shippingService.trackShipment(toCommerceContext(request), {
      trackingNumber,
      carrier,
    });
    return ok(status);
  });

  // ── refunds ─────────────────────────────────────────────────────────────

  app.get('/v1/crm/orders/:id/refunds', async (request) => {
    requireRole(request, 'viewer');
    await requireCrmOrCommerceModule(request);
    const { id } = PathId.parse(request.params);
    const rows = await orderRefundsService.listForOrder(toCrmContext(request), id);
    return ok(rows);
  });

  app.post('/v1/crm/orders/:id/refunds', async (request, reply) => {
    requireRole(request, 'editor');
    await requireCrmOrCommerceModule(request);
    const { id } = PathId.parse(request.params);
    const body = (request.body ?? {}) as Record<string, unknown>;
    const refund = await orderRefundsService.recordRefund(toCrmContext(request), {
      ...body,
      orderId: id,
    });
    reply.code(201);
    return ok(refund);
  });

  return Promise.resolve();
};

export default orderRoutes;
