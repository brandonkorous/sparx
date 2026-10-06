// Snapshot freeze payload (docs/87 §4) — the immutable JSON shape stored when a
// billing document enters a `snapshotOnEnter` stage. Pure + DB-free so it is
// unit-testable and deterministic: the same document + lines + stage always
// freeze to the same payload. Decimals are normalized to numbers (lossless at
// the (12,2)/(12,3) scales the schema uses) so the frozen record is plain JSON.

import { poNumberOf } from '@wizeworks/crm-schemas';
import type { BillingDocument, BillingDocumentLine, DocumentStage } from '@wizeworks/db';

export interface BillingSnapshotLine {
  id: string;
  lineTypeId: string | null;
  productId: string | null;
  variantId: string | null;
  technicianUserId: string | null;
  description: string;
  quantity: number;
  unitPrice: number;
  costCents: number | null;
  appliedMarkup: unknown;
  taxable: boolean;
  discountAmount: number;
  taxAmount: number;
  lineSubtotal: number;
  lineTotal: number;
  /** Core deposit per unit (sparx issue 051); absent on snapshots frozen before it. */
  coreCharge?: number | null;
  sortOrder: number;
}

export interface BillingSnapshotPayload {
  stage: { id: string; name: string; customerLabel: string; stageType: string };
  document: {
    id: string;
    number: string | null;
    currency: string;
    taxRate: number;
    status: string;
    notes: string | null;
    validUntil: string | null;
    /** The buyer's purchase order number (issue 077). Absent on snapshots
     *  frozen before it was carried. */
    poNumber?: string | null;
    totals: {
      subtotal: number;
      discountTotal: number;
      taxTotal: number;
      shippingTotal: number;
      surchargeTotal: number;
      /** Absent on snapshots frozen before core deposits existed. */
      coreChargeTotal?: number;
      total: number;
      depositTotal: number;
      amountPaid: number;
      balance: number;
    };
  };
  party: {
    customerId: string | null;
    companyId: string | null;
    billTo: unknown;
    shipTo: unknown;
    /**
     * WHO ISSUED IT, frozen with everything else.
     *
     * `billTo` and `shipTo` were snapshotted here from the start and the seller
     * was not, which left the immutable record of a document unable to say who
     * sent it — so reprinting one went to the live business and reproduced the
     * exact rewrite `issued_by` exists to prevent. A frozen record that names
     * the customer but not the seller is only half a record.
     *
     * Null on a document that has not been finalized, and on anything issued
     * before the column existed.
     */
    issuedBy: unknown;
  };
  lines: BillingSnapshotLine[];
}

export function buildSnapshotPayload(
  document: BillingDocument,
  lines: BillingDocumentLine[],
  stage: DocumentStage
): BillingSnapshotPayload {
  return {
    stage: {
      id: stage.id,
      name: stage.name,
      customerLabel: stage.customerLabel,
      stageType: stage.stageType,
    },
    document: {
      id: document.id,
      number: document.number,
      currency: document.currency,
      taxRate: Number(document.taxRate),
      status: document.status,
      notes: document.notes,
      validUntil: document.validUntil ? document.validUntil.toISOString() : null,
      poNumber: poNumberOf(document.metadata),
      totals: {
        subtotal: Number(document.subtotal),
        discountTotal: Number(document.discountTotal),
        taxTotal: Number(document.taxTotal),
        shippingTotal: Number(document.shippingTotal),
        surchargeTotal: Number(document.surchargeTotal),
        coreChargeTotal: Number(document.coreChargeTotal ?? 0),
        total: Number(document.total),
        depositTotal: Number(document.depositTotal),
        amountPaid: Number(document.amountPaid),
        balance: Number(document.balance),
      },
    },
    party: {
      customerId: document.customerId,
      companyId: document.companyId,
      billTo: document.billTo ?? null,
      shipTo: document.shipTo ?? null,
      issuedBy: document.issuedBy ?? null,
    },
    lines: lines.map((l) => ({
      id: l.id,
      lineTypeId: l.lineTypeId,
      productId: l.productId,
      variantId: l.variantId,
      technicianUserId: l.technicianUserId,
      description: l.description,
      quantity: Number(l.quantity),
      unitPrice: Number(l.unitPrice),
      costCents: l.costCents,
      appliedMarkup: l.appliedMarkup ?? null,
      taxable: l.taxable,
      discountAmount: Number(l.discountAmount),
      taxAmount: Number(l.taxAmount),
      lineSubtotal: Number(l.lineSubtotal),
      lineTotal: Number(l.lineTotal),
      coreCharge: l.coreCharge == null ? null : Number(l.coreCharge),
      sortOrder: l.sortOrder,
    })),
  };
}
