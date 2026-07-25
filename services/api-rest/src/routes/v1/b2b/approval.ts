// B2B purchase approval — rules configuration + approval queue (docs/10 §12,
// docs/64 B2B Ph6). Thin transport over @sparx/b2b's approvalService.
//
//   GET    /v1/b2b/approval-rules              → list all rules
//   POST   /v1/b2b/approval-rules              → create rule
//   PATCH  /v1/b2b/approval-rules/:id          → update (threshold, approver, isActive)
//   DELETE /v1/b2b/approval-rules/:id          → deactivate
//
//   GET    /v1/b2b/approval-queue              → pending_approval orders
//   POST   /v1/b2b/approval-queue/:orderId/approve  → approve + place order
//   POST   /v1/b2b/approval-queue/:orderId/reject   → reject + cancel order
//
// The mutating transitions return the domain events to publish (the service stays
// free of publisher plumbing); this route emits them through its own createPublisher
// exactly as before, plus the inventory threshold events for the committed sale.

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { approvalService, type PendingEvent } from '@sparx/b2b';
import { inventoryService } from '@sparx/inventory';
import { ok, paged } from '@sparx/api-core/envelope';
import { requireRole } from '@sparx/api-core/auth';
import { createPublisher, publishEvent, type PublisherLogger } from '@sparx/events';
import { requireB2bModule, toB2bContext } from '../../../lib/b2b-context.js';
import { resolvePropertyId } from '../../../lib/property.js';
import { env } from '../../../env.js';

const pubLogger: PublisherLogger = {
  info: (obj, msg) => console.info(msg ?? '', obj),
  warn: (obj, msg) => console.warn(msg ?? '', obj),
  error: (obj, msg) => console.error(msg ?? '', obj),
};
const publisher = createPublisher({ projectId: env.GCP_PROJECT_ID, logger: pubLogger });

async function emit(
  ctx: { tenantId: string; userId: string },
  events: PendingEvent[]
): Promise<void> {
  for (const e of events) {
    await publishEvent(publisher, e.type, ctx.tenantId, ctx.userId ?? null, e.payload, pubLogger);
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

  // ── Delete (deactivate) rule ──────────────────────────────────────────────
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
    await emit(ctx, result.events);

    return reply.send(ok(result.order));
  });

  // ── Reject order ──────────────────────────────────────────────────────────
  app.post('/v1/b2b/approval-queue/:orderId/reject', async (request, reply) => {
    await requireB2bModule(request);
    requireRole(request, 'editor');
    const ctx = toB2bContext(request);
    const { orderId } = PathOrderId.parse(request.params);
    const result = await approvalService.rejectOrder(ctx, orderId, request.body);
    await emit(ctx, result.events);
    return reply.send(ok(result.order));
  });
};

export default b2bApprovalRoutes;
