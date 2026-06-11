// billingPaymentService — record deposits / payments / refunds against a billing
// document (docs/87 §8). Append-only: a correction is a new `refund` row, never
// an edit or delete. The document's amountPaid / depositTotal / balance / status
// are re-derived from the payment rows by `recomputeTotals` after every write.
// Emits crm.billing_document.paid the first time the balance clears.
//
// Payments are allowed on a LOCKED (final/paid) document — locking freezes the
// LINES, not the act of paying a finalized invoice.

import { RecordBillingPaymentInput } from '@sparx/crm-schemas';
import { withTenant } from '@sparx/db';
import type { BillingDocumentPayment } from '@sparx/db';

import { writeAuditLog } from '../audit';
import { publishCrmEvent } from '../events';
import type { ServiceContext } from '../errors';
import { CrmNotFoundError } from '../errors';
import { recomputeTotals, type DocumentWithLines } from './billing-document-service';

export async function listPayments(
  ctx: ServiceContext,
  documentId: string
): Promise<BillingDocumentPayment[]> {
  return withTenant(ctx, async (tx) => {
    const doc = await tx.billingDocument.findUnique({ where: { id: documentId } });
    if (!doc) throw new CrmNotFoundError('BillingDocument', documentId);
    return tx.billingDocumentPayment.findMany({
      where: { documentId },
      orderBy: { receivedAt: 'desc' },
    });
  });
}

export async function recordPayment(
  ctx: ServiceContext,
  documentId: string,
  rawInput: unknown
): Promise<{ document: DocumentWithLines; payment: BillingDocumentPayment }> {
  const input = RecordBillingPaymentInput.parse(rawInput);
  const result = await withTenant(ctx, async (tx) => {
    const before = await tx.billingDocument.findUnique({ where: { id: documentId } });
    if (before?.deletedAt !== null) throw new CrmNotFoundError('BillingDocument', documentId);

    const payment = await tx.billingDocumentPayment.create({
      data: {
        tenantId: ctx.tenantId,
        documentId,
        kind: input.kind,
        method: input.method,
        amount: input.amount,
        reference: input.reference ?? null,
        providerRef: input.providerRef ?? null,
        note: input.note ?? null,
        receivedAt: input.receivedAt ? new Date(input.receivedAt) : new Date(),
        recordedById: ctx.userId ?? null,
      },
    });
    // Re-derive amountPaid / balance / status from the full payment set.
    const recomputed = await recomputeTotals(tx, ctx.tenantId, documentId);
    await writeAuditLog({
      tx,
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      actorType: ctx.userId ? 'user' : 'system',
      action: `invoicing.payment.${input.kind}`,
      entityType: 'BillingDocumentPayment',
      entityId: payment.id,
      diff: { after: { kind: input.kind, method: input.method, amount: input.amount } },
    });
    const document = await tx.billingDocument.findUniqueOrThrow({
      where: { id: documentId },
      include: { lines: { orderBy: { sortOrder: 'asc' } } },
    });
    return {
      document,
      payment,
      becamePaid: before.status !== 'paid' && recomputed.status === 'paid',
    };
  });

  if (result.becamePaid) {
    await publishCrmEvent({
      tenantId: ctx.tenantId,
      topic: 'crm.billing_document.paid',
      payload: {
        documentId: result.document.id,
        number: result.document.number,
        customerId: result.document.customerId,
        b2bAccountId: result.document.b2bAccountId,
        total: Number(result.document.total),
        currency: result.document.currency,
      },
      dedupeKey: `crm.billing_document.paid:${result.document.id}`,
    });
  }
  return { document: result.document, payment: result.payment };
}
