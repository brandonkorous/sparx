// B2B customer portal: the account's own approver signs off its orders
// (sparx persona issue 087).
//
// A contact can be given the role "Can approve orders", and nothing ever asked
// them anything: a held order went to the business's team, and the approver
// could look at it but not approve it. When the spending limit that held an
// order is set to be signed off by the account's own approvers, these are the
// routes they sign it with, from their wholesale account pages.
//
//   GET  /v1/public/b2b/portal/:accountId/approvals?tenant=
//        → the account's held orders waiting for THIS approver's yes
//   POST /v1/public/b2b/portal/:accountId/orders/:orderId/approve?tenant= { reason? }
//        → sign the account's part; the order goes ahead if nobody else is
//          waiting, and otherwise keeps waiting for the business
//   POST /v1/public/b2b/portal/:accountId/orders/:orderId/reject?tenant=  { reason? }
//        → turn it down, which cancels it and tells whoever placed it why
//
// GUARDS. A signed-in customer for this site, an ACTIVE contact on the account
// in the path with the role `approver`, never on an order they placed, and only
// when the rule that held it asks the account (all checked in
// `approvalService`). The two writes take a website session: a connected app
// holds only `b2b:read` and may read, never approve (lib/portal-writer.ts).
//
// The writes publish what they caused once the transaction has committed, the
// same events the console's Approve and Reject publish: the buyer is emailed,
// stock is taken, and an order on terms is invoiced.

import type { FastifyBaseLogger, FastifyPluginAsync, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { approvalService, type PendingEvent } from '@wizeworks/b2b';
import { inventoryService } from '@wizeworks/inventory';
import { isModuleEnabled } from '@wizeworks/auth';
import { ok } from '@wizeworks/api-core/envelope';
import { publish } from '@wizeworks/api-core/pubsub';
import { moduleDisabled } from '@wizeworks/api-core/errors';
import { type CustomerAuthContext } from '@wizeworks/customer-auth';
import { resolveTenantId } from '../../../lib/public-commerce-context.js';
import { requireCustomerId } from '../../../lib/customer-session.js';
import { requirePortalWriter } from '../../../lib/portal-writer.js';
import { settleHeldOrderMoney } from '../../../lib/held-order-money.js';

/** Publish what a decision caused, once it has committed. Through api-core's
 *  publish, which also queues the business's own webhooks: a sign-off can
 *  announce `order.paid`, and a business can subscribe to that one (sparx
 *  persona issue 087). */
async function emit(
  log: FastifyBaseLogger,
  tenantId: string,
  events: PendingEvent[]
): Promise<void> {
  for (const e of events) {
    await publish(log, e.type, tenantId, null, e.payload);
  }
}

const PathAccountId = z.object({ accountId: z.string().uuid() });
const PathAccountOrder = z.object({ accountId: z.string().uuid(), orderId: z.string().uuid() });

/** The signed-in contact deciding for the account in the path. A write passes
 *  `write`, which refuses a connected app. A business without the wholesale
 *  module has no approvals to give, so it answers as a disabled module does. */
async function decider(
  request: FastifyRequest,
  access: 'read' | 'write'
): Promise<approvalService.AccountDecider> {
  const tenantId = await resolveTenantId(request);
  if (!(await isModuleEnabled(tenantId, 'b2b'))) throw moduleDisabled('b2b');
  const ctx: CustomerAuthContext = { tenantId };
  const customerId =
    access === 'write'
      ? await requirePortalWriter(request, ctx)
      : await requireCustomerId(request, ctx, 'b2b:read');
  const { accountId } = PathAccountId.parse(request.params);
  return { tenantId, customerId, accountId };
}

// eslint-disable-next-line @typescript-eslint/require-await -- FastifyPluginAsync signature
const b2bPortalApprovalRoutes: FastifyPluginAsync = async (app) => {
  app.get('/v1/public/b2b/portal/:accountId/approvals', async (request) => {
    return ok(await approvalService.listAccountApprovals(await decider(request, 'read')));
  });

  app.post('/v1/public/b2b/portal/:accountId/orders/:orderId/approve', async (request) => {
    const who = await decider(request, 'write');
    const { orderId } = PathAccountOrder.parse(request.params);
    const result = await approvalService.approveOrderForAccount(who, orderId, request.body);
    // Inventory threshold events fire after the approval transaction commits.
    if (result.committedSales.length > 0) {
      await inventoryService.emitSaleEvents({ tenantId: who.tenantId }, result.committedSales);
    }
    // The card held at checkout is charged now it is placed (sparx persona issue
    // 087). Nobody on the business's team decided, so a problem goes to the owner.
    await settleHeldOrderMoney(request.log, { tenantId: who.tenantId }, result.money);
    await emit(request.log, who.tenantId, result.events);
    return ok(result.order);
  });

  app.post('/v1/public/b2b/portal/:accountId/orders/:orderId/reject', async (request) => {
    const who = await decider(request, 'write');
    const { orderId } = PathAccountOrder.parse(request.params);
    const result = await approvalService.rejectOrderForAccount(who, orderId, request.body);
    // Their own company said no, so they get their money back: a held card let
    // go, a charged one refunded in full (sparx persona issue 087).
    await settleHeldOrderMoney(request.log, { tenantId: who.tenantId }, result.money);
    await emit(request.log, who.tenantId, result.events);
    return ok(result.order);
  });
};

export default b2bPortalApprovalRoutes;
