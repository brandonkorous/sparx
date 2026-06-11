// billingRenderService — assemble a billing document's print render data (docs/87
// §10, Phase 5). Resolves the DB-side concerns (party display, line-type labels,
// dates) and returns a brand-free `BillingRenderData`; the caller resolves the
// tenant brand and hands both to the pure `renderBillingDocumentHtml`.
//
// One assembler serves both render paths so a LIVE document and a FROZEN snapshot
// print identically (the §10 substance-permanence guarantee):
//   · buildRenderData         — the live document at its current stage.
//   · buildRenderDataFromSnapshot — a frozen BillingDocumentSnapshot, exactly as
//     it stood when captured (frozen lines/totals/party + the stage label of the
//     moment), so the approved estimate / final invoice reprints unchanged.
//
// Tenant-scoped via withTenant() — a caller that forgets it sees nothing (FORCE
// RLS). Party display prefers the document's denormalized billTo/shipTo JSON (the
// frozen party, §6); when the author hasn't set it, it falls back to the live
// customer / B2B account record.

import { withTenant } from '@sparx/db';
import type { Prisma } from '@sparx/db';

import type { ServiceContext } from '../errors';
import { CrmNotFoundError } from '../errors';
import type {
  BillingRenderData,
  BillingRenderLine,
  BillingRenderParty,
  BillingRenderPaymentRow,
  BillingRenderTotals,
} from './billing-document-html';
import type { BillingSnapshotPayload } from './billing-snapshot';

const PAYMENT_KIND_LABEL: Record<string, string> = {
  deposit: 'Deposit',
  payment: 'Payment',
  refund: 'Refund',
};

// ── Party display ────────────────────────────────────────────────────────────

/** Flatten an author-set billTo/shipTo JSON blob into a display block. Tolerant:
 *  accepts a `name`/`company` plus either a pre-split `lines`/`addressLines`
 *  array or the common discrete address fields. */
function partyFromJson(json: unknown, heading: string): BillingRenderParty | null {
  if (json === null || typeof json !== 'object') return null;
  const o = json as Record<string, unknown>;
  const s = (k: string): string => {
    const v = o[k];
    return typeof v === 'string' ? v : '';
  };

  const name = s('name') || s('company') || s('companyName');
  const lines: string[] = [];

  const explicit = o.lines ?? o.addressLines;
  if (Array.isArray(explicit)) {
    for (const l of explicit) if (typeof l === 'string') lines.push(l);
  } else {
    if (s('company') && s('company') !== name) lines.push(s('company'));
    if (s('attention')) lines.push(`Attn: ${s('attention')}`);
    if (s('line1') || s('address1') || s('address')) {
      lines.push(s('line1') || s('address1') || s('address'));
    }
    if (s('line2') || s('address2')) lines.push(s('line2') || s('address2'));
    const cityLine = [s('city'), s('state') || s('region'), s('postalCode') || s('zip')]
      .filter(Boolean)
      .join(', ');
    if (cityLine) lines.push(cityLine);
    if (s('country')) lines.push(s('country'));
    if (s('email')) lines.push(s('email'));
    if (s('phone')) lines.push(s('phone'));
  }

  if (!name && lines.length === 0) return null;
  return { heading, name, lines };
}

/** Resolve the bill-to block: the document's frozen billTo JSON wins; otherwise
 *  derive a minimal block from the live customer / B2B account record. */
async function resolveBillTo(
  tx: Prisma.TransactionClient,
  billToJson: unknown,
  customerId: string | null,
  b2bAccountId: string | null
): Promise<BillingRenderParty | null> {
  const fromJson = partyFromJson(billToJson, 'Bill to');
  if (fromJson) return fromJson;

  if (b2bAccountId) {
    const account = await tx.b2BAccount.findUnique({
      where: { id: b2bAccountId },
      select: { companyName: true, website: true },
    });
    if (account) {
      const lines = [account.website ?? ''].filter(Boolean);
      return { heading: 'Bill to', name: account.companyName, lines };
    }
  }
  if (customerId) {
    const c = await tx.customer.findUnique({
      where: { id: customerId },
      select: { firstName: true, lastName: true, company: true, email: true, phone: true },
    });
    if (c) {
      const name = [c.firstName, c.lastName].filter(Boolean).join(' ').trim() || (c.company ?? '');
      const lines = [c.company && c.company !== name ? c.company : '', c.email ?? '', c.phone ?? '']
        .filter(Boolean)
        .map(String);
      return { heading: 'Bill to', name, lines };
    }
  }
  return null;
}

// ── Mappers ──────────────────────────────────────────────────────────────────

function totalsFrom(t: {
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  taxRate: number;
  shippingTotal: number;
  surchargeTotal: number;
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
        lines: { orderBy: { sortOrder: 'asc' } },
        payments: { orderBy: { receivedAt: 'asc' } },
      },
    });
    if (doc?.deletedAt !== null) throw new CrmNotFoundError('BillingDocument', documentId);

    const typeLabels = await lineTypeLabels(
      tx,
      doc.lines.map((l) => l.lineTypeId)
    );

    const lines: BillingRenderLine[] = doc.lines.map((l) => ({
      typeLabel: l.lineTypeId ? (typeLabels.get(l.lineTypeId) ?? null) : null,
      description: l.description,
      quantity: Number(l.quantity),
      unitPrice: Number(l.unitPrice),
      lineTotal: Number(l.lineTotal),
      taxable: l.taxable,
    }));

    const payments: BillingRenderPaymentRow[] = doc.payments.map((p) => ({
      label: PAYMENT_KIND_LABEL[p.kind] ?? p.kind,
      method: p.method,
      amount: p.kind === 'refund' ? -Number(p.amount) : Number(p.amount),
      receivedAt: p.receivedAt.toISOString(),
    }));

    const billTo = await resolveBillTo(tx, doc.billTo, doc.customerId, doc.b2bAccountId);
    const shipTo = partyFromJson(doc.shipTo, 'Ship to');

    return {
      title: doc.stage.customerLabel,
      number: doc.number,
      status: doc.status,
      currency: doc.currency,
      issuedAt: (doc.finalizedAt ?? doc.createdAt).toISOString(),
      dueAt: doc.dueAt ? doc.dueAt.toISOString() : null,
      validUntil: doc.validUntil ? doc.validUntil.toISOString() : null,
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
    const typeLabels = await lineTypeLabels(
      tx,
      payload.lines.map((l) => l.lineTypeId)
    );

    const lines: BillingRenderLine[] = payload.lines.map((l) => ({
      typeLabel: l.lineTypeId ? (typeLabels.get(l.lineTypeId) ?? null) : null,
      description: l.description,
      quantity: l.quantity,
      unitPrice: l.unitPrice,
      lineTotal: l.lineTotal,
      taxable: l.taxable,
    }));

    const billTo = await resolveBillTo(
      tx,
      payload.party.billTo,
      payload.party.customerId,
      payload.party.b2bAccountId
    );
    const shipTo = partyFromJson(payload.party.shipTo, 'Ship to');

    return {
      title: payload.stage.customerLabel,
      number: snap.documentNumber ?? payload.document.number,
      status: payload.document.status,
      currency: payload.document.currency,
      issuedAt: snap.createdAt.toISOString(),
      dueAt: null,
      validUntil: payload.document.validUntil,
      billTo,
      shipTo,
      lines,
      totals: totalsFrom({ ...payload.document.totals, taxRate: payload.document.taxRate }),
      notes: payload.document.notes,
    };
  });
}

// ── Shared ───────────────────────────────────────────────────────────────────

/** id → label for the line types referenced by a set of lines (one query). */
async function lineTypeLabels(
  tx: Prisma.TransactionClient,
  ids: (string | null)[]
): Promise<Map<string, string>> {
  const unique = [...new Set(ids.filter((id): id is string => id !== null))];
  if (unique.length === 0) return new Map();
  const rows = await tx.billingDocumentLineType.findMany({
    where: { id: { in: unique } },
    select: { id: true, label: true },
  });
  return new Map(rows.map((r) => [r.id, r.label]));
}
