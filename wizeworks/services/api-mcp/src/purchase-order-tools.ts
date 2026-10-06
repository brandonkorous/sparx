// Emailing a placed purchase order to the supplier, for an AI client (sparx
// persona issue 071). The REST route `POST /v1/inventory/purchase-orders/:id/email`
// and this tool are the same three steps: the inventory package prepares the
// order (and refuses a draft, an order waiting for sign-off, a canceled one, or
// one with nowhere to go), email-platform says who it is from, and the send is
// written onto the order's trail.
//
// It lives here rather than in `@wizeworks/inventory/mcp` because sending needs
// the mail bus and the sender identity, and the inventory package carries no
// transport (same reasoning as `domain-tools.ts`).

import { z } from 'zod';
import { withTenant } from '@wizeworks/db';
import { settingsService } from '@wizeworks/email-platform';
import { inventoryService } from '@wizeworks/inventory';
import { createPublisher, publishEvent, type PublisherLogger } from '@wizeworks/events';

const pubLogger: PublisherLogger = {
  info: (obj, msg) => console.info(msg ?? '', obj),
  warn: (obj, msg) => console.warn(msg ?? '', obj),
  error: (obj, msg) => console.error(msg ?? '', obj),
};
const publisher = createPublisher({ logger: pubLogger });

interface Ctx {
  tenantId: string;
  userId: string;
}

/** The business's name as its printed order carries it: Business details
 *  first, then the account name (api-rest `resolveBusinessIdentity`). */
async function businessName(tenantId: string): Promise<string> {
  const [business, tenant] = await Promise.all([
    withTenant({ tenantId }, (tx) =>
      tx.tenantBusiness.findUnique({ where: { tenantId }, select: { businessName: true } })
    ),
    withTenant({ tenantId }, (tx) =>
      tx.tenant.findUnique({ where: { id: tenantId }, select: { name: true } })
    ),
  ]);
  const named = business?.businessName?.trim() ?? '';
  if (named !== '') return named;
  const account = tenant?.name.trim() ?? '';
  return account === '' ? 'us' : account;
}

const emailPurchaseOrderTool = {
  name: 'email_purchase_order',
  description:
    "Email a placed purchase order to the supplier, with every line, price, code, the delivery address and the wanted-by date in the email itself. It goes to the supplier's own address unless `to` names another for this one send. Replies go to the business. Refused for a draft (place it with submit_purchase_order first), an order waiting for sign-off, and a canceled one. THIS PUTS AN ORDER IN FRONT OF A REAL SUPPLIER UNDER THE BUSINESS'S NAME: confirm the order and the address with the person first.",
  scope: 'write:inventory' as const,
  confirmation: true,
  input: z.object({
    purchaseOrderId: z.string().uuid(),
    to: z.string().trim().email().max(255).optional(),
  }),
  async run(ctx: Ctx, input: { purchaseOrderId: string; to?: string }) {
    const serviceCtx = { tenantId: ctx.tenantId, userId: ctx.userId };
    const prepared = await inventoryService.preparePurchaseOrderEmail(
      serviceCtx,
      input.purchaseOrderId,
      input.to ?? null
    );
    const [fromName, sender] = await Promise.all([
      businessName(ctx.tenantId),
      settingsService.senderHeaders({ tenantId: ctx.tenantId }, null),
    ]);
    await publishEvent(
      publisher,
      'email.send',
      ctx.tenantId,
      ctx.userId,
      {
        to: prepared.to,
        template: 'purchase-order-sent',
        from: sender.from,
        ...(sender.replyTo ? { replyTo: sender.replyTo } : {}),
        props: inventoryService.purchaseOrderEmailProps(prepared.document, {
          fromName,
          canReply: sender.replyTo !== null,
        }),
      },
      pubLogger
    );
    const order = await inventoryService.recordPurchaseOrderEmailed(
      serviceCtx,
      input.purchaseOrderId,
      prepared.to
    );
    return { to: prepared.to, order };
  },
};

export const purchaseOrderMcpTools = [emailPurchaseOrderTool];
