// returnService — RMA workflow. Customer- or staff-initiated; staff
// inspection + restock decision per line item; refund-or-account-credit
// settlement. Actual provider-side refund settlement (Stripe) is
// invoked through the order-payments path; this service owns the
// lifecycle state machine + audit + events.

import {
  ApproveReturnInput,
  CreateReturnRequestInput,
  DenyReturnInput,
  IssueReturnRefundInput,
  RecordReturnInspectionInput,
  SettleReturnExchangeInput,
  type ReturnStatus,
} from '@wizeworks/commerce-schemas';
import { orderRefundsService } from '@wizeworks/crm';
import {
  GatewayNotFoundError,
  PaymentConfigError,
  paymentService,
  takenByGateway,
} from '@wizeworks/payments';
import { withTenant } from '@wizeworks/db';
import type { Prisma, ReturnLineItem, ReturnRequest, TxClient } from '@wizeworks/db';
import { inventoryService } from '@wizeworks/inventory';

import { writeAuditLog } from '../audit';
import { CommerceConflictError, CommerceNotFoundError, CommerceValidationError } from '../errors';
import type { ServiceContext } from '../errors';
import { publishCommerceEvent } from '../events';
import { isInventoryActive } from '../inventory-gate';
import { CUSTOMER_NAME_SELECT, customerDisplayName } from './customer-name';
import { attemptReturnLabel } from './return-label-purchase';

/** A restockable return line resolved to its variant + (optional) location. */
interface RestockLine {
  variantId: string;
  warehouseId: string | null;
  quantity: number;
  inspectionId: string;
  /** The shelf an explicit disposition already chose (docs/146 Phase 9.7).
   *  Null on the ordinary path. */
  binId: string | null;
}

export interface ReturnSummary {
  id: string;
  orderId: string;
  orderNumber: string | null;
  customerId: string | null;
  customerName: string | null;
  status: ReturnStatus;
  preferredOutcome: string;
  itemCount: number;
  requestedAt: string;
}

export interface ReturnDetail extends ReturnSummary {
  staffNote: string | null;
  refundedAmountCents: number | null;
  restockingFeeCents: number | null;
  refundIssuedAs: string | null;
  approvedAt: string | null;
  receivedAt: string | null;
  refundedAt: string | null;
  cancelledAt: string | null;
  items: {
    id: string;
    orderItemId: string;
    orderItemName: string | null;
    quantity: number;
    approvedQuantity: number;
    reasonCode: string;
    customerNote: string | null;
    mediaAssetIds: string[];
  }[];
  inspections: {
    id: string;
    returnLineItemId: string;
    lineItemName: string | null;
    condition: string;
    restockable: boolean;
    warehouseId: string | null;
    warehouseName: string | null;
    note: string | null;
  }[];
  labels: {
    id: string;
    providerSlug: string;
    labelRef: string;
    trackingNumber: string | null;
    trackingUrl: string | null;
    labelMediaId: string | null;
    costCents: number;
  }[];
}

// ─── Reads ───────────────────────────────────────────────────────────

/** Return states that no longer hold a claim on the goods, so the quantity they
 *  named goes back on the shelf as returnable. Everything else — requested,
 *  approved, in transit, received, refunded, exchanged — is spoken for. */
const RELEASED_STATUSES = new Set(['denied', 'cancelled']);

/** One order line, and how much of it the shopper can still send back. */
export interface ReturnableLine {
  orderItemId: string;
  name: string;
  sku: string;
  /** How many were bought. */
  quantity: number;
  /** Already named on a return that has not been denied or cancelled. */
  spokenFor: number;
  returnableQuantity: number;
  unitPriceCents: number;
}

export interface OrderReturnability {
  /** Whether there is anything to offer a "return or exchange" control for. */
  eligible: boolean;
  /** Why not, when not — so a screen can SAY it rather than hiding the control
   *  and leaving the shopper to guess (there is no dead end here). */
  reason: 'not_sent_yet' | 'nothing_left' | null;
  lines: ReturnableLine[];
}

/**
 * What is still returnable on one order.
 *
 * The single point of change for "can this be sent back", so the shopper's own
 * screen and the shop's console can never disagree about it. It answers with
 * FACTS ONLY — what was bought, what is already spoken for, and whether the
 * parcel has actually left. It deliberately applies NO time limit: nothing in
 * the schema records a returns window, and inventing one here would print a
 * deadline no tenant ever set. The tenant's Return Policy page states their rule
 * in their own words, and they approve or deny the request.
 */
export async function returnability(
  ctx: ServiceContext,
  orderId: string
): Promise<OrderReturnability> {
  return withTenant(ctx, async (tx) => {
    const order = await tx.order.findUnique({
      where: { id: orderId },
      select: {
        fulfilledAt: true,
        status: true,
        items: {
          select: { id: true, name: true, sku: true, quantity: true, unitPrice: true },
        },
      },
    });
    if (!order) throw new CommerceNotFoundError('Order', orderId);

    const claims = await tx.returnLineItem.findMany({
      where: { return: { orderId } },
      select: { orderItemId: true, quantity: true, return: { select: { status: true } } },
    });
    const spokenFor = new Map<string, number>();
    for (const claim of claims) {
      if (RELEASED_STATUSES.has(claim.return.status)) continue;
      spokenFor.set(claim.orderItemId, (spokenFor.get(claim.orderItemId) ?? 0) + claim.quantity);
    }

    const lines: ReturnableLine[] = order.items.map((it) => {
      const taken = spokenFor.get(it.id) ?? 0;
      return {
        orderItemId: it.id,
        name: it.name,
        sku: it.sku,
        quantity: it.quantity,
        spokenFor: taken,
        returnableQuantity: Math.max(0, it.quantity - taken),
        unitPriceCents: Math.round(Number(it.unitPrice) * 100),
      };
    });

    // Nothing can come back before it has gone out. `cancelled` orders never
    // shipped, so they are the same case.
    const sent = order.fulfilledAt !== null || order.status === 'delivered';
    if (!sent) return { eligible: false, reason: 'not_sent_yet', lines };
    if (!lines.some((l) => l.returnableQuantity > 0)) {
      return { eligible: false, reason: 'nothing_left', lines };
    }
    return { eligible: true, reason: null, lines };
  });
}

export async function list(
  ctx: ServiceContext,
  filter: {
    status?: ReturnStatus;
    orderId?: string;
    take?: number;
    skip?: number;
  } = {}
): Promise<{ items: ReturnSummary[]; total: number }> {
  return withTenant(ctx, async (tx) => {
    const where: Prisma.ReturnRequestWhereInput = {
      ...(filter.status ? { status: filter.status } : {}),
      ...(filter.orderId ? { orderId: filter.orderId } : {}),
    };
    const [rows, total] = await Promise.all([
      tx.returnRequest.findMany({
        where,
        include: { items: true },
        orderBy: { createdAt: 'desc' },
        take: filter.take ?? 50,
        skip: filter.skip ?? 0,
      }),
      tx.returnRequest.count({ where }),
    ]);

    const orderIds = [...new Set(rows.map((r) => r.orderId))];
    const orders = await tx.order.findMany({
      where: { id: { in: orderIds } },
      select: {
        id: true,
        customerId: true,
        orderNumber: true,
        customer: { select: CUSTOMER_NAME_SELECT },
      },
    });
    const metaByOrder = new Map<string, OrderMeta>(
      orders.map((o) => [
        o.id,
        {
          customerId: o.customerId,
          customerName: customerDisplayName(o.customer),
          orderNumber: o.orderNumber,
        },
      ])
    );

    return {
      items: rows.map((row) => toSummary(row, metaByOrder.get(row.orderId))),
      total,
    };
  });
}

export async function get(ctx: ServiceContext, returnId: string): Promise<ReturnDetail> {
  const detail = await withTenant(ctx, async (tx) => {
    const row = await tx.returnRequest.findFirst({
      where: { id: returnId },
      include: { items: true, inspections: true, labels: true },
    });
    if (!row) return null;
    const order = await tx.order.findFirst({
      where: { id: row.orderId },
      select: {
        customerId: true,
        orderNumber: true,
        customer: { select: CUSTOMER_NAME_SELECT },
        items: { select: { id: true, name: true } },
      },
    });

    // orderItemId → display name (sku/title snapshot frozen on the order line).
    const orderItemName = new Map((order?.items ?? []).map((it) => [it.id, it.name]));
    // returnLineItemId → the product it returns (via its orderItemId).
    const lineItemName = new Map(
      row.items.map((li) => [li.id, orderItemName.get(li.orderItemId) ?? null])
    );
    // Resolve any inspection warehouse ids → names in one query.
    const warehouseIds = [
      ...new Set(row.inspections.map((i) => i.warehouseId).filter((x): x is string => Boolean(x))),
    ];
    const warehouses = warehouseIds.length
      ? await tx.warehouse.findMany({
          where: { id: { in: warehouseIds } },
          select: { id: true, name: true },
        })
      : [];
    const warehouseName = new Map(warehouses.map((w) => [w.id, w.name]));

    const meta: OrderMeta = {
      customerId: order?.customerId ?? null,
      customerName: customerDisplayName(order?.customer ?? null),
      orderNumber: order?.orderNumber ?? null,
    };
    return { row, meta, orderItemName, lineItemName, warehouseName };
  });
  if (!detail) throw new CommerceNotFoundError('ReturnRequest', returnId);

  const { row, meta, orderItemName, lineItemName, warehouseName } = detail;
  return {
    ...toSummary(row, meta),
    staffNote: row.staffNote,
    refundedAmountCents: row.refundedAmountCents,
    restockingFeeCents: row.restockingFeeCents,
    refundIssuedAs: row.refundIssuedAs,
    approvedAt: row.approvedAt?.toISOString() ?? null,
    receivedAt: row.receivedAt?.toISOString() ?? null,
    refundedAt: row.refundedAt?.toISOString() ?? null,
    cancelledAt: row.cancelledAt?.toISOString() ?? null,
    items: row.items.map((it) => ({
      id: it.id,
      orderItemId: it.orderItemId,
      orderItemName: orderItemName.get(it.orderItemId) ?? null,
      quantity: it.quantity,
      approvedQuantity: it.approvedQuantity,
      reasonCode: it.reasonCode,
      customerNote: it.customerNote,
      mediaAssetIds: Array.isArray(it.mediaAssetIds) ? (it.mediaAssetIds as string[]) : [],
    })),
    inspections: row.inspections.map((ins) => ({
      id: ins.id,
      returnLineItemId: ins.returnLineItemId,
      lineItemName: lineItemName.get(ins.returnLineItemId) ?? null,
      condition: ins.condition,
      restockable: ins.restockable,
      warehouseId: ins.warehouseId,
      warehouseName: ins.warehouseId ? (warehouseName.get(ins.warehouseId) ?? null) : null,
      note: ins.note,
    })),
    labels: row.labels.map((lbl) => ({
      id: lbl.id,
      providerSlug: lbl.providerSlug,
      labelRef: lbl.labelRef,
      trackingNumber: lbl.trackingNumber,
      trackingUrl: lbl.trackingUrl,
      labelMediaId: lbl.labelMediaId,
      costCents: lbl.costCents,
    })),
  };
}

// ─── Lifecycle ───────────────────────────────────────────────────────

export async function create(ctx: ServiceContext, rawInput: unknown): Promise<{ id: string }> {
  const input = CreateReturnRequestInput.parse(rawInput);

  const result = await withTenant(ctx, async (tx) => {
    const order = await tx.order.findFirst({
      where: { id: input.orderId },
      select: { id: true, items: { select: { id: true, quantity: true } } },
    });
    if (!order) throw new CommerceNotFoundError('Order', input.orderId);

    const validItemIds = new Set(order.items.map((it) => it.id));
    for (const line of input.items) {
      if (!validItemIds.has(line.orderItemId)) {
        throw new CommerceValidationError(
          `Order item ${line.orderItemId} does not belong to order ${input.orderId}`
        );
      }
    }

    const created = await tx.returnRequest.create({
      data: {
        tenantId: ctx.tenantId,
        orderId: input.orderId,
        requestedBy: input.requestedBy,
        status: 'requested',
        preferredOutcome: input.preferredOutcome,
        items: {
          create: input.items.map((line) => ({
            tenantId: ctx.tenantId,
            orderItemId: line.orderItemId,
            quantity: line.quantity,
            reasonCode: line.reasonCode,
            customerNote: line.customerNote ?? null,
            mediaAssetIds: line.mediaAssetIds,
          })),
        },
      },
      select: { id: true },
    });
    await writeAuditLog({
      tx,
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      actorType: input.requestedBy === 'staff' ? 'user' : 'customer',
      action: 'commerce.return.requested',
      entityType: 'ReturnRequest',
      entityId: created.id,
      diff: { after: { orderId: input.orderId, itemCount: input.items.length } },
    });
    return created.id;
  });

  await publishCommerceEvent({
    tenantId: ctx.tenantId,
    actorId: ctx.userId ?? null,
    topic: 'return.requested',
    data: { returnId: result, orderId: input.orderId },
  });

  return { id: result };
}

export async function approve(
  ctx: ServiceContext,
  rawInput: unknown
): Promise<{ labelMediaId: string | null }> {
  const input = ApproveReturnInput.parse(rawInput);

  await withTenant(ctx, async (tx) => {
    const ret = await assertReturnWritable(tx, input.returnId);
    if (ret.status !== 'requested' && ret.status !== 'denied') {
      throw new CommerceConflictError(
        `Cannot approve return from status "${ret.status}"; expected "requested" or "denied"`
      );
    }
    for (const decision of input.itemDecisions) {
      const line = await tx.returnLineItem.findFirst({
        where: { id: decision.returnLineItemId, returnId: ret.id },
      });
      if (!line) {
        throw new CommerceNotFoundError('ReturnLineItem', decision.returnLineItemId);
      }
      if (decision.approvedQuantity > line.quantity) {
        // Read by a shop owner in a toast, so it says what she can DO about it.
        // It used to name the return line's uuid, which is a sentence for a
        // developer on a screen about somebody's shirt (persona issue 224).
        throw new CommerceValidationError(
          `You can accept back at most ${line.quantity}, because that is what the customer asked to send.`
        );
      }
      await tx.returnLineItem.update({
        where: { id: decision.returnLineItemId },
        data: { approvedQuantity: decision.approvedQuantity },
      });
    }
    await tx.returnRequest.update({
      where: { id: ret.id },
      data: {
        status: 'approved',
        approvedAt: new Date(),
        approvedBy: ctx.userId ?? null,
        staffNote: input.staffNote ?? null,
      },
    });
    await writeAuditLog({
      tx,
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      actorType: ctx.userId ? 'user' : 'system',
      action: 'commerce.return.approved',
      entityType: 'ReturnRequest',
      entityId: ret.id,
      diff: { after: { status: 'approved' } },
    });
  });

  await publishCommerceEvent({
    tenantId: ctx.tenantId,
    actorId: ctx.userId ?? null,
    topic: 'return.approved',
    data: { returnId: input.returnId },
  });

  // Best-effort: auto-purchase a return label from the tenant's connected
  // carrier (cheapest live rate for the approved items, shipped from the
  // customer's address back to the tenant's warehouse). Never blocks
  // approval — no carrier installed, no live rate, or an unconfigured
  // warehouse address all just mean the dashboard falls back to its
  // "print label manually" CTA (labelMediaId: null), same as before.
  const labelMediaId = await attemptReturnLabel(ctx, input.returnId);
  return { labelMediaId };
}

export async function deny(ctx: ServiceContext, rawInput: unknown): Promise<void> {
  const input = DenyReturnInput.parse(rawInput);
  await withTenant(ctx, async (tx) => {
    const ret = await assertReturnWritable(tx, input.returnId);
    if (ret.status !== 'requested') {
      throw new CommerceConflictError(
        `Cannot deny return from status "${ret.status}"; expected "requested"`
      );
    }
    await tx.returnRequest.update({
      where: { id: ret.id },
      data: { status: 'denied', staffNote: input.reason },
    });
    await writeAuditLog({
      tx,
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      actorType: ctx.userId ? 'user' : 'system',
      action: 'commerce.return.denied',
      entityType: 'ReturnRequest',
      entityId: ret.id,
      diff: { after: { status: 'denied', reason: input.reason } },
    });
  });
}

export async function markReceived(ctx: ServiceContext, returnId: string): Promise<void> {
  await withTenant(ctx, async (tx) => {
    const ret = await assertReturnWritable(tx, returnId);
    if (
      ret.status !== 'approved' &&
      ret.status !== 'in_transit' &&
      ret.status !== 'awaiting_shipment'
    ) {
      throw new CommerceConflictError(`Cannot mark received from status "${ret.status}"`);
    }
    await tx.returnRequest.update({
      where: { id: returnId },
      data: { status: 'received', receivedAt: new Date() },
    });
    await writeAuditLog({
      tx,
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      actorType: ctx.userId ? 'user' : 'system',
      action: 'commerce.return.received',
      entityType: 'ReturnRequest',
      entityId: returnId,
      diff: { after: { status: 'received' } },
    });
  });

  await publishCommerceEvent({
    tenantId: ctx.tenantId,
    actorId: ctx.userId ?? null,
    topic: 'return.received',
    data: { returnId },
  });
}

export async function recordInspection(ctx: ServiceContext, rawInput: unknown): Promise<void> {
  const input = RecordReturnInspectionInput.parse(rawInput);
  await withTenant(ctx, async (tx) => {
    const ret = await assertReturnWritable(tx, input.returnId);
    if (ret.status !== 'received' && ret.status !== 'inspecting') {
      throw new CommerceConflictError(`Cannot record inspection from status "${ret.status}"`);
    }
    for (const ins of input.inspections) {
      const line = await tx.returnLineItem.findFirst({
        where: { id: ins.returnLineItemId, returnId: ret.id },
      });
      if (!line) throw new CommerceNotFoundError('ReturnLineItem', ins.returnLineItemId);
      await tx.returnInspection.create({
        data: {
          tenantId: ctx.tenantId,
          returnId: ret.id,
          returnLineItemId: ins.returnLineItemId,
          condition: ins.condition,
          restockable: ins.restockable,
          warehouseId: ins.warehouseId ?? null,
          photoMediaIds: ins.photoMediaIds,
          note: ins.note ?? null,
          inspectedBy: ctx.userId ?? null,
        },
      });
    }
    await tx.returnRequest.update({
      where: { id: ret.id },
      data: { status: 'inspected' },
    });
    await writeAuditLog({
      tx,
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      actorType: ctx.userId ? 'user' : 'system',
      action: 'commerce.return.inspected',
      entityType: 'ReturnRequest',
      entityId: ret.id,
      diff: { after: { status: 'inspected', lineCount: input.inspections.length } },
    });
  });
}

/**
 * Settle an exchange by sending the replacement. NO money moves.
 *
 * The only other way out of `inspected` was `issueRefund`, so an even swap could
 * be ended only by refunding a customer who was owed nothing (persona issue
 * 220). This is its own terminal status rather than a zero refund: a $0.00
 * refund per swap makes "how much did we give back" unanswerable.
 *
 * The returned goods restock exactly as they do on a refund — same collector,
 * same idempotency key — so a line already put back by an explicit disposition
 * is a no-op here rather than a second movement.
 */
export async function settleExchange(
  ctx: ServiceContext,
  rawInput: unknown
): Promise<{ returnId: string }> {
  const input = SettleReturnExchangeInput.parse(rawInput);
  const inventoryActive = await isInventoryActive(ctx.tenantId);

  let restockLines: RestockLine[] = [];
  let sentLabel = '';
  await withTenant(ctx, async (tx) => {
    const ret = await assertReturnWritable(tx, input.returnId);
    if (ret.status !== 'inspected' && ret.status !== 'received') {
      throw new CommerceConflictError(
        `Cannot settle an exchange from status "${ret.status}"; expected "inspected" or "received"`
      );
    }
    const replacement = await tx.productVariant.findFirst({
      where: { id: input.replacementVariantId },
      select: {
        id: true,
        sku: true,
        title: true,
        product: { select: { title: true } },
        optionAssignments: { select: { optionValue: { select: { value: true } } } },
      },
    });
    if (!replacement) {
      throw new CommerceNotFoundError('ProductVariant', input.replacementVariantId);
    }
    // The product's name plus the version a person would say. Most catalogs
    // leave `title` blank, and a note reading "THE-ASH-OVER-M-SLATE" is a note
    // for a developer — "M · Slate" is what Devi called it when she picked it.
    const values = replacement.optionAssignments.map((row) => row.optionValue.value).join(' · ');
    const version = replacement.title ?? (values === '' ? replacement.sku : values);
    sentLabel = `${replacement.product.title} — ${version}`;

    // The staff note is the only place the record can say WHAT went out — a
    // return has no column for a replacement. Appended rather than replacing so
    // an approval note survives (issue 220's remaining gap).
    const said = [ret.staffNote, input.staffNote, `Sent instead: ${sentLabel} ×${input.quantity}`]
      .filter((part): part is string => typeof part === 'string' && part.trim().length > 0)
      .join('\n');

    await tx.returnRequest.update({
      where: { id: ret.id },
      data: {
        status: 'exchanged',
        refundedAt: new Date(),
        refundedAmountCents: 0,
        staffNote: said,
      },
    });
    if (inventoryActive) restockLines = await collectRestockLines(tx, ret.id);
    await writeAuditLog({
      tx,
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      actorType: ctx.userId ? 'user' : 'system',
      action: 'commerce.return.exchanged',
      entityType: 'ReturnRequest',
      entityId: ret.id,
      diff: {
        after: {
          status: 'exchanged',
          replacementVariantId: input.replacementVariantId,
          quantity: input.quantity,
          refundAmountCents: 0,
        },
      },
    });
  });

  // Both halves of the swap, post-commit for the same reason a refund's restock
  // is: the settlement is the authority and a stock hiccup must not unwind it.
  if (inventoryActive) {
    const fallbackWarehouseId = await inventoryService.resolveDefaultWarehouseId(ctx);
    for (const line of restockLines) {
      const warehouseId = line.warehouseId ?? fallbackWarehouseId;
      if (!warehouseId) continue;
      await inventoryService.adjust(ctx, {
        variantId: line.variantId,
        warehouseId,
        delta: line.quantity,
        reason: 'return',
        referenceType: 'Return',
        referenceId: input.returnId,
        idempotencyKey: `return-restock:${input.returnId}:${line.inspectionId}`,
        ...(line.binId ? { binId: line.binId } : {}),
      });
    }
    if (fallbackWarehouseId) {
      await inventoryService.adjust(ctx, {
        variantId: input.replacementVariantId,
        warehouseId: fallbackWarehouseId,
        delta: -input.quantity,
        // It left the building for a customer. `sale` is what that is, and it
        // keeps the replacement out of shrinkage reports.
        reason: 'sale',
        referenceType: 'Return',
        referenceId: input.returnId,
        idempotencyKey: `return-exchange-out:${input.returnId}`,
        note: `Replacement sent for return ${input.returnId}`,
      });
    }
  }

  await publishCommerceEvent({
    tenantId: ctx.tenantId,
    actorId: ctx.userId ?? null,
    topic: 'return.exchanged',
    data: {
      returnId: input.returnId,
      replacementVariantId: input.replacementVariantId,
      quantity: input.quantity,
    },
  });

  return { returnId: input.returnId };
}

export async function issueRefund(
  ctx: ServiceContext,
  rawInput: unknown
): Promise<{ refundId: string }> {
  const input = IssueReturnRefundInput.parse(rawInput);
  const inventoryActive = await isInventoryActive(ctx.tenantId);

  // Resolve the original captured payment BEFORE committing — an original-payment
  // refund settles through the gateway first, so a gateway failure leaves the return in
  // its prior state (staff can retry) instead of marking it refunded without the money
  // moving. Store-credit refunds never touch a gateway.
  const chargeRef = await withTenant(ctx, async (tx) => {
    const ret = await assertReturnWritable(tx, input.returnId);
    if (ret.status !== 'inspected' && ret.status !== 'received') {
      throw new CommerceConflictError(
        `Cannot issue refund from status "${ret.status}"; expected "inspected" or "received"`
      );
    }
    if (input.asAccountCredit) return null;
    const payment = await tx.orderPayment.findFirst({
      where: { orderId: ret.orderId, status: 'captured' },
      orderBy: { capturedAt: 'desc' },
      select: { processor: true, processorRef: true },
    });
    // A reference alone is NOT proof there is a charge to reverse. Money taken
    // by hand — cash, a cheque, a bank transfer — never passed through a
    // gateway, whatever got written in the reference box, and asking a gateway
    // to reverse it fails with "no payment gateway is configured" on a shop
    // that never had one (persona issue 223). The PROCESSOR is what decides.
    if (!payment || !takenByGateway(payment.processor)) return null;
    return payment.processorRef ?? null;
  });

  // Settle through the tenant's gateway (sparx Pay / Stripe Direct). The charge.refunded
  // webhook later reconciles the order's payment status; this just triggers the refund.
  if (chargeRef) {
    let result;
    try {
      result = await paymentService.refund({
        tenantId: ctx.tenantId,
        chargeId: chargeRef,
        amount: input.refundAmountCents,
      });
    } catch (err) {
      if (err instanceof PaymentConfigError || err instanceof GatewayNotFoundError) {
        throw new CommerceValidationError(
          'No payment gateway is configured to settle this refund. Refund the customer manually or issue account credit.'
        );
      }
      throw err;
    }
    if (!result.success) {
      throw new CommerceValidationError(
        `Refund failed at the payment gateway: ${result.errorMessage ?? 'unknown error'}`
      );
    }
  }

  let refundId = '';
  let restockLines: RestockLine[] = [];
  // The order this money came off, and which of its lines. Captured inside the
  // txn and used AFTER it to record the refund against the order itself
  // (persona issue 222).
  let refundedOrderId = '';
  let refundedLines: { orderItemId: string; quantity: number; amount: number; name: string }[] = [];
  await withTenant(ctx, async (tx) => {
    const ret = await assertReturnWritable(tx, input.returnId);
    const issuedAs = input.asAccountCredit ? 'account_credit' : 'original_payment';
    refundedOrderId = ret.orderId;
    await tx.returnRequest.update({
      where: { id: ret.id },
      data: {
        status: 'refunded',
        refundedAt: new Date(),
        refundedAmountCents: input.refundAmountCents,
        restockingFeeCents: input.restockingFeeCents ?? null,
        refundIssuedAs: issuedAs,
      },
    });
    refundId = ret.id;
    refundedLines = await refundShareByLine(tx, ret.id, input.refundAmountCents);
    if (inventoryActive) {
      restockLines = await collectRestockLines(tx, ret.id);
    }
    await writeAuditLog({
      tx,
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      actorType: ctx.userId ? 'user' : 'system',
      action: 'commerce.return.refunded',
      entityType: 'ReturnRequest',
      entityId: ret.id,
      diff: {
        after: {
          refundAmountCents: input.refundAmountCents,
          issuedAs,
        },
      },
    });
  });

  // Restock the goods that inspection marked restockable — a `return` movement
  // per line (docs/100 P2 item 4) through the audited adjust API, idempotency-
  // keyed on the inspection so a retried refund restocks once. Runs post-commit:
  // the refund is the authority, restock is a follow-on, so a stock hiccup can't
  // unwind a settled refund. No-op when inventory is off.
  if (restockLines.length > 0) {
    const fallbackWarehouseId = await inventoryService.resolveDefaultWarehouseId(ctx);
    for (const line of restockLines) {
      const warehouseId = line.warehouseId ?? fallbackWarehouseId;
      if (!warehouseId) continue; // no active warehouse to restock into
      await inventoryService.adjust(ctx, {
        variantId: line.variantId,
        warehouseId,
        delta: line.quantity,
        reason: 'return',
        referenceType: 'Return',
        referenceId: input.returnId,
        // The SAME key `setReturnDisposition` uses for a restock, so a line that
        // was already dispositioned is a no-op here rather than a second
        // movement (docs/146 Phase 9.7).
        idempotencyKey: `return-restock:${input.returnId}:${line.inspectionId}`,
        ...(line.binId ? { binId: line.binId } : {}),
      });
    }
  }

  // Record it against the ORDER, not only against the return.
  //
  // Without this the return said "$42.00 given back" while the order it came
  // from still read "Paid $147.00, nothing refunded" and went on offering to
  // refund the whole $147.00 — money already handed back, offered again
  // (persona issue 222). `recordRefund` is the one write path that keeps
  // amountPaid, paymentStatus, refundTotal and each line's quantityRefunded in
  // step, and publishes `order.refunded` for the CRM's lifetime-spend.
  //
  // Post-commit, and swallowed: the return IS settled and the customer has
  // their money. A bookkeeping write that fails must not unwind that, exactly
  // as the restock above must not.
  if (refundedOrderId !== '' && input.refundAmountCents > 0) {
    try {
      // The reason is READ on the order pane by a shop owner, so it names what
      // came back rather than the return's id. An id there is a sentence for a
      // developer sitting on a screen about money.
      const sentBack = refundedLines.map((line) => line.name).join(', ');
      await orderRefundsService.recordRefund(ctx, {
        orderId: refundedOrderId,
        amount: input.refundAmountCents / 100,
        reason: sentBack === '' ? 'Sent back by the customer' : `Sent back: ${sentBack}`,
        ...(refundedLines.length > 0
          ? {
              lines: refundedLines.map(({ orderItemId, quantity, amount }) => ({
                orderItemId,
                quantity,
                amount,
              })),
            }
          : {}),
        metadata: {
          returnId: input.returnId,
          issuedAs: input.asAccountCredit ? 'account_credit' : 'original_payment',
        },
      });
    } catch (err) {
      console.error('[returns] refund settled but not recorded against the order', {
        err,
        returnId: input.returnId,
        orderId: refundedOrderId,
      });
    }
  }

  await publishCommerceEvent({
    tenantId: ctx.tenantId,
    actorId: ctx.userId ?? null,
    topic: 'return.refunded',
    data: {
      returnId: input.returnId,
      refundAmountCents: input.refundAmountCents,
      asAccountCredit: input.asAccountCredit,
    },
  });

  return { refundId };
}

/**
 * Split a return's refund across the order lines it came back from.
 *
 * The operator types ONE figure, and `recordRefund` caps each line at what is
 * left un-refunded on it — so the figure has to be apportioned before it can be
 * recorded per line. Shared by unit price, which is what the money actually
 * represents; the remainder lands on the last line so the parts always sum to
 * the whole and never a cent more.
 *
 * Returns an empty list when nothing can be apportioned (free-text lines, or a
 * refund that is all shipping). `recordRefund` then books it against the order
 * header, which is the honest answer for postage given back.
 */
async function refundShareByLine(
  tx: TxClient,
  returnId: string,
  refundAmountCents: number
): Promise<{ orderItemId: string; quantity: number; amount: number; name: string }[]> {
  if (refundAmountCents <= 0) return [];
  const lines = await tx.returnLineItem.findMany({
    where: { returnId },
    select: { orderItemId: true, approvedQuantity: true, quantity: true },
  });
  if (lines.length === 0) return [];

  const orderItems = await tx.orderItem.findMany({
    where: { id: { in: lines.map((line) => line.orderItemId) } },
    select: { id: true, name: true, unitPrice: true, quantity: true, quantityRefunded: true },
  });
  const priceByItem = new Map(orderItems.map((item) => [item.id, Number(item.unitPrice)]));
  const nameByItem = new Map(orderItems.map((item) => [item.id, item.name]));
  const leftByItem = new Map(
    orderItems.map((item) => [item.id, item.quantity - item.quantityRefunded])
  );

  const taking = lines
    .map((line) => {
      const asked = line.approvedQuantity > 0 ? line.approvedQuantity : line.quantity;
      return {
        orderItemId: line.orderItemId,
        quantity: Math.min(asked, leftByItem.get(line.orderItemId) ?? 0),
        unit: priceByItem.get(line.orderItemId) ?? 0,
        name: nameByItem.get(line.orderItemId) ?? 'Item',
      };
    })
    .filter((line) => line.quantity > 0 && line.unit > 0);
  if (taking.length === 0) return [];

  const worth = taking.reduce((sum, line) => sum + Math.round(line.unit * 100) * line.quantity, 0);
  if (worth <= 0) return [];

  let spent = 0;
  return taking.map((line, index) => {
    const share =
      index === taking.length - 1
        ? refundAmountCents - spent
        : Math.round((refundAmountCents * (Math.round(line.unit * 100) * line.quantity)) / worth);
    spent += share;
    return {
      orderItemId: line.orderItemId,
      quantity: line.quantity,
      amount: share / 100,
      name: line.name,
    };
  });
}

/**
 * Resolve a return's restockable inspections to {variant, warehouse, qty} lines.
 * Restock quantity is the line's approved quantity (the accepted-back count),
 * falling back to the requested quantity. Free-text order lines (no variant) and
 * non-restockable / zero-qty inspections are skipped.
 */
async function collectRestockLines(tx: TxClient, returnId: string): Promise<RestockLine[]> {
  const inspections = await tx.returnInspection.findMany({
    where: { returnId, restockable: true },
    select: { id: true, returnLineItemId: true, warehouseId: true, dispositionBinId: true },
  });
  if (inspections.length === 0) return [];

  const lineRows = await tx.returnLineItem.findMany({
    where: { id: { in: inspections.map((i) => i.returnLineItemId) } },
    select: { id: true, orderItemId: true, approvedQuantity: true, quantity: true },
  });
  const lineById = new Map(lineRows.map((l) => [l.id, l]));

  const orderItems = await tx.orderItem.findMany({
    where: { id: { in: lineRows.map((l) => l.orderItemId) } },
    select: { id: true, variantId: true },
  });
  const variantByOrderItem = new Map(orderItems.map((o) => [o.id, o.variantId]));

  const lines: RestockLine[] = [];
  for (const ins of inspections) {
    const line = lineById.get(ins.returnLineItemId);
    if (!line) continue;
    const variantId = variantByOrderItem.get(line.orderItemId);
    if (!variantId) continue; // free-text line — untracked
    const quantity = line.approvedQuantity > 0 ? line.approvedQuantity : line.quantity;
    if (quantity <= 0) continue;
    lines.push({
      variantId,
      warehouseId: ins.warehouseId,
      quantity,
      inspectionId: ins.id,
      // Carry the shelf an explicit disposition already chose (docs/146 Phase
      // 9.7). Null on the ordinary path, where the ledger's mirror picks the
      // location's default — which is the right answer for a plain restock.
      binId: ins.dispositionBinId,
    });
  }
  return lines;
}

// ─── helpers ─────────────────────────────────────────────────────────

async function assertReturnWritable(tx: TxClient, returnId: string): Promise<ReturnRequest> {
  const ret = await tx.returnRequest.findFirst({ where: { id: returnId } });
  if (!ret) throw new CommerceNotFoundError('ReturnRequest', returnId);
  if (ret.status === 'cancelled' || ret.status === 'refunded') {
    throw new CommerceConflictError(`Cannot mutate a ${ret.status} return`);
  }
  return ret;
}

// Order-derived display fields a return surfaces (the return row itself only
// stores an orderId — name/number come from the order + its customer).
interface OrderMeta {
  customerId: string | null;
  customerName: string | null;
  orderNumber: string | null;
}

function toSummary(
  row: ReturnRequest & { items: ReturnLineItem[] },
  meta: OrderMeta | undefined
): ReturnSummary {
  return {
    id: row.id,
    orderId: row.orderId,
    orderNumber: meta?.orderNumber ?? null,
    customerId: meta?.customerId ?? null,
    customerName: meta?.customerName ?? null,
    status: row.status as ReturnStatus,
    preferredOutcome: row.preferredOutcome,
    itemCount: row.items.length,
    requestedAt: row.createdAt.toISOString(),
  };
}
