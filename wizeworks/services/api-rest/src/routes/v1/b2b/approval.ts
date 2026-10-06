// B2B purchase approval — rules configuration + approval queue (docs/10 §12,
// docs/64 B2B Ph6). Thin transport over @wizeworks/b2b's approvalService.
//
//   GET    /v1/b2b/approval-rules              → list all rules
//   POST   /v1/b2b/approval-rules              → create rule
//   PATCH  /v1/b2b/approval-rules/:id          → update (threshold, approver, isActive)
//   DELETE /v1/b2b/approval-rules/:id          → remove (really; the switch is the PATCH)
//
//   GET    /v1/b2b/approval-queue              → pending_approval orders
//   POST   /v1/b2b/approval-queue/:orderId/approve  → approve + place order
//   POST   /v1/b2b/approval-queue/:orderId/reject   → reject + cancel order
//
// The mutating transitions return the domain events to publish (the service stays
// free of publisher plumbing); this route emits them through api-core's publish,
// plus the inventory threshold events for the committed sale.

import type { FastifyBaseLogger, FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { approvalService, type PendingEvent } from '@wizeworks/b2b';
import { inventoryService } from '@wizeworks/inventory';
import { ok, paged } from '@wizeworks/api-core/envelope';
import { requireRole } from '@wizeworks/api-core/auth';
import { publish } from '@wizeworks/api-core/pubsub';
import { requireB2bModule, toB2bContext } from '../../../lib/b2b-context.js';
import { resolvePropertyId } from '../../../lib/property.js';
import { settleHeldOrderMoney } from '../../../lib/held-order-money.js';

/** Publish what a decision caused, once it has committed. Through api-core's
 *  publish, which also queues the business's own webhooks: a sign-off can
 *  announce `order.paid`, and a business can subscribe to that one (sparx
 *  persona issue 087). */
async function emit(
  log: FastifyBaseLogger,
  ctx: { tenantId: string; userId: string },
  events: PendingEvent[]
): Promise<void> {
  for (const e of events) {
    await publish(log, e.type, ctx.tenantId, ctx.userId ?? null, e.payload);
  }
}

const PathId = z.object({ id: z.string().uuid() });
const PathOrderId = z.object({ orderId: z.string().uuid() });

// eslint-disable-next-line @typescript-eslint/require-await -- FastifyPluginAsync signature
const b2bApprovalRoutes: FastifyPluginAsync = async (app) => {
  // ── List rules ────────────────────────────────────────────────────────────
  app.get('/v1/b2b/approval-rules', async (request) => {
    await requireB2bModule(request);
    requireRole(request, 'editor');
    const ctx = toB2bContext(request);
    return ok(await approvalService.listRules(ctx));
  });

  // ── Create rule ───────────────────────────────────────────────────────────
  app.post('/v1/b2b/approval-rules', async (request, reply) => {
    await requireB2bModule(request);
    const auth = requireRole(request, 'admin');
    const ctx = toB2bContext(request);
    // The active site is the default scope when the body omits propertyId; an
    // explicit null makes the rule apply everywhere (docs/131 §4).
    const scopeId = await resolvePropertyId(
      auth,
      request.headers['x-sparx-property-id'] as string | undefined
    );
    const rule = await approvalService.createRule(ctx, request.body, scopeId);
    return reply.status(201).send(ok(rule));
  });

  // ── Update rule ───────────────────────────────────────────────────────────
  app.patch('/v1/b2b/approval-rules/:id', async (request, reply) => {
    await requireB2bModule(request);
    requireRole(request, 'admin');
    const ctx = toB2bContext(request);
    const { id } = PathId.parse(request.params);
    return reply.send(ok(await approvalService.updateRule(ctx, id, request.body)));
  });

  // ── Remove rule ───────────────────────────────────────────────────────────
  app.delete('/v1/b2b/approval-rules/:id', async (request, reply) => {
    await requireB2bModule(request);
    requireRole(request, 'admin');
    const ctx = toB2bContext(request);
    const { id } = PathId.parse(request.params);
    await approvalService.deleteRule(ctx, id);
    return reply.status(204).send();
  });

  // ── Approval queue (pending_approval orders) ──────────────────────────────
  app.get('/v1/b2b/approval-queue', async (request) => {
    await requireB2bModule(request);
    requireRole(request, 'editor');
    const ctx = toB2bContext(request);
    const { items, total, skip, take } = await approvalService.listQueue(
      ctx,
      approvalService.ApprovalQueueQuery.parse(request.query)
    );
    return paged(items, { total, skip, take });
  });

  // ── Approve order ─────────────────────────────────────────────────────────
  app.post('/v1/b2b/approval-queue/:orderId/approve', async (request, reply) => {
    await requireB2bModule(request);
    requireRole(request, 'editor');
    const ctx = toB2bContext(request);
    const { orderId } = PathOrderId.parse(request.params);
    const result = await approvalService.approveOrder(ctx, orderId, request.body);

    // Inventory threshold events fire after the approval transaction commits.
    if (result.committedSales.length > 0) {
      await inventoryService.emitSaleEvents(ctx, result.committedSales);
    }
    // The card held at checkout is charged now it is placed (sparx persona issue
    // 087). After the commit, like the events.
    await settleHeldOrderMoney(request.log, ctx, result.money);
    await emit(request.log, ctx, result.events);

    return reply.send(ok(result.order));
  });

  // ── Reject order ──────────────────────────────────────────────────────────
  app.post('/v1/b2b/approval-queue/:orderId/reject', async (request, reply) => {
    await requireB2bModule(request);
    requireRole(request, 'editor');
    const ctx = toB2bContext(request);
    const { orderId } = PathOrderId.parse(request.params);
    const result = await approvalService.rejectOrder(ctx, orderId, request.body);
    // The buyer gets their money back: a held card let go, a charged one refunded
    // in full (sparx persona issue 087). It used to be kept.
    await settleHeldOrderMoney(request.log, ctx, result.money);
    await emit(request.log, ctx, result.events);
    return reply.send(ok(result.order));
  });
};

export default b2bApprovalRoutes;
