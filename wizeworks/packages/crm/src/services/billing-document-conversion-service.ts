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
//
// A quote billed to a trade account on payment terms also gets its invoice
// here, exactly as an order placed on terms at checkout does: a separate
// BillingDocument on the `net-terms-ar` workflow (b2b-ar-service.ts). Before,
// only checkout issued one, so Wasatch Front's accepted quote became order
// O-000008 with no invoice at all, against a promise that "orders on terms
// invoice automatically with the buyer's PO number" (sparx persona issue 084).
//
// And it answers the same question checkout does before it places anything:
// may this account order on terms now, must the order wait for somebody to
// sign it off, or is it refused (`account-order-gate.ts`). The quote is
// converted the moment the buyer accepts it, so the business's spending limits
// and the account's credit limit have to stand between that click and an
// order, or a quote would be the way round both (sparx persona issue 085). A
// held order is written as `pending_approval` with no invoice, and announced as
// `b2b.order.pending_approval` rather than placed; signing it off
// (b2b approval.ts) places it, takes the stock and issues the invoice, reading
// the terms this conversion writes onto the order.

import crypto from 'node:crypto';

import {
  deliveryNeedsOf,
  poNumberOf,
  withDeliveryNeeds,
  withPoNumber,
} from '@wizeworks/crm-schemas';
import { withTenant } from '@wizeworks/db';
import type { BillingDocument, Order, Prisma } from '@wizeworks/db';

import { writeAuditLog } from '../audit';
import { publishCrmEvent } from '../events';
import { publishPlatformEvent } from '../consumers/platform-bus';
import type { ServiceContext } from '../errors';
import { CrmNotFoundError, CrmValidationError } from '../errors';
import { createOrderArDocument } from './b2b-ar-service';
import { dueDayAfter } from './billing-ar';
import { businessTimeZone } from './business-clock';
import {
  findHoldingRule,
  loadOrderSignOff,
  termsDecision,
  withApprovalHold,
  type HoldReason,
  type SignOffSide,
} from './account-order-gate';
import { nextOrderNumber } from './record-numbers';
import { recomputeCustomerCommerce } from './customer-rollup';
import { closeWhenDocumentMovesOn } from './task-service';

export interface ConvertDocumentToOrderInput {
  /** Override the document's own customerId — required when the document is
   *  billed only to a Company with no linked customer. */
  customerId?: string;
  channel?: string;
  orderNumber?: string;
}

/**
 * Days a trade account has to pay an order made from its quote, or null when
 * the order is not one to invoice on terms: no account, an account that pays
 * before it ships, or one the business has not given terms to yet.
 */
export function invoiceTermsDays(paymentTerms: string | null | undefined): number | null {
  const match = /^net(\d+)$/i.exec(paymentTerms ?? '');
  return match?.[1] ? Number(match[1]) : null;
}

/** The fields of a saved customer address a billing snapshot needs. */
interface SavedAddress {
  type: string;
  isDefault: boolean;
  recipientName: string | null;
  company: string | null;
  line1: string;
  line2: string | null;
  city: string;
  region: string | null;
  postalCode: string | null;
  country: string;
  phone: string | null;
}

/**
 * The order's billing address, from the customer's default billing address
 * (a "delivery and billing" one counts), or null when they have none.
 *
 * The quote was filled from the same address, but holds it only as printed
 * text, so the order made from it read "Billing address: Not given" with the
 * address one click away (sparx persona issue 084).
 */
export function billingSnapshotFrom(
  addresses: readonly SavedAddress[]
): Prisma.InputJsonValue | null {
  const bills = addresses.filter((a) => a.type === 'billing' || a.type === 'both');
  const chosen = bills.find((a) => a.isDefault) ?? bills[0];
  if (!chosen) return null;
  const optional = (value: string | null) => (value?.trim() ? value.trim() : undefined);
  const snapshot = {
    recipientName: optional(chosen.recipientName),
    company: optional(chosen.company),
    line1: chosen.line1,
    line2: optional(chosen.line2),
    city: chosen.city,
    region: optional(chosen.region),
    postalCode: optional(chosen.postalCode),
    country: chosen.country,
    phone: optional(chosen.phone),
  };
  return JSON.parse(JSON.stringify(snapshot)) as Prisma.InputJsonValue;
}

export interface ConvertedDocument {
  document: BillingDocument;
  order: Order;
  /** The invoice issued on the account's terms, when there is one. */
  invoiceId: string | null;
  /** Why the order is waiting for sign-off. Empty when it was placed. */
  held: HoldReason[];
  /** Who a held order is waiting on (sparx persona issue 087). Empty when it
   *  was placed. */
  asks: SignOffSide[];
}

export async function convertToOrder(
  ctx: ServiceContext,
  documentId: string,
  rawInput: unknown = {}
): Promise<ConvertedDocument> {
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

    // The trade account this quote was made out to, and whether its order may go
    // ahead on terms. Read BEFORE the order is written, so a refusal leaves
    // nothing behind.
    const account = doc.companyId
      ? await tx.company.findUnique({
          where: { id: doc.companyId },
          select: { status: true, creditLimit: true, creditUsed: true, paymentTerms: true },
        })
      : null;
    const termsDays = invoiceTermsDays(account?.paymentTerms);
    const totalCents = Math.round(Number(doc.total) * 100);
    const held: HoldReason[] = [];
    if (account && termsDays !== null) {
      const decision = termsDecision(account, totalCents, doc.currency);
      if (decision.kind === 'refuse') throw new CrmValidationError(decision.message);
      if (decision.kind === 'hold') held.push(decision.reason);
    }
    if (doc.companyId) {
      const rule = await findHoldingRule(tx, ctx.tenantId, {
        accountId: doc.companyId,
        propertyId: doc.propertyId,
        totalCents,
      });
      if (rule) held.push({ kind: 'approval_rule', ruleId: rule.id });
    }

    const orderNumber = input.orderNumber ?? (await nextOrderNumber(tx, ctx.tenantId));
    const billingAddress = billingSnapshotFrom(
      await tx.customerAddress.findMany({
        where: { customerId },
        orderBy: { createdAt: 'asc' },
      })
    );
    const placedAt = new Date();
    const order = await tx.order.create({
      data: {
        tenantId: ctx.tenantId,
        customerId,
        orderNumber,
        // The site this sale belongs to, carried across from the quote.
        //
        // `BillingDocument.propertyId` is NOT NULL, so there is always one to
        // carry and never a case to admit. `Order.propertyId` is nullable, and
        // a null there means something quite specific elsewhere in this file's
        // neighbourhood: `order-service.ts` reads it as an order belonging to a
        // business that no longer exists, and hides it from every member whose
        // access is limited to named sites. Leaving the field off did not
        // merely lose a label — it took the sale out of that site's takings and
        // out of the order list of the person who made it (issue 878).
        propertyId: doc.propertyId,
        status: held.length > 0 ? 'pending_approval' : 'placed',
        paymentStatus: 'unpaid',
        channel: input.channel ?? 'admin',
        source: `document:${doc.number ?? doc.id}`,
        currency: doc.currency,
        subtotal: doc.subtotal,
        taxTotal: doc.taxTotal,
        shippingTotal: doc.shippingTotal,
        discountTotal: doc.discountTotal,
        // Both are inside `doc.total`, so both have to come across or the order's
        // own rows do not add up to its total: the card fee was left behind, and a
        // rebuilt part's core deposit would have been too (sparx issue 051).
        surchargeTotal: doc.surchargeTotal,
        coreChargeTotal: doc.coreChargeTotal,
        total: doc.total,
        placedAt,
        convertedFromDocumentId: doc.id,
        ...(billingAddress ? { billingAddress } : {}),
        // The buyer's PO number, where checkout puts an order's, so the invoice
        // raised from this order prints the number their accounts department
        // will match it against (issue 077). Absent when the quote had none.
        //
        // The account's terms, where checkout keeps the ones an order was placed
        // on: signing off a held order reads them to issue its invoice, and
        // without them a held quote order would be placed with no bill at all.
        // And why it is held, so the person signing can see.
        //
        // And when and where the buyer needs it (sparx persona issue 086): the
        // person packing and shipping the order reads it there, not on the quote.
        metadata: withDeliveryNeeds(
          withPoNumber(
            withApprovalHold(
              account && termsDays !== null ? { paymentTermsRequested: account.paymentTerms } : {},
              held
            ),
            poNumberOf(doc.metadata)
          ),
          deliveryNeedsOf(doc.metadata) ?? { neededBy: null, deliverTo: null, notes: null }
        ) as Prisma.InputJsonValue,
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
            coreCharge: line.coreCharge,
            metadata: line.metadata as Prisma.InputJsonValue,
          })),
        },
      },
    });

    // The buyer's own figures, worked out from their orders, in the same
    // transaction that wrote this one.
    //
    // This is the house rule for every path that writes an Order, and it is the
    // rule BECAUSE the alternative was tried: the customer's totals used to be
    // nudged by the `order.created` consumer, an increment that the bus could
    // swallow. `order-events.ts` says so where it used to do it. Four writers
    // learned the new rule — orderService create and update, the payment path,
    // and channel ingest — and this one, which is how a QUOTE becomes an order,
    // did not. So a wholesale buyer who accepted a quote today had a record
    // reading "Orders 3" and "Last order a week ago" directly above the order
    // itself, dated today (issue 894).
    await recomputeCustomerCommerce(tx, ctx.tenantId, customerId);

    // On terms: issue the invoice now, in this transaction, on the account's
    // own terms, made out to whoever the quote was made out to. Not while the
    // order is held: signing it off issues it.
    let invoiceId: string | null = null;
    if (doc.companyId && termsDays !== null && held.length === 0) {
      // A due DAY on the business's calendar (issue 099), not the moment plus days.
      const dueAt = dueDayAfter(placedAt, termsDays, await businessTimeZone(tx, ctx.tenantId));
      const invoice = await createOrderArDocument(
        { tenantId: ctx.tenantId, userId: ctx.userId, tx },
        {
          companyId: doc.companyId,
          propertyId: doc.propertyId,
          orderId: order.id,
          amount: Number(doc.total),
          currency: doc.currency,
          dueAt,
          description: `Order ${orderNumber}`,
          ...(doc.billTo ? { billTo: doc.billTo } : {}),
        }
      );
      invoiceId = invoice.id;
    }

    const updatedDoc = await tx.billingDocument.update({
      where: { id: doc.id },
      data: { convertedAt: new Date() },
    });
    // Turning it into an order IS the next step an approved document's task
    // asks for.
    await closeWhenDocumentMovesOn(tx, ctx, { documentId: doc.id, byUserId: ctx.userId ?? null });

    await writeAuditLog({
      tx,
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      actorType: ctx.userId ? 'user' : 'system',
      action: 'invoicing.document.converted',
      entityType: 'BillingDocument',
      entityId: doc.id,
      diff: {
        after: {
          orderId: order.id,
          orderNumber: order.orderNumber,
          ...(held.length > 0 ? { heldFor: held.map((reason) => reason.kind) } : {}),
        },
      },
    });

    // Who a held order asks to sign it off: the business's team, the account's
    // own approvers, or both (sparx persona issue 087). Read the way the
    // console reads it, so the task and the email go to the people who can act.
    const asks: SignOffSide[] =
      held.length > 0
        ? (
            await loadOrderSignOff(tx, ctx.tenantId, {
              customerId,
              accountId: doc.companyId,
              propertyId: doc.propertyId,
              totalCents,
              metadata: order.metadata,
            })
          ).state.waitingOn
        : [];

    return { document: updatedDoc, order, invoiceId, held, asks };
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
  if (result.invoiceId && result.document.companyId) {
    // The same announcement checkout makes for an invoice on terms.
    await publishPlatformEvent({
      id: crypto.randomUUID(),
      topic: 'b2b.invoice.created',
      tenantId: ctx.tenantId,
      occurredAt: result.order.placedAt,
      payload: {
        invoiceId: result.invoiceId,
        accountId: result.document.companyId,
        orderId: result.order.id,
        orderNumber: result.order.orderNumber,
      },
    });
  }
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

  // …and `order.placed`, the catalog topic the rest of the platform listens to
  // (see order-service.ts, which says why `order.created` alone reaches nobody
  // outside this process). An order made from a quote was announced to no one:
  // no confirmation email, no automation keyed on a new order, and no stock
  // taken off the shelves (sparx persona issue 084).
  //
  // A HELD order is not placed yet, so it is announced as waiting instead, with
  // the same payload checkout sends; signing it off announces `order.placed`.
  await publishPlatformEvent(
    result.held.length > 0
      ? {
          id: crypto.randomUUID(),
          topic: 'b2b.order.pending_approval',
          tenantId: ctx.tenantId,
          occurredAt: result.order.placedAt,
          payload: {
            orderId: result.order.id,
            orderNumber: result.order.orderNumber,
            companyId: result.document.companyId,
            asks: result.asks,
          },
        }
      : {
          id: crypto.randomUUID(),
          topic: 'order.placed',
          tenantId: ctx.tenantId,
          occurredAt: result.order.placedAt,
          payload: { orderId: result.order.id, orderNumber: result.order.orderNumber },
        }
  );

  return result;
}
