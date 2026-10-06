// billingRenderService — assemble a billing document's print render data (docs/87
// §10, Phase 5). Resolves the DB-side concerns (party display, line-type labels,
// dates) and returns a brand-free `BillingRenderData`; the caller resolves the
// tenant brand and hands both to the pure `renderBillingDocumentHtml`.
//
// The two builders here READ numbers a write already persisted, so a LIVE
// document and a FROZEN snapshot print identically (the §10 substance-permanence
// guarantee):
//   · buildRenderData         — the live document at its current stage.
//   · buildRenderDataFromSnapshot — a frozen BillingDocumentSnapshot, exactly as
//     it stood when captured (frozen lines/totals/party + the stage label of the
//     moment), so the approved estimate / final invoice reprints unchanged.
// The third path — buildRenderDataFromDraft, for the unsaved live preview — lives
// in billing-draft-render.ts because it COMPUTES totals instead of reading them.
//
// Identity resolution (party blocks, line-type labels) is shared with that draft
// path via billing-render-parts.ts: a preview that printed a different bill-to
// than the saved document would make the preview a lie.
//
// Tenant-scoped via withTenant() — a caller that forgets it sees nothing (FORCE
// RLS). Party display prefers the document's denormalized billTo/shipTo JSON (the
// frozen party, §6); when the author hasn't set it, it falls back to the live
// customer / B2B account record.

import { withTenant } from '@wizeworks/db';
import { poNumberOf } from '@wizeworks/crm-schemas';
import { billingDocumentNoun, isPriceOfferWorkflow } from '@wizeworks/crm-schemas/builtins';

import type { ServiceContext } from '../errors';
import { CrmNotFoundError } from '../errors';
import type {
  BillingRenderData,
  BillingRenderLine,
  BillingRenderPaymentRow,
  BillingRenderTotals,
} from './billing-document-html';
import { withCoreRows } from './billing-document-html';
import { partyFromJson, resolveBillTo, lineTypeLabels } from './billing-render-parts';
import type { BillingSnapshotPayload } from './billing-snapshot';

const PAYMENT_KIND_LABEL: Record<string, string> = {
  deposit: 'Deposit',
  payment: 'Payment',
  refund: 'Refund',
};

// ── Mappers ──────────────────────────────────────────────────────────────────

function totalsFrom(t: {
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  taxRate: number;
  shippingTotal: number;
  surchargeTotal: number;
  coreChargeTotal?: number;
  total: number;
  depositTotal: number;
  amountPaid: number;
  balance: number;
}): BillingRenderTotals {
  return { ...t };
}

// ── Live document ────────────────────────────────────────────────────────────

/** Build the render data for a live billing document at its current stage. */
export async function buildRenderData(
  ctx: ServiceContext,
  documentId: string
): Promise<BillingRenderData> {
  return withTenant(ctx, async (tx) => {
    const doc = await tx.billingDocument.findUnique({
      where: { id: documentId },
      include: {
        stage: { select: { customerLabel: true } },
        // Which KIND of document this is. A quote and an invoice are the same
        // row on two different workflows, and only the workflow can tell them
        // apart — the stage label cannot, because on the quotes workflow it
        // holds a STANDING ("Draft", "Quoted") and on the invoice workflow it
        // holds a NAME ("Invoice", "Receipt").
        workflow: { select: { slug: true } },
        lines: { orderBy: { sortOrder: 'asc' } },
        payments: { orderBy: { receivedAt: 'asc' } },
      },
    });
    if (doc?.deletedAt !== null) throw new CrmNotFoundError('BillingDocument', documentId);

    const typeLabels = await lineTypeLabels(
      tx,
      doc.lines.map((l) => l.lineTypeId)
    );

    const lines: BillingRenderLine[] = withCoreRows(
      doc.lines.map((l) => ({
        typeLabel: l.lineTypeId ? (typeLabels.get(l.lineTypeId) ?? null) : null,
        description: l.description,
        quantity: Number(l.quantity),
        unitPrice: Number(l.unitPrice),
        lineTotal: Number(l.lineTotal),
        taxable: l.taxable,
        coreCharge: l.coreCharge === null ? null : Number(l.coreCharge),
      }))
    );

    const payments: BillingRenderPaymentRow[] = doc.payments.map((p) => ({
      label: PAYMENT_KIND_LABEL[p.kind] ?? p.kind,
      method: p.method,
      amount: p.kind === 'refund' ? -Number(p.amount) : Number(p.amount),
      receivedAt: p.receivedAt.toISOString(),
    }));

    const billTo = await resolveBillTo(tx, doc.billTo, doc.customerId, doc.companyId);
    const shipTo = partyFromJson(doc.shipTo, 'Ship to');

    // An offer is called what it is, and its stage label becomes the standing
    // in the pill. A bill keeps the behavior it has always had: the stage's own
    // customer label names it, and the pill says whether it has been paid.
    const priceOffer = isPriceOfferWorkflow(doc.workflow.slug);
    const noun = billingDocumentNoun(doc.workflow.slug);

    return {
      title: priceOffer ? noun.charAt(0).toUpperCase() + noun.slice(1) : doc.stage.customerLabel,
      ...(priceOffer ? { standing: doc.stage.customerLabel, priceOffer: true } : {}),
      number: doc.number,
      status: doc.status,
      currency: doc.currency,
      issuedAt: (doc.finalizedAt ?? doc.createdAt).toISOString(),
      dueAt: doc.dueAt ? doc.dueAt.toISOString() : null,
      validUntil: doc.validUntil ? doc.validUntil.toISOString() : null,
      poNumber: poNumberOf(doc.metadata),
      billTo,
      shipTo,
      lines,
      totals: totalsFrom({
        subtotal: Number(doc.subtotal),
        discountTotal: Number(doc.discountTotal),
        taxTotal: Number(doc.taxTotal),
        taxRate: Number(doc.taxRate),
        shippingTotal: Number(doc.shippingTotal),
        surchargeTotal: Number(doc.surchargeTotal),
        coreChargeTotal: Number(doc.coreChargeTotal),
        total: Number(doc.total),
        depositTotal: Number(doc.depositTotal),
        amountPaid: Number(doc.amountPaid),
        balance: Number(doc.balance),
      }),
      notes: doc.notes,
      payments: payments.length > 0 ? payments : undefined,
    };
  });
}

// ── Frozen snapshot ──────────────────────────────────────────────────────────

/** Build the render data for a frozen snapshot — the document exactly as captured.
 *  Frozen lines/totals/party come from the snapshot JSON; line-type labels and a
 *  JSON-less party fall back to the live records (identity rarely changes). */
export async function buildRenderDataFromSnapshot(
  ctx: ServiceContext,
  snapshotId: string
): Promise<BillingRenderData> {
  return withTenant(ctx, async (tx) => {
    const snap = await tx.billingDocumentSnapshot.findUnique({ where: { id: snapshotId } });
    if (!snap) throw new CrmNotFoundError('BillingDocumentSnapshot', snapshotId);

    const payload = snap.snapshot as unknown as BillingSnapshotPayload;

    // Which KIND of document this is, read LIVE rather than from the frozen
    // payload. That is safe here and only here: a document's workflow is set at
    // create and never changes (the editor offers the picker only while the
    // document is new, and the number series is allocated against it), so the
    // answer is the same forever. Nothing else is read live — the lines, the
    // totals and the party all come from the snapshot, which is the §10
    // substance-permanence guarantee. The alternative was a payload field that
    // every snapshot frozen before today would be missing, which would leave
    // old accepted quotes reprinting as unpaid invoices (issue 764).
    const home = await tx.billingDocument.findUnique({
      where: { id: payload.document.id },
      select: { workflow: { select: { slug: true } } },
    });
    const priceOffer = isPriceOfferWorkflow(home?.workflow.slug);
    const noun = billingDocumentNoun(home?.workflow.slug);

    const typeLabels = await lineTypeLabels(
      tx,
      payload.lines.map((l) => l.lineTypeId)
    );

    const lines: BillingRenderLine[] = withCoreRows(
      payload.lines.map((l) => ({
        typeLabel: l.lineTypeId ? (typeLabels.get(l.lineTypeId) ?? null) : null,
        description: l.description,
        quantity: l.quantity,
        unitPrice: l.unitPrice,
        lineTotal: l.lineTotal,
        taxable: l.taxable,
        coreCharge: l.coreCharge ?? null,
      }))
    );

    const billTo = await resolveBillTo(
      tx,
      payload.party.billTo,
      payload.party.customerId,
      payload.party.companyId
    );
    const shipTo = partyFromJson(payload.party.shipTo, 'Ship to');

    return {
      title: priceOffer
        ? noun.charAt(0).toUpperCase() + noun.slice(1)
        : payload.stage.customerLabel,
      ...(priceOffer ? { standing: payload.stage.customerLabel, priceOffer: true } : {}),
      number: snap.documentNumber ?? payload.document.number,
      status: payload.document.status,
      currency: payload.document.currency,
      issuedAt: snap.createdAt.toISOString(),
      dueAt: null,
      validUntil: payload.document.validUntil,
      poNumber: payload.document.poNumber ?? null,
      billTo,
      shipTo,
      lines,
      totals: totalsFrom({ ...payload.document.totals, taxRate: payload.document.taxRate }),
      notes: payload.document.notes,
    };
  });
}
