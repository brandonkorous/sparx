// Deal ↔ order / billing-document (quote) attachment service.
//
// Locked decision #5: deals are independent of orders, linked via join
// tables. `deal_orders(deal_id, order_id, tenant_id)` and the same shape
// for billing documents (`deal_billing_documents`). Orders/documents never
// get a deal_id column — one deal can yield multiple orders, and most
// orders have no deal.
//
// Both the deal and the linked entity must belong to the same tenant; RLS
// is the backstop and the service-layer fetch confirms both rows exist
// before writing the join row.

import { withTenant } from '@sparx/db';
import type { BillingDocument, DealBillingDocument, DealOrder, Order } from '@sparx/db';

import { writeAuditLog } from '../audit';
import { publishCrmEvent } from '../events';
import type { ServiceContext } from '../errors';
import { CrmConflictError, CrmNotFoundError } from '../errors';

/** List orders attached to a deal via the deal_orders join table. */
export async function listAttachedOrders(ctx: ServiceContext, dealId: string): Promise<Order[]> {
  return withTenant(ctx, async (tx) => {
    const links = await tx.dealOrder.findMany({
      where: { dealId },
      include: { order: true },
      orderBy: { createdAt: 'desc' },
    });
    return links.map((link) => link.order);
  });
}

/** List billing documents (quotes) attached to a deal via the
 *  deal_billing_documents join table. */
export async function listAttachedDocuments(
  ctx: ServiceContext,
  dealId: string
): Promise<BillingDocument[]> {
  return withTenant(ctx, async (tx) => {
    const links = await tx.dealBillingDocument.findMany({
      where: { dealId },
      include: { document: true },
      orderBy: { createdAt: 'desc' },
    });
    return links.map((link) => link.document);
  });
}

export async function attachOrder(
  ctx: ServiceContext,
  args: { dealId: string; orderId: string }
): Promise<DealOrder> {
  const link = await withTenant(ctx, async (tx) => {
    const [deal, order] = await Promise.all([
      tx.deal.findUnique({ where: { id: args.dealId } }),
      tx.order.findUnique({ where: { id: args.orderId } }),
    ]);
    if (!deal) throw new CrmNotFoundError('Deal', args.dealId);
    if (!order) throw new CrmNotFoundError('Order', args.orderId);

    const existing = await tx.dealOrder.findUnique({
      where: { dealId_orderId: { dealId: args.dealId, orderId: args.orderId } },
    });
    if (existing) {
      throw new CrmConflictError('Order is already attached to this deal');
    }

    const created = await tx.dealOrder.create({
      data: {
        tenantId: ctx.tenantId,
        dealId: args.dealId,
        orderId: args.orderId,
      },
    });
    await writeAuditLog({
      tx,
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      actorType: ctx.userId ? 'user' : 'system',
      action: 'crm.deal.order_attached',
      entityType: 'DealOrder',
      entityId: args.dealId,
      diff: { after: { orderId: args.orderId } },
    });
    return created;
  });

  await publishCrmEvent({
    tenantId: ctx.tenantId,
    topic: 'crm.deal.order_attached',
    payload: { dealId: args.dealId, orderId: args.orderId },
    dedupeKey: `crm.deal.order_attached:${args.dealId}:${args.orderId}`,
  });

  return link;
}

export async function detachOrder(
  ctx: ServiceContext,
  args: { dealId: string; orderId: string }
): Promise<void> {
  await withTenant(ctx, async (tx) => {
    const existing = await tx.dealOrder.findUnique({
      where: { dealId_orderId: { dealId: args.dealId, orderId: args.orderId } },
    });
    if (!existing) return;
    await tx.dealOrder.delete({
      where: { dealId_orderId: { dealId: args.dealId, orderId: args.orderId } },
    });
    await writeAuditLog({
      tx,
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      actorType: ctx.userId ? 'user' : 'system',
      action: 'crm.deal.order_detached',
      entityType: 'DealOrder',
      entityId: args.dealId,
      diff: { before: { orderId: args.orderId } },
    });
  });

  await publishCrmEvent({
    tenantId: ctx.tenantId,
    topic: 'crm.deal.order_detached',
    payload: { dealId: args.dealId, orderId: args.orderId },
    dedupeKey: `crm.deal.order_detached:${args.dealId}:${args.orderId}:${Date.now()}`,
  });
}

export async function attachDocument(
  ctx: ServiceContext,
  args: { dealId: string; documentId: string }
): Promise<DealBillingDocument> {
  const link = await withTenant(ctx, async (tx) => {
    const [deal, document] = await Promise.all([
      tx.deal.findUnique({ where: { id: args.dealId } }),
      tx.billingDocument.findUnique({ where: { id: args.documentId } }),
    ]);
    if (!deal) throw new CrmNotFoundError('Deal', args.dealId);
    if (!document) throw new CrmNotFoundError('BillingDocument', args.documentId);

    const existing = await tx.dealBillingDocument.findUnique({
      where: { dealId_documentId: { dealId: args.dealId, documentId: args.documentId } },
    });
    if (existing) {
      throw new CrmConflictError('Document is already attached to this deal');
    }

    const created = await tx.dealBillingDocument.create({
      data: {
        tenantId: ctx.tenantId,
        dealId: args.dealId,
        documentId: args.documentId,
      },
    });
    await writeAuditLog({
      tx,
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      actorType: ctx.userId ? 'user' : 'system',
      action: 'crm.deal.document_attached',
      entityType: 'DealBillingDocument',
      entityId: args.dealId,
      diff: { after: { documentId: args.documentId } },
    });
    return created;
  });

  await publishCrmEvent({
    tenantId: ctx.tenantId,
    topic: 'crm.deal.document_attached',
    payload: { dealId: args.dealId, documentId: args.documentId },
    dedupeKey: `crm.deal.document_attached:${args.dealId}:${args.documentId}`,
  });

  return link;
}

export async function detachDocument(
  ctx: ServiceContext,
  args: { dealId: string; documentId: string }
): Promise<void> {
  await withTenant(ctx, async (tx) => {
    const existing = await tx.dealBillingDocument.findUnique({
      where: { dealId_documentId: { dealId: args.dealId, documentId: args.documentId } },
    });
    if (!existing) return;
    await tx.dealBillingDocument.delete({
      where: { dealId_documentId: { dealId: args.dealId, documentId: args.documentId } },
    });
    await writeAuditLog({
      tx,
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      actorType: ctx.userId ? 'user' : 'system',
      action: 'crm.deal.document_detached',
      entityType: 'DealBillingDocument',
      entityId: args.dealId,
      diff: { before: { documentId: args.documentId } },
    });
  });

  await publishCrmEvent({
    tenantId: ctx.tenantId,
    topic: 'crm.deal.document_detached',
    payload: { dealId: args.dealId, documentId: args.documentId },
    dedupeKey: `crm.deal.document_detached:${args.dealId}:${args.documentId}:${Date.now()}`,
  });
}
