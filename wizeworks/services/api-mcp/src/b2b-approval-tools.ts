// Approving or rejecting a held wholesale order, for an AI client.
//
// The REST routes `POST /v1/b2b/approval-queue/:orderId/approve|reject` and these
// tools are the same steps: @wizeworks/b2b's approval service decides the order
// and hands back what the card on it needs, then, once that has committed, the
// card is charged (approved), let go or refunded in full (rejected), and the
// order's events are published.
//
// They live here rather than in `@wizeworks/b2b/mcp` because settling the card
// needs the payment gateways, and the b2b package does not carry them (same
// reasoning as `b2b-price-tools.ts`). The versions that lived there approved and
// rejected without touching the card, so a rejected order kept the buyer's money
// (sparx persona issue 087). Their scope is still `write:b2b`, so they are still
// gated on the b2b module in server.ts.

import { z } from 'zod';
import { approvalService, type PendingEvent } from '@wizeworks/b2b';
import { heldOrderPayments } from '@wizeworks/commerce';
import { publish } from '@wizeworks/api-core/pubsub';
import { inventoryService } from '@wizeworks/inventory';

// Through api-core's publish, which also queues the business's own webhooks,
// the same as the REST routes: approving can announce `order.paid`, and a
// business can subscribe to that one (sparx persona issue 087). It wants a
// Fastify logger and this service has no request, so the console stands in
// (as in @wizeworks/cms's MCP tools).
const mcpLogger = console as unknown as Parameters<typeof publish>[0];

interface Ctx {
  tenantId: string;
  userId: string;
}

async function emit(ctx: Ctx, events: PendingEvent[]): Promise<void> {
  for (const e of events) {
    await publish(mcpLogger, e.type, ctx.tenantId, ctx.userId, e.payload);
  }
}

/** What happened to the card, for the agent to tell the person. Absent when
 *  the order had no card to settle. A failure is already on the order and in
 *  the business's tasks; the agent should say so rather than retry. */
async function settleCard(
  ctx: Ctx,
  money: readonly heldOrderPayments.HeldOrderMoney[]
): Promise<{ card: { action: string; done: boolean; problem?: string }[] } | Record<never, never>> {
  if (money.length === 0) return {};
  const settled = await heldOrderPayments.settle(ctx, money);
  for (const { move, ok, error } of settled) {
    if (!ok) {
      console.error('held order: the card could not be settled', {
        orderId: move.orderId,
        action: move.action,
        error,
      });
    }
  }
  return {
    card: settled.map(({ move, ok, error }) => ({
      action: move.action,
      done: ok,
      ...(error ? { problem: error } : {}),
    })),
  };
}

const uuid = () => z.string().uuid();

const approveOrderTool = {
  name: 'approve_b2b_order',
  description:
    'Sign off a pending B2B order for the business. When nothing else is waiting this PLACES a real order: it commits stock, issues the net-terms AR invoice (if the order requested terms), charges the card that was held at checkout, and announces order.placed to fulfillment. When the account’s own approver has yet to approve it, the result has status pending_approval and waitingOn ["account"], and nothing is charged yet. An order only the account signs is refused. `card` says whether a held card was charged; if it was not (a hold lasts about seven days), the order is placed unpaid and the business has a task to ask for the money. Confirm before running.',
  scope: 'write:b2b' as const,
  confirmation: true,
  input: z.object({ orderId: uuid(), reason: z.string().max(1000).optional() }),
  async run(ctx: Ctx, input: { orderId: string; reason?: string }) {
    const result = await approvalService.approveOrder(ctx, input.orderId, {
      reason: input.reason,
    });
    // Inventory threshold events for the sales just committed, then the card,
    // then the domain events (b2b.order.approved, b2b.invoice.created?, order.placed).
    if (result.committedSales.length > 0) {
      await inventoryService.emitSaleEvents(ctx, result.committedSales);
    }
    const card = await settleCard(ctx, result.money);
    await emit(ctx, result.events);
    return { ...result.order, ...card };
  },
};

const rejectOrderTool = {
  name: 'reject_b2b_order',
  description:
    'Reject a pending B2B order: cancels it, records the reason on the customer, and gives the buyer their money back: a card held at checkout is let go, and a card that was already charged is refunded in full. `card` says what happened to it; if a refund did not go through, the business has a task to refund it by hand. Confirm before running.',
  scope: 'write:b2b' as const,
  confirmation: true,
  input: z.object({ orderId: uuid(), reason: z.string().max(1000).optional() }),
  async run(ctx: Ctx, input: { orderId: string; reason?: string }) {
    const result = await approvalService.rejectOrder(ctx, input.orderId, {
      reason: input.reason,
    });
    const card = await settleCard(ctx, result.money);
    await emit(ctx, result.events);
    return { ...result.order, ...card };
  },
};

export const b2bApprovalMcpTools = [approveOrderTool, rejectOrderTool];
