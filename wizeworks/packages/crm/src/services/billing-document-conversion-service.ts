// billingDocumentConversionService — convert an accepted BillingDocument (a
// quote) into a commerce Order (docs/87 §15 convergence; retires the old
// Quote.convertedToOrderId flow in quote-lifecycle-service.ts).
//
// A quote lives as a BillingDocument on a workflow with a `committed`-type
// stage ("Accepted" — customer-approved). Converting snapshots its current
// lines + header into a new Order so fulfillment/shipping/inventory ride the
// existing Order pipeline, which BillingDocument has no equivalent of. The
// pointer is a real FK — Order.convertedFromDocumentId — replacing the old
// Order.metadata.convertedFromQuoteId string/soft pointer; BillingDocument
// navigates the reverse direction via its non-FK `convertedOrder` relation.
//
// The BillingDocument itself is NOT re-staged by this conversion — it stays in
// its `committed` stage; the existence of an Order with this document as its
// `convertedFromDocumentId` is the signal that it has since become an order.
// (Net-terms AR for that order, if any, is a separate BillingDocument on the
// `net-terms-ar` workflow, created by the B2B checkout flow — see
// wizeworks/packages/crm/src/services/b2b-ar-service.ts.)

import crypto from 'node:crypto';

import { withTenant } from '@wizeworks/db';
import type { BillingDocument, Order, Prisma } from '@wizeworks/db';

import { writeAuditLog } from '../audit';
import { publishCrmEvent } from '../events';
import { publishPlatformEvent } from '../consumers/platform-bus';
import type { ServiceContext } from '../errors';
import { CrmNotFoundError, CrmValidationError } from '../errors';
import { nextOrderNumber } from './record-numbers';

export interface ConvertDocumentToOrderInput {
  /** Override the document's own customerId — required when the document is
   *  billed only to a Company with no linked customer. */
  customerId?: string;
  channel?: string;
  orderNumber?: string;
}

export async function convertToOrder(
  ctx: ServiceContext,
  documentId: string,
  rawInput: unknown = {}
): Promise<{ document: BillingDocument; order: Order }> {
  const input = (rawInput ?? {}) as ConvertDocumentToOrderInput;

  const result = await withTenant(ctx, async (tx) => {
    const doc = await tx.billingDocument.findUnique({
      where: { id: documentId },
      include: { lines: { include: { variant: { select: { sku: true } } } }, stage: true },
    });
    if (doc?.deletedAt !== null) throw new CrmNotFoundError('BillingDocument', documentId);
    if (doc.stage.stageType !== 'committed') {
      throw new CrmValidationError(
        `Document must be in a customer-approved ("committed") stage before conversion; current stage is "${doc.stage.name}"`
      );
    }
    const alreadyConverted = await tx.order.findFirst({
      where: { convertedFromDocumentId: doc.id },
      select: { id: true },
    });
    if (alreadyConverted) {
      throw new CrmValidationError('Document has already been converted to an order');
    }

    const customerId = input.customerId ?? doc.customerId;
    if (!customerId) {
      throw new CrmValidationError(
        'Document has no customer; pass customerId to specify which customer to bill'
      );
    }

    const orderNumber = input.orderNumber ?? (await nextOrderNumber(tx, ctx.tenantId));
    const placedAt = new Date();
    const order = await tx.order.create({
      data: {
        tenantId: ctx.tenantId,
        customerId,
        orderNumber,
        status: 'placed',
        paymentStatus: 'unpaid',
        channel: input.channel ?? 'admin',
        source: `document:${doc.number ?? doc.id}`,
        currency: doc.currency,
        subtotal: doc.subtotal,
        taxTotal: doc.taxTotal,
        shippingTotal: doc.shippingTotal,
        discountTotal: doc.discountTotal,
        total: doc.total,
        placedAt,
        convertedFromDocumentId: doc.id,
        items: {
          create: doc.lines.map((line) => ({
            tenantId: ctx.tenantId,
            productId: line.productId,
            variantId: line.variantId,
            sku: line.variant?.sku ?? '',
            name: line.description,
            description: null,
            quantity: Math.round(line.quantity.toNumber()),
            unitPrice: line.unitPrice,
            lineSubtotal: line.lineSubtotal,
            taxAmount: line.taxAmount,
            discountAmount: line.discountAmount,
            lineTotal: line.lineTotal,
            metadata: line.metadata as Prisma.InputJsonValue,
          })),
        },
      },
    });

    const updatedDoc = await tx.billingDocument.update({
      where: { id: doc.id },
      data: { convertedAt: new Date() },
    });

    await writeAuditLog({
      tx,
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      actorType: ctx.userId ? 'user' : 'system',
      action: 'invoicing.document.converted',
      entityType: 'BillingDocument',
      entityId: doc.id,
      diff: { after: { orderId: order.id, orderNumber: order.orderNumber } },
    });

    return { document: updatedDoc, order };
  });

  await publishCrmEvent({
    tenantId: ctx.tenantId,
    topic: 'crm.billing_document.converted',
    payload: {
      documentId: result.document.id,
      orderId: result.order.id,
      customerId: result.order.customerId,
    },
    dedupeKey: `crm.billing_document.converted:${result.document.id}`,
  });
  await publishPlatformEvent({
    id: crypto.randomUUID(),
    topic: 'order.created',
    tenantId: ctx.tenantId,
    occurredAt: result.order.placedAt,
    payload: {
      orderId: result.order.id,
      orderNumber: result.order.orderNumber,
      customerId: result.order.customerId,
      total: Number(result.order.total),
      currency: result.order.currency,
      placedAt: result.order.placedAt.toISOString(),
    },
  });

  return result;
}
