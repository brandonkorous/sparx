// Emailing a placed purchase order to the supplier (sparx persona issue 071).
//
// Placing an order used to send nothing: the dialog said "print the order or
// pass it on yourself", and the owner did exactly that from his own mailbox.
// This is the data half of sending it from here. The transport lives in the
// composition root (api-rest), as it does for invoices: this package has no
// mail dependency and should not grow one for every unit test in it to pay for.
//
// The send is recorded on the audit trail, not on a column. An order can go
// more than once (a resend after a supplier lost it, a second address), and
// each send is an event with a time and a recipient, not a state of the order.

import { withTenant } from '@wizeworks/db';

import { writeAuditLog } from '../audit';
import { InventoryValidationError } from '../errors';
import type { ServiceContext } from '../errors';
import {
  loadPurchaseOrderDocumentData,
  type PurchaseOrderDocumentData,
} from './purchase-order-document';
import {
  loadPurchaseOrderDetail,
  PURCHASE_ORDER_EMAILED_ACTION,
  type PurchaseOrderDetail,
} from './purchase-order-shared';

/**
 * Why an order in this state cannot go to the supplier, or null when it can.
 *
 * Only an order that has been PLACED is one the supplier should act on. A draft
 * is still being written, and an order waiting for sign-off has not been
 * approved: sending either would have the supplier ship goods nobody has agreed
 * to buy. A received or closed one may still go, as a copy for their records.
 */
export function purchaseOrderEmailRefusal(order: {
  number: string;
  status: string;
}): string | null {
  switch (order.status) {
    case 'draft':
      return `${order.number} is still a draft. Place it first: a draft is not an order yet.`;
    case 'pending_approval':
      return `${order.number} is waiting for sign-off. It can go to the supplier once somebody approves it.`;
    case 'cancelled':
      return `${order.number} was canceled, so there is nothing for the supplier to supply.`;
    default:
      return null;
  }
}

export interface PurchaseOrderEmail {
  /** Where it goes: the address typed for this send, else the supplier's own. */
  to: string;
  document: PurchaseOrderDocumentData;
}

/**
 * Everything the email needs, or a refusal the owner can act on.
 *
 * `to` overrides the supplier's address for this one send (a rep's own inbox,
 * say) without changing their record.
 */
export async function preparePurchaseOrderEmail(
  ctx: ServiceContext,
  id: string,
  to?: string | null
): Promise<PurchaseOrderEmail> {
  const document = await withTenant(ctx, (tx) => loadPurchaseOrderDocumentData(tx, id));
  const refusal = purchaseOrderEmailRefusal(document);
  if (refusal) throw new InventoryValidationError(refusal);

  const address = to?.trim() ? to.trim() : document.vendorEmail;
  if (!address) {
    throw new InventoryValidationError(
      `There is no email address for ${document.vendor.name}. Add one on their supplier page, or type one in, then send it again.`,
      [{ field: 'to', message: 'Needed to send the order.' }]
    );
  }
  return { to: address, document };
}

function money(cents: number, currency: string): string {
  const amount = cents / 100;
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
}

/**
 * The order's lines as the supplier reads them.
 *
 * Their own code rides beside ours when it differs, because it is the one they
 * pick by. The arithmetic sits on the line so it can be checked by eye.
 */
export function purchaseOrderEmailLines(
  document: Pick<PurchaseOrderDocumentData, 'lines' | 'currency'>
): { title: string; subtitle: string; amount: string }[] {
  return document.lines.map((line) => {
    const codes = [
      line.sku,
      line.supplierSku && line.supplierSku !== line.sku ? `their code ${line.supplierSku}` : null,
    ].filter((part): part is string => Boolean(part));
    const sum = `${String(line.quantityOrdered)} × ${money(line.unitCostCents, document.currency)}`;
    return {
      title: line.description,
      subtitle: [...codes, sum].join(' · '),
      amount: money(line.lineTotalCents, document.currency),
    };
  });
}

/** Subtotal, and freight only when there is any: a "Freight $0.00" row is a
 *  charge nobody agreed to and the supplier would ask about. */
export function purchaseOrderEmailSummary(
  document: Pick<PurchaseOrderDocumentData, 'subtotalCents' | 'freightCents' | 'currency'>
): { label: string; value: string }[] {
  const rows = [{ label: 'Subtotal', value: money(document.subtotalCents, document.currency) }];
  if (document.freightCents > 0) {
    rows.push({ label: 'Freight', value: money(document.freightCents, document.currency) });
  }
  return rows;
}

/**
 * The `purchase-order-sent` template's props for this order. One builder, so
 * the REST send and the MCP send cannot word the same order two ways.
 */
export function purchaseOrderEmailProps(
  document: PurchaseOrderDocumentData,
  sender: { fromName: string; canReply: boolean }
) {
  return {
    fromName: sender.fromName,
    supplierName: document.vendor.name,
    contactName: document.vendorContactName,
    documentNumber: document.number,
    total: document.totalCents / 100,
    currency: document.currency,
    expectedBy: document.expectedArrivalAt,
    shipTo: {
      name: document.shipTo.name,
      lines: document.shipTo.lines.filter((line) => line.trim() !== ''),
    },
    reference: document.reference,
    paymentTerms: document.paymentTerms,
    lines: purchaseOrderEmailLines(document),
    summary: purchaseOrderEmailSummary(document),
    note: document.notes,
    canReply: sender.canReply,
  };
}

/** Write the send onto the order's trail and return the order as it now reads. */
export async function recordPurchaseOrderEmailed(
  ctx: ServiceContext,
  id: string,
  to: string
): Promise<PurchaseOrderDetail> {
  return withTenant(ctx, async (tx) => {
    const detail = await loadPurchaseOrderDetail(tx, id);
    await writeAuditLog({
      tx,
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      actorType: ctx.userId ? 'user' : 'system',
      action: PURCHASE_ORDER_EMAILED_ACTION,
      entityType: 'PurchaseOrder',
      entityId: id,
      diff: { after: { number: detail.number, to } },
    });
    return loadPurchaseOrderDetail(tx, id);
  });
}
