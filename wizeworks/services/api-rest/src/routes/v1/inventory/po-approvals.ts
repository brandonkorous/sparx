// Purchase-order approval API (docs/146 Phase 8.5) — the spending control on the
// way out.
//
// Rules:
//   GET    /v1/inventory/purchase-orders/approval-rules
//   POST   /v1/inventory/purchase-orders/approval-rules
//   PATCH  /v1/inventory/purchase-orders/approval-rules/:id
//   DELETE /v1/inventory/purchase-orders/approval-rules/:id
//
// The queue:
//   GET  /v1/inventory/purchase-orders/approvals            — pending by default
//   POST /v1/inventory/purchase-orders/approvals/:id/decide — approve or reject
//   POST /v1/inventory/purchase-orders/approvals/:id/cancel — withdraw
//
// Rescheduling a placed order (Phase 8.3 — it re-arms the late alert):
//   POST /v1/inventory/purchase-orders/:id/reschedule
//
// Roles, and this is the one place the split really matters. Reading the queue is
// `viewer` — a buyer must be able to see that their order is waiting and who on.
// WRITING A RULE IS `admin`: a spending control that an ordinary editor can
// raise the threshold on is not a control, and the person the rule constrains is
// exactly the person who must not be able to edit it. Deciding is `editor` plus
// the service-level check that a NAMED approver is the one signing.

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { queryBool } from '@wizeworks/api-core/query';
import { inventoryService } from '@wizeworks/inventory';
import { ok, paged } from '@wizeworks/api-core/envelope';
import { requireRole } from '@wizeworks/api-core/auth';
import { requireInventoryModule, toInventoryContext } from '../../../lib/inventory-context.js';

const IdPath = z.object({ id: z.string().uuid() });

const RulesQuery = z.object({
  include_inactive: queryBool.optional(),
});

const QueueQuery = z.object({
  // `all` is not a state an approval can be in — it is the absence of the
  // filter, named so a caller can ask for it. Without it the only way to reach
  // the whole trail was to name one order, so a queue could be read four ways
  // and never as a whole.
  status: z.enum(['pending', 'approved', 'rejected', 'cancelled', 'all']).optional(),
  purchase_order_id: z.string().uuid().optional(),
  required_approver_user_id: z.string().uuid().optional(),
  take: z.coerce.number().int().min(1).max(250).optional(),
  skip: z.coerce.number().int().min(0).optional(),
});

// eslint-disable-next-line @typescript-eslint/require-await -- FastifyPluginAsync signature
const poApprovalRoutes: FastifyPluginAsync = async (app) => {
  // ── Rules ──────────────────────────────────────────────────────────────────

  app.get('/v1/inventory/purchase-orders/approval-rules', async (request, reply) => {
    await requireInventoryModule(request);
    requireRole(request, 'viewer');
    const q = RulesQuery.parse(request.query);
    const result = await inventoryService.listPoApprovalRules(toInventoryContext(request), {
      ...(q.include_inactive !== undefined ? { includeInactive: q.include_inactive } : {}),
    });
    return reply.send(paged(result.items, { total: result.total, skip: 0, per_page: 250 }));
  });

  app.post('/v1/inventory/purchase-orders/approval-rules', async (request, reply) => {
    await requireInventoryModule(request);
    requireRole(request, 'admin');
    return reply
      .status(201)
      .send(
        ok(await inventoryService.createPoApprovalRule(toInventoryContext(request), request.body))
      );
  });

  app.patch('/v1/inventory/purchase-orders/approval-rules/:id', async (request, reply) => {
    await requireInventoryModule(request);
    requireRole(request, 'admin');
    const { id } = IdPath.parse(request.params);
    return reply.send(
      ok(await inventoryService.updatePoApprovalRule(toInventoryContext(request), id, request.body))
    );
  });

  app.delete('/v1/inventory/purchase-orders/approval-rules/:id', async (request, reply) => {
    await requireInventoryModule(request);
    requireRole(request, 'admin');
    const { id } = IdPath.parse(request.params);
    await inventoryService.deletePoApprovalRule(toInventoryContext(request), id);
    return reply.status(204).send();
  });

  // ── The queue ──────────────────────────────────────────────────────────────

  app.get('/v1/inventory/purchase-orders/approvals', async (request, reply) => {
    await requireInventoryModule(request);
    requireRole(request, 'viewer');
    const q = QueueQuery.parse(request.query);
    // Two different questions share this route, and they have opposite defaults.
    //
    // With no order named it is THE QUEUE — a list of things to do — so it is
    // pending unless asked otherwise, and the decided ones are history.
    //
    // With one order named it is THAT ORDER'S TRAIL, and the whole point of a
    // trail is the refusals: who asked, who said no and why, then who asked
    // again. Defaulting that to pending returned an empty list for every order
    // that had been dealt with, which is how the buyer's own pane came to show
    // nothing at all after their order was sent back — over a dialog that had
    // promised them "the buyer sees it".
    //
    // `status=all` now says it outright, for either question. Sent back has had
    // an "Everything" view since it shipped; this queue had four filters and no
    // way to see a history across them, because the route had no word for it.
    const wholeTrail =
      q.status === 'all' || (q.purchase_order_id !== undefined && q.status === undefined);
    // `ok(result)`: `pending` is the count of everything still waiting whatever
    // this page is filtered to — the badge on the nav item — so it belongs in
    // the body rather than in pagination meta.
    return reply.send(
      ok(
        await inventoryService.listPoApprovals(toInventoryContext(request), {
          ...(wholeTrail || q.status === 'all' ? {} : { status: q.status ?? 'pending' }),
          ...(q.purchase_order_id ? { purchaseOrderId: q.purchase_order_id } : {}),
          ...(q.required_approver_user_id
            ? { requiredApproverUserId: q.required_approver_user_id }
            : {}),
          ...(q.take !== undefined ? { take: q.take } : {}),
          ...(q.skip !== undefined ? { skip: q.skip } : {}),
        })
      )
    );
  });

  app.post('/v1/inventory/purchase-orders/approvals/:id/decide', async (request, reply) => {
    await requireInventoryModule(request);
    // `editor` is the floor for touching buying at all. The RULE is what narrows
    // it beyond that, so the signer's role goes to the service, which refuses
    // anyone the rule did not route to. Without it, "the owner signs it off" was
    // satisfied by the same editor who raised the order.
    const auth = requireRole(request, 'editor');
    const { id } = IdPath.parse(request.params);
    return reply.send(
      ok(
        await inventoryService.decidePoApproval(
          toInventoryContext(request),
          id,
          request.body,
          auth.role
        )
      )
    );
  });

  app.post('/v1/inventory/purchase-orders/approvals/:id/cancel', async (request, reply) => {
    await requireInventoryModule(request);
    requireRole(request, 'editor');
    const { id } = IdPath.parse(request.params);
    return reply.send(ok(await inventoryService.cancelPoApproval(toInventoryContext(request), id)));
  });

  // ── Rescheduling a placed order ────────────────────────────────────────────

  app.post('/v1/inventory/purchase-orders/:id/reschedule', async (request, reply) => {
    await requireInventoryModule(request);
    requireRole(request, 'editor');
    const { id } = IdPath.parse(request.params);
    return reply.send(
      ok(
        await inventoryService.reschedulePurchaseOrderArrival(
          toInventoryContext(request),
          id,
          request.body
        )
      )
    );
  });
};

export default poApprovalRoutes;
