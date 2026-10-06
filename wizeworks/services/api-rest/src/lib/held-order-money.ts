// Settling the card on a held wholesale order once it is decided (sparx persona
// issue 087), for the routes that decide one: the business's Approve and Reject
// in the console, and the account's own approver on the site.
//
// The decision commits first and hands back the card work it needs
// (`heldOrderMoney` in @wizeworks/crm); this does it, through commerce's
// `heldOrderPayments.settle`, the same way each route publishes its events after
// the transaction. A charge that went through is recorded straight away rather
// than waiting for the payment webhook, so the order reads paid the moment it is
// approved. Anything that did not go through has already been written on the
// order and handed to the business as a task; it is logged here too.

import type { FastifyBaseLogger } from 'fastify';
import { heldOrderPayments } from '@wizeworks/commerce';

import { reconcileCompletedCheckoutPayment } from './payment-webhook-reconcile.js';

export async function settleHeldOrderMoney(
  log: FastifyBaseLogger,
  ctx: { tenantId: string; userId?: string | null },
  money: readonly heldOrderPayments.HeldOrderMoney[]
): Promise<void> {
  if (money.length === 0) return;
  const settled = await heldOrderPayments.settle(ctx, money);
  for (const { move, ok, error } of settled) {
    if (!ok) {
      log.error(
        { orderId: move.orderId, action: move.action, paymentRef: move.paymentRef, error },
        'held order: the card could not be settled (recorded on the order, task given to the business)'
      );
      continue;
    }
    if (move.action !== 'capture') continue;
    try {
      await reconcileCompletedCheckoutPayment(log, ctx.tenantId, move.processor, move.paymentRef);
    } catch (err) {
      log.error(
        { err, orderId: move.orderId, paymentRef: move.paymentRef },
        'held order: charged, but recording it failed (the webhook or the payment sweep will)'
      );
    }
  }
}
