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
  type ReturnStatus,
} from '@wizeworks/commerce-schemas';
import { GatewayNotFoundError, PaymentConfigError, paymentService } from '@wizeworks/payments';
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
        throw new CommerceValidationError(
          `Approved quantity ${decision.approvedQuantity} exceeds requested ${line.quantity} on line ${decision.returnLineItemId}`
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
      select: { processorRef: true },
    });
    return payment?.processorRef ?? null;
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
  await withTenant(ctx, async (tx) => {
    const ret = await assertReturnWritable(tx, input.returnId);
    const issuedAs = input.asAccountCredit ? 'account_credit' : 'original_payment';
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
