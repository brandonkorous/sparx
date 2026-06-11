// billingDocumentService — authored billing documents (docs/87 §2/§6/§7).
//
// Document header CRUD + total recomputation. Line add/update/remove (and the
// per-line pricing that feeds totals) live in billing-line-service.ts so each
// file stays focused; both share `recomputeTotals` here. A document bills a
// retail Customer OR a B2BAccount (the Deal pattern) and sits on a workflow at a
// stage. Totals derive from the lines + the document's taxRate/shipping/surcharge.

import {
  CreateBillingDocumentInput,
  ListBillingDocumentsInput,
  UpdateBillingDocumentInput,
} from '@sparx/crm-schemas';
import { withTenant } from '@sparx/db';
import type { BillingDocument, BillingDocumentLine, Prisma } from '@sparx/db';

import { writeAuditLog } from '../audit';
import { publishCrmEvent, type CrmTopic } from '../events';
import type { ServiceContext } from '../errors';
import { CrmNotFoundError, CrmValidationError } from '../errors';
import { aggregatePayments, deriveDocumentStatus } from './billing-ar';
import { applyStageEntryEffects } from './billing-document-stage-service';
import { computeBillingTotals } from './billing-totals';

interface PendingDocEvent {
  topic: CrmTopic;
  payload: Record<string, unknown>;
  dedupeKey: string;
}

export interface DocumentWithLines extends BillingDocument {
  lines: BillingDocumentLine[];
}

// ─────────────────────────────────────────────────────────────────────────
// Reads
// ─────────────────────────────────────────────────────────────────────────

export async function list(
  ctx: ServiceContext,
  rawFilter: unknown = {}
): Promise<{ items: BillingDocument[]; total: number }> {
  const filter = ListBillingDocumentsInput.parse(rawFilter);
  return withTenant(ctx, async (tx) => {
    const where: Prisma.BillingDocumentWhereInput = {
      ...(filter.includeDeleted ? {} : { deletedAt: null }),
      ...(filter.workflowId ? { workflowId: filter.workflowId } : {}),
      ...(filter.stageId ? { stageId: filter.stageId } : {}),
      ...(filter.customerId ? { customerId: filter.customerId } : {}),
      ...(filter.b2bAccountId ? { b2bAccountId: filter.b2bAccountId } : {}),
      ...(filter.status ? { status: filter.status } : {}),
    };
    const [items, total] = await Promise.all([
      tx.billingDocument.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        take: filter.limit,
        skip: filter.offset,
      }),
      tx.billingDocument.count({ where }),
    ]);
    return { items, total };
  });
}

export async function get(ctx: ServiceContext, documentId: string): Promise<DocumentWithLines> {
  const doc = await withTenant(ctx, (tx) =>
    tx.billingDocument.findUnique({
      where: { id: documentId },
      include: { lines: { orderBy: { sortOrder: 'asc' } } },
    })
  );
  if (doc?.deletedAt !== null) throw new CrmNotFoundError('BillingDocument', documentId);
  return doc;
}

// ─────────────────────────────────────────────────────────────────────────
// Writes
// ─────────────────────────────────────────────────────────────────────────

export async function create(ctx: ServiceContext, rawInput: unknown): Promise<DocumentWithLines> {
  const input = CreateBillingDocumentInput.parse(rawInput);
  const { document, events } = await withTenant(ctx, async (tx) => {
    const workflow = await tx.documentWorkflow.findUnique({
      where: { id: input.workflowId },
      include: { stages: { orderBy: { sortOrder: 'asc' } } },
    });
    if (workflow?.archivedAt !== null) {
      throw new CrmNotFoundError('DocumentWorkflow', input.workflowId);
    }
    if (workflow.stages.length === 0) {
      throw new CrmValidationError(
        'This workflow has no stages — add a stage before creating a document.'
      );
    }
    // Resolve the starting stage: the one supplied (must belong to the workflow)
    // or the workflow's first stage.
    const stage = input.stageId
      ? workflow.stages.find((s) => s.id === input.stageId)
      : workflow.stages[0];
    if (!stage) throw new CrmNotFoundError('DocumentStage', input.stageId ?? '(first)');

    await assertPartyExists(tx, input.customerId ?? null, input.b2bAccountId ?? null);

    const created = await tx.billingDocument.create({
      data: {
        tenantId: ctx.tenantId,
        workflowId: workflow.id,
        stageId: stage.id,
        customerId: input.customerId ?? null,
        b2bAccountId: input.b2bAccountId ?? null,
        assignedUserId: input.assignedUserId ?? null,
        currency: input.currency,
        taxRate: input.taxRate,
        billTo: (input.billTo ?? null) as Prisma.InputJsonValue,
        shipTo: (input.shipTo ?? null) as Prisma.InputJsonValue,
        shippingTotal: input.shippingTotal,
        surchargeTotal: input.surchargeTotal,
        notes: input.notes ?? null,
        validUntil: input.validUntil ? new Date(input.validUntil) : null,
        dueAt: input.dueAt ? new Date(input.dueAt) : null,
        metadata: (input.metadata ?? {}) as Prisma.InputJsonValue,
      },
    });
    // Run the starting stage's entry effects — the default single-stage Invoice
    // mints its INV- number on create (§9); a snapshot-on-enter first stage would
    // freeze here too. Treated identically to any later transition.
    const { events: entryEvents } = await applyStageEntryEffects(tx, ctx, created, stage);

    await writeAuditLog({
      tx,
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      actorType: ctx.userId ? 'user' : 'system',
      action: 'invoicing.document.created',
      entityType: 'BillingDocument',
      entityId: created.id,
      diff: { after: { workflowId: workflow.id, stageId: stage.id } },
    });

    const withLines = await tx.billingDocument.findUniqueOrThrow({
      where: { id: created.id },
      include: { lines: { orderBy: { sortOrder: 'asc' } } },
    });
    const createdEvent: PendingDocEvent = {
      topic: 'crm.billing_document.created',
      payload: {
        documentId: withLines.id,
        number: withLines.number,
        customerId: withLines.customerId,
        b2bAccountId: withLines.b2bAccountId,
        workflowId: withLines.workflowId,
        stageId: withLines.stageId,
        currency: withLines.currency,
      },
      dedupeKey: `crm.billing_document.created:${withLines.id}`,
    };
    return { document: withLines, events: [createdEvent, ...entryEvents] };
  });

  for (const e of events) {
    await publishCrmEvent({
      tenantId: ctx.tenantId,
      topic: e.topic,
      payload: e.payload,
      dedupeKey: e.dedupeKey,
    });
  }
  return document;
}

export async function update(
  ctx: ServiceContext,
  documentId: string,
  rawInput: unknown
): Promise<DocumentWithLines> {
  const input = UpdateBillingDocumentInput.parse(rawInput);
  return withTenant(ctx, async (tx) => {
    const before = await tx.billingDocument.findUnique({
      where: { id: documentId },
      include: { stage: true },
    });
    if (before?.deletedAt !== null) throw new CrmNotFoundError('BillingDocument', documentId);
    // A locked stage (final/paid) freezes the header too — taxRate/shipping edits
    // would otherwise diverge the live totals from the frozen snapshot.
    if (before.stage.locksEditing) {
      throw new CrmValidationError('This document is locked for editing at its current stage.');
    }

    if (input.customerId !== undefined || input.b2bAccountId !== undefined) {
      const customerId = input.customerId !== undefined ? input.customerId : before.customerId;
      const b2bAccountId =
        input.b2bAccountId !== undefined ? input.b2bAccountId : before.b2bAccountId;
      if (!customerId && !b2bAccountId) {
        throw new CrmValidationError('A billing document must bill a customer or a B2B account.');
      }
      await assertPartyExists(tx, customerId, b2bAccountId);
    }

    await tx.billingDocument.update({
      where: { id: documentId },
      data: {
        ...(input.customerId !== undefined ? { customerId: input.customerId } : {}),
        ...(input.b2bAccountId !== undefined ? { b2bAccountId: input.b2bAccountId } : {}),
        ...(input.assignedUserId !== undefined ? { assignedUserId: input.assignedUserId } : {}),
        ...(input.currency !== undefined ? { currency: input.currency } : {}),
        ...(input.taxRate !== undefined ? { taxRate: input.taxRate } : {}),
        ...(input.billTo !== undefined
          ? { billTo: (input.billTo ?? null) as Prisma.InputJsonValue }
          : {}),
        ...(input.shipTo !== undefined
          ? { shipTo: (input.shipTo ?? null) as Prisma.InputJsonValue }
          : {}),
        ...(input.shippingTotal !== undefined ? { shippingTotal: input.shippingTotal } : {}),
        ...(input.surchargeTotal !== undefined ? { surchargeTotal: input.surchargeTotal } : {}),
        ...(input.notes !== undefined ? { notes: input.notes } : {}),
        ...(input.validUntil !== undefined
          ? { validUntil: input.validUntil ? new Date(input.validUntil) : null }
          : {}),
        ...(input.dueAt !== undefined
          ? { dueAt: input.dueAt ? new Date(input.dueAt) : null }
          : {}),
        ...(input.metadata !== undefined
          ? { metadata: input.metadata as Prisma.InputJsonValue }
          : {}),
      },
    });
    await writeAuditLog({
      tx,
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      actorType: ctx.userId ? 'user' : 'system',
      action: 'invoicing.document.updated',
      entityType: 'BillingDocument',
      entityId: documentId,
      diff: null,
    });
    // taxRate / shipping / surcharge feed totals — recompute after a header edit.
    const doc = await recomputeTotals(tx, ctx.tenantId, documentId);
    return tx.billingDocument.findUniqueOrThrow({
      where: { id: doc.id },
      include: { lines: { orderBy: { sortOrder: 'asc' } } },
    });
  });
}

/** Soft-delete a document (deletedAt). Destructive — the dashboard gates it
 *  behind a confirm. */
export async function remove(ctx: ServiceContext, documentId: string): Promise<{ id: string }> {
  return withTenant(ctx, async (tx) => {
    const before = await tx.billingDocument.findUnique({ where: { id: documentId } });
    if (before?.deletedAt !== null) throw new CrmNotFoundError('BillingDocument', documentId);
    await tx.billingDocument.update({ where: { id: documentId }, data: { deletedAt: new Date() } });
    await writeAuditLog({
      tx,
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      actorType: ctx.userId ? 'user' : 'system',
      action: 'invoicing.document.deleted',
      entityType: 'BillingDocument',
      entityId: documentId,
      diff: { before: { number: before.number } },
    });
    return { id: documentId };
  });
}

// ─────────────────────────────────────────────────────────────────────────
// Shared helpers (used by billing-line-service)
// ─────────────────────────────────────────────────────────────────────────

/** Recompute and persist the full money picture from the document's current
 *  lines (subtotal/tax/total), payment rows (amountPaid/depositTotal), and AR
 *  state (balance/status/paidAt). The single authority for the cached totals —
 *  every line, payment, and header edit funnels through here. Runs inside the
 *  caller's transaction. */
export async function recomputeTotals(
  tx: Prisma.TransactionClient,
  tenantId: string,
  documentId: string
): Promise<BillingDocument> {
  const doc = await tx.billingDocument.findUnique({
    where: { id: documentId },
    include: { lines: true, payments: true },
  });
  if (!doc) throw new CrmNotFoundError('BillingDocument', documentId);

  const totals = computeBillingTotals(
    doc.lines.map((l) => ({
      quantity: Number(l.quantity),
      unitPrice: Number(l.unitPrice),
      discountAmount: Number(l.discountAmount),
      taxable: l.taxable,
    })),
    Number(doc.taxRate),
    Number(doc.shippingTotal),
    Number(doc.surchargeTotal)
  );
  const { amountPaid, depositTotal } = aggregatePayments(
    doc.payments.map((p) => ({ kind: p.kind, amount: Number(p.amount) }))
  );
  const balance = round2(totals.total - amountPaid);
  const now = new Date();
  const status = deriveDocumentStatus({
    total: totals.total,
    amountPaid,
    dueAt: doc.dueAt,
    voided: doc.voidedAt !== null,
    now,
  });
  const paidAt = status === 'paid' ? (doc.paidAt ?? now) : null;

  return tx.billingDocument.update({
    where: { id: documentId },
    data: {
      subtotal: totals.subtotal,
      discountTotal: totals.discountTotal,
      taxTotal: totals.taxTotal,
      total: totals.total,
      amountPaid,
      depositTotal,
      balance,
      status,
      paidAt,
    },
  });
}

/** Throw a clean NOT_FOUND if a referenced party doesn't exist for this tenant,
 *  instead of letting an FK violation surface. */
async function assertPartyExists(
  tx: Prisma.TransactionClient,
  customerId: string | null,
  b2bAccountId: string | null
): Promise<void> {
  if (customerId) {
    const customer = await tx.customer.findUnique({ where: { id: customerId } });
    if (customer?.deletedAt !== null) throw new CrmNotFoundError('Customer', customerId);
  }
  if (b2bAccountId) {
    const account = await tx.b2BAccount.findUnique({ where: { id: b2bAccountId } });
    if (!account) throw new CrmNotFoundError('B2BAccount', b2bAccountId);
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
