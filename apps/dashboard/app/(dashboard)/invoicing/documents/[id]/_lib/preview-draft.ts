// Maps a SAVED billing document onto the POST /v1/invoicing/documents/preview body.
//
// Why the preview endpoint and not the existing `/[id]/pdf`: the endpoint runs the
// same render + totals path either way, and going through the draft body keeps the
// document editor and the create wizard on ONE preview mechanism.
//
// "Live" on this surface means something specific: the line grid is NOT a dirty
// form — every edit (description, qty, price, taxable, markup, add, remove) commits
// to the server on blur/change and then calls `router.refresh()`. So the freshest
// state IS the server's, and rebuilding the draft from the re-fetched document on
// each refresh is what makes the preview track edits. There is no unsaved form
// state on this page to preview from.

/** Structurally matches the document shape the editor page already fetches. */
export interface PreviewableDocument {
  number: string | null;
  status: string;
  currency: string;
  /** Already a FRACTION on a saved document (0.0875) — no conversion needed. */
  taxRate: string | number;
  customerId: string | null;
  b2bAccountId: string | null;
  stageId: string;
  shippingTotal: string | number;
  surchargeTotal: string | number;
  depositTotal: string | number;
  amountPaid: string | number;
  dueAt: string | null;
  validUntil: string | null;
  notes: string | null;
  lines: {
    lineTypeId: string | null;
    description: string;
    quantity: string | number;
    unitPrice: string | number;
    discountAmount: string | number;
    taxable: boolean;
    sortOrder: number;
  }[];
}

export function buildDocumentDraft(doc: PreviewableDocument): Record<string, unknown> {
  return {
    stageId: doc.stageId,
    number: doc.number ?? undefined,
    status: doc.status,
    currency: doc.currency,
    customerId: doc.customerId ?? undefined,
    b2bAccountId: doc.b2bAccountId ?? undefined,
    dueAt: doc.dueAt ?? undefined,
    validUntil: doc.validUntil ?? undefined,
    notes: doc.notes ?? undefined,
    taxRate: Number(doc.taxRate),
    shippingTotal: Number(doc.shippingTotal),
    surchargeTotal: Number(doc.surchargeTotal),
    depositTotal: Number(doc.depositTotal),
    amountPaid: Number(doc.amountPaid),
    lines: doc.lines
      .slice()
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((l) => ({
        // A saved line already carries the real uuid — pass it straight through.
        ...(l.lineTypeId ? { lineTypeId: l.lineTypeId } : {}),
        description: l.description,
        quantity: Number(l.quantity),
        unitPrice: Number(l.unitPrice),
        discountAmount: Number(l.discountAmount),
        taxable: l.taxable,
      })),
  };
}
