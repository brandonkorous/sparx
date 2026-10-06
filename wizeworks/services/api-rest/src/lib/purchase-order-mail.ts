// Emailing a placed purchase order to the supplier (sparx persona issue 071).
//
// Placing an order sent nothing. The dialog said so ("print the order or pass
// it on yourself"), and an owner with a supplier's address already on file
// printed to PDF and attached it from his own mailbox. This sends it from here.
//
// Same shape and placement as `invoice-mail.ts`: the inventory package loads
// the order, refuses what should not go and builds the email's content; this
// composition root owns who it is from and the mail bus. The order travels IN
// the body, because there is no public page for it and the event path carries
// no attachment. The MCP tool `email_purchase_order` is the same three steps.

import type { FastifyRequest } from 'fastify';
import { requireAuth } from '@wizeworks/api-core/auth';
import { publish } from '@wizeworks/api-core/pubsub';
import { inventoryService, type PurchaseOrderDetail } from '@wizeworks/inventory';

import { resolveBusinessIdentity } from './business-identity.js';
import { toInventoryContext } from './inventory-context.js';
import { tenantSenderHeaders } from './tenant-email.js';

export interface SendPurchaseOrderResult {
  to: string;
  order: PurchaseOrderDetail;
}

/**
 * Email the order to its supplier, or to `to` for this one send.
 *
 * Refuses (via the inventory package) a draft, an order waiting for sign-off, a
 * canceled one, and an order with nowhere to go. Records the send on the order
 * only after it is handed to the mail bus, so a refusal leaves no trace.
 */
export async function sendPurchaseOrder(
  request: FastifyRequest,
  id: string,
  to?: string | null
): Promise<SendPurchaseOrderResult> {
  const auth = requireAuth(request);
  const ctx = toInventoryContext(request);
  const prepared = await inventoryService.preparePurchaseOrderEmail(ctx, id, to);

  // The business places the order, so the business's name is on it: the same
  // name the printed order carries in its masthead.
  const [identity, sender] = await Promise.all([
    resolveBusinessIdentity({ tenantId: auth.tenantId }),
    tenantSenderHeaders(auth.tenantId, null),
  ]);

  await publish(request.log, 'email.send', auth.tenantId, auth.actorId, {
    to: prepared.to,
    template: 'purchase-order-sent',
    from: sender.from,
    ...(sender.replyTo ? { replyTo: sender.replyTo } : {}),
    props: inventoryService.purchaseOrderEmailProps(prepared.document, {
      fromName: identity.businessName ?? 'us',
      canReply: sender.replyTo !== null,
    }),
  });

  const order = await inventoryService.recordPurchaseOrderEmailed(ctx, id, prepared.to);
  return { to: prepared.to, order };
}
