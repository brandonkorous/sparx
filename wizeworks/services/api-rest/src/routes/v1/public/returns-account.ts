// Self-service returns for a signed-in shopper.
//
//   GET  /v1/public/commerce/account/returns              ?tenant=
//   GET  /v1/public/commerce/account/returns/:returnId    ?tenant=
//   GET  /v1/public/commerce/account/orders/:orderId/returnable
//   POST /v1/public/commerce/account/returns              ?tenant=
//
// The returns MODEL was always two-sided — `commerce-schemas/returns.ts` opens
// with "customer-initiated or staff-initiated", `requestedBy` takes `'customer'`,
// and `create` already writes `actorType: 'customer'` to the audit log. Only the
// shopper's door was missing, so the whole of it ran through the shop's inbox:
// the customer emails, somebody reads it, somebody types it in. On a business
// where returns are a fifth of orders that is the job, not an edge case.
//
// Every route here is OWNERSHIP-CHECKED against the session's customer, and a
// record belonging to someone else answers 404 rather than 403 — the same rule
// the order routes follow, so no endpoint can be used to discover that another
// customer's return exists.

import type { FastifyPluginAsync, FastifyRequest } from 'fastify';
import { z } from 'zod';

import { returnService } from '@wizeworks/commerce';
import { ReturnLineItemInput, ReturnOutcome } from '@wizeworks/commerce-schemas';
import { orderService } from '@wizeworks/crm';
import { ok } from '@wizeworks/api-core/envelope';
import { notFound, validationError } from '@wizeworks/api-core/errors';

import { resolveTenantId } from '../../../lib/public-commerce-context.js';
import { requireCustomerId } from '../../../lib/customer-session.js';

const ReturnParam = z.object({ returnId: z.string().uuid() });
const OrderParam = z.object({ orderId: z.string().uuid() });

/** The shopper may ask for a refund or a swap. `repair`, `account_credit` and the
 *  legacy `store_credit` are settlements the SHOP chooses at approval time, and
 *  offering them here would promise an outcome no tenant has agreed to. */
const CustomerOutcome = ReturnOutcome.extract(['refund', 'exchange']);

const CreateBody = z.object({
  orderId: z.string().uuid(),
  preferredOutcome: CustomerOutcome.default('refund'),
  // The customer cannot set `mediaAssetIds` yet (no shopper upload path), so the
  // line shape is the service's own minus that field rather than a second schema
  // that could drift from it.
  items: z
    .array(ReturnLineItemInput.omit({ mediaAssetIds: true }))
    .min(1)
    .max(100),
});

/** What a SHOPPER may see of her own return.
 *
 *  An explicit projection, not the console's record. `returnService.get` answers
 *  with the shop's working notes on the goods — inspection conditions, whether a
 *  line was judged restockable, which warehouse it went to, what the return label
 *  cost them. None of that is hers, and shipping the whole object because it was
 *  convenient is how internal data ends up on a customer's screen.
 *
 *  Two deliberate inclusions. `restockingFeeCents` is money taken out of her
 *  refund, so she is told. And the staff note is surfaced ONLY on a DENIED
 *  return, where `deny` writes the reason into it — a request refused with no
 *  reason leaves her with nothing to do next. On every other status that field
 *  holds internal working notes and stays out. */
function shopperView(detail: Awaited<ReturnType<typeof returnService.get>>) {
  return {
    id: detail.id,
    orderId: detail.orderId,
    orderNumber: detail.orderNumber,
    status: detail.status,
    preferredOutcome: detail.preferredOutcome,
    requestedAt: detail.requestedAt,
    itemCount: detail.itemCount,
    approvedAt: detail.approvedAt,
    receivedAt: detail.receivedAt,
    refundedAt: detail.refundedAt,
    cancelledAt: detail.cancelledAt,
    refundedAmountCents: detail.refundedAmountCents,
    restockingFeeCents: detail.restockingFeeCents,
    declinedReason: detail.status === 'denied' ? detail.staffNote : null,
    items: detail.items.map((it) => ({
      id: it.id,
      orderItemId: it.orderItemId,
      orderItemName: it.orderItemName,
      quantity: it.quantity,
      approvedQuantity: it.approvedQuantity,
      reasonCode: it.reasonCode,
      customerNote: it.customerNote,
    })),
    // Only what she needs to post it back — never the label's cost or provider ref.
    labels: detail.labels
      .filter((l) => l.trackingNumber !== null || l.trackingUrl !== null)
      .map((l) => ({ trackingNumber: l.trackingNumber, trackingUrl: l.trackingUrl })),
  };
}

/** The list view — the summary minus the shop's own view of who she is. */
function shopperSummary(row: {
  id: string;
  orderId: string;
  orderNumber: string | null;
  status: string;
  preferredOutcome: string;
  itemCount: number;
  requestedAt: string;
}) {
  return {
    id: row.id,
    orderId: row.orderId,
    orderNumber: row.orderNumber,
    status: row.status,
    preferredOutcome: row.preferredOutcome,
    itemCount: row.itemCount,
    requestedAt: row.requestedAt,
  };
}

const returnsAccountRoutes: FastifyPluginAsync = (app) => {
  const context = async (request: FastifyRequest) => ({
    tenantId: await resolveTenantId(request),
  });

  /** Resolve an order the session's customer actually owns, or 404. */
  async function ownedOrder(
    request: FastifyRequest,
    ctx: { tenantId: string },
    orderId: string,
    scope: 'orders:read' | 'account:write'
  ): Promise<void> {
    const customerId = await requireCustomerId(request, ctx, scope);
    const order = await orderService.get(ctx, orderId);
    if (order.customerId !== customerId) throw notFound('Order', orderId);
  }

  // ── Her returns ───────────────────────────────────────────────────────
  app.get('/v1/public/commerce/account/returns', async (request) => {
    const ctx = await context(request);
    const customerId = await requireCustomerId(request, ctx, 'orders:read');
    // `returnService.list` is tenant-scoped, not customer-scoped — it is the
    // console's read. Narrowing to her own orders is this route's job.
    const mine = await orderService.list(ctx, { customerId, take: 200 });
    const orderIds = new Set(mine.items.map((o) => o.id));
    if (orderIds.size === 0) return ok({ returns: [] });

    const all = await returnService.list(ctx, { take: 200 });
    return ok({
      returns: all.items.filter((r) => orderIds.has(r.orderId)).map(shopperSummary),
    });
  });

  app.get('/v1/public/commerce/account/returns/:returnId', async (request) => {
    const { returnId } = ReturnParam.parse(request.params);
    const ctx = await context(request);
    const detail = await returnService.get(ctx, returnId);
    await ownedOrder(request, ctx, detail.orderId, 'orders:read');
    return ok(shopperView(detail));
  });

  // ── What can still be sent back ───────────────────────────────────────
  app.get('/v1/public/commerce/account/orders/:orderId/returnable', async (request) => {
    const { orderId } = OrderParam.parse(request.params);
    const ctx = await context(request);
    await ownedOrder(request, ctx, orderId, 'orders:read');
    return ok(await returnService.returnability(ctx, orderId));
  });

  // ── Ask to send something back ────────────────────────────────────────
  app.post('/v1/public/commerce/account/returns', async (request) => {
    const body = CreateBody.parse(request.body);
    const ctx = await context(request);
    await ownedOrder(request, ctx, body.orderId, 'account:write');

    // Re-checked here rather than trusted from the form: the page that built it
    // may be minutes old, and in between the shop may have taken the same line
    // back on a return of its own.
    const state = await returnService.returnability(ctx, body.orderId);
    if (!state.eligible) {
      throw validationError(
        state.reason === 'not_sent_yet'
          ? 'This order has not been sent yet, so there is nothing to send back.'
          : 'Everything on this order has already been sent back.',
        [{ field: 'orderId', message: 'Nothing on this order can be returned.' }]
      );
    }

    const allowed = new Map(state.lines.map((l) => [l.orderItemId, l]));
    for (const line of body.items) {
      const eligible = allowed.get(line.orderItemId);
      if (!eligible) {
        throw notFound('Order item', line.orderItemId);
      }
      if (line.quantity > eligible.returnableQuantity) {
        throw validationError(
          eligible.returnableQuantity === 0
            ? `You have already asked to send back every ${eligible.name}.`
            : `You can send back ${eligible.returnableQuantity} of ${eligible.name}, not ${line.quantity}.`,
          [{ field: 'items', message: 'More than is left to send back.' }]
        );
      }
    }

    const created = await returnService.create(ctx, {
      orderId: body.orderId,
      requestedBy: 'customer',
      preferredOutcome: body.preferredOutcome,
      items: body.items.map((line) => ({ ...line, mediaAssetIds: [] })),
    });
    return ok(created);
  });

  return Promise.resolve();
};

export default returnsAccountRoutes;
