// billingLineService — add / update / remove lines on a billing document
// (docs/87 §5). Each write resolves the line's type (→ pricingMode + tax
// default), prices it via billing-line-pricing, recomputes the line's tax
// against the document's rate, and recomputes the document totals. Writes are
// blocked when the document sits on an edit-locking stage.

import { AddBillingLineInput, UpdateBillingLineInput } from '@sparx/crm-schemas';
import { LineMarkupInput, type LineMarkupInput as LineMarkupInputType } from '@sparx/commerce-schemas';
import { Prisma, withTenant } from '@sparx/db';
import type { BillingDocumentLineType } from '@sparx/db';

import { writeAuditLog } from '../audit';
import type { ServiceContext } from '../errors';
import { CrmNotFoundError, CrmValidationError } from '../errors';
import { priceBillingLine, type BillingPricingMode } from './billing-line-pricing';
import { computeBillingLine } from './billing-totals';
import { type DocumentWithLines, recomputeTotals } from './billing-document-service';

export async function addLine(
  ctx: ServiceContext,
  documentId: string,
  rawInput: unknown
): Promise<DocumentWithLines> {
  const input = AddBillingLineInput.parse(rawInput);
  const markup = parseMarkup(rawInput);
  return withTenant(ctx, async (tx) => {
    const doc = await loadEditableDocument(tx, documentId);
    const lineType = await resolveLineType(tx, ctx.tenantId, input.lineTypeId, input.lineTypeKey);
    const pricingMode: BillingPricingMode = (lineType?.pricingMode as BillingPricingMode) ?? 'flat';
    const directive = markup ?? defaultMarkup(lineType, pricingMode);

    const priced = await priceBillingLine(tx, ctx.tenantId, {
      pricingMode,
      variantId: input.variantId ?? null,
      explicitCostCents: input.explicitCostCents ?? null,
      unitPrice: input.unitPrice ?? null,
      markup: directive,
    });
    const taxable = input.taxable ?? lineType?.defaultTaxable ?? true;
    const computed = computeBillingLine(
      { quantity: input.quantity, unitPrice: priced.unitPrice, discountAmount: input.discountAmount, taxable },
      Number(doc.taxRate)
    );
    const sortOrder = input.sortOrder ?? (await nextSortOrder(tx, documentId));

    const line = await tx.billingDocumentLine.create({
      data: {
        tenantId: ctx.tenantId,
        documentId,
        lineTypeId: lineType?.id ?? null,
        productId: input.productId ?? null,
        variantId: input.variantId ?? null,
        technicianUserId: input.technicianUserId ?? null,
        description: input.description,
        quantity: input.quantity,
        unitPrice: priced.unitPrice,
        costCents: priced.costCents,
        appliedMarkup: (priced.appliedMarkup ?? null) as Prisma.InputJsonValue,
        taxable,
        discountAmount: computed.discountAmount,
        taxAmount: computed.taxAmount,
        lineSubtotal: computed.lineSubtotal,
        lineTotal: computed.lineTotal,
        sortOrder,
        metadata: (input.metadata ?? {}) as Prisma.InputJsonValue,
      },
    });
    await writeAuditLog({
      tx,
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      actorType: ctx.userId ? 'user' : 'system',
      action: 'invoicing.line.added',
      entityType: 'BillingDocumentLine',
      entityId: line.id,
      diff: { after: { description: line.description, pricingMode } },
    });
    await recomputeTotals(tx, ctx.tenantId, documentId);
    return loadWithLines(tx, documentId);
  });
}

export async function updateLine(
  ctx: ServiceContext,
  lineId: string,
  rawInput: unknown
): Promise<DocumentWithLines> {
  const input = UpdateBillingLineInput.parse(rawInput);
  const markup = parseMarkup(rawInput);
  return withTenant(ctx, async (tx) => {
    const existing = await tx.billingDocumentLine.findUnique({ where: { id: lineId } });
    if (!existing) throw new CrmNotFoundError('BillingDocumentLine', lineId);
    const doc = await loadEditableDocument(tx, existing.documentId);

    // Re-resolve the line type only if the caller changed it.
    const lineType =
      input.lineTypeId !== undefined || input.lineTypeKey !== undefined
        ? await resolveLineType(tx, ctx.tenantId, input.lineTypeId, input.lineTypeKey)
        : existing.lineTypeId
          ? await tx.billingDocumentLineType.findUnique({ where: { id: existing.lineTypeId } })
          : null;

    // Re-price only when a pricing-affecting field changed; otherwise keep the
    // existing unit price + cost snapshot (a pure quantity/discount edit must
    // not silently re-fetch cost).
    const repriceNeeded =
      markup != null ||
      input.unitPrice !== undefined ||
      input.variantId !== undefined ||
      input.explicitCostCents !== undefined ||
      input.lineTypeId !== undefined ||
      input.lineTypeKey !== undefined;

    let unitPrice = Number(existing.unitPrice);
    let costCents = existing.costCents;
    let appliedMarkup = existing.appliedMarkup as Prisma.InputJsonValue | null;

    if (repriceNeeded) {
      const pricingMode: BillingPricingMode = (lineType?.pricingMode as BillingPricingMode) ?? 'flat';
      const directive = markup ?? defaultMarkup(lineType, pricingMode);
      const priced = await priceBillingLine(tx, ctx.tenantId, {
        pricingMode,
        variantId: input.variantId !== undefined ? input.variantId : existing.variantId,
        explicitCostCents: input.explicitCostCents ?? null,
        unitPrice: input.unitPrice !== undefined ? input.unitPrice : Number(existing.unitPrice),
        markup: directive,
      });
      unitPrice = priced.unitPrice;
      costCents = priced.costCents;
      appliedMarkup = (priced.appliedMarkup ?? null);
    }

    const quantity = input.quantity ?? Number(existing.quantity);
    const taxable = input.taxable ?? existing.taxable;
    const discountAmount = input.discountAmount ?? Number(existing.discountAmount);
    const computed = computeBillingLine({ quantity, unitPrice, discountAmount, taxable }, Number(doc.taxRate));

    await tx.billingDocumentLine.update({
      where: { id: lineId },
      data: {
        ...(lineType !== null || input.lineTypeId !== undefined || input.lineTypeKey !== undefined
          ? { lineTypeId: lineType?.id ?? null }
          : {}),
        ...(input.productId !== undefined ? { productId: input.productId } : {}),
        ...(input.variantId !== undefined ? { variantId: input.variantId } : {}),
        ...(input.technicianUserId !== undefined ? { technicianUserId: input.technicianUserId } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
        ...(input.metadata !== undefined ? { metadata: input.metadata as Prisma.InputJsonValue } : {}),
        quantity,
        unitPrice,
        costCents,
        appliedMarkup: appliedMarkup ?? Prisma.DbNull,
        taxable,
        discountAmount: computed.discountAmount,
        taxAmount: computed.taxAmount,
        lineSubtotal: computed.lineSubtotal,
        lineTotal: computed.lineTotal,
      },
    });
    await writeAuditLog({
      tx,
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      actorType: ctx.userId ? 'user' : 'system',
      action: 'invoicing.line.updated',
      entityType: 'BillingDocumentLine',
      entityId: lineId,
      diff: null,
    });
    await recomputeTotals(tx, ctx.tenantId, existing.documentId);
    return loadWithLines(tx, existing.documentId);
  });
}

export async function removeLine(ctx: ServiceContext, lineId: string): Promise<DocumentWithLines> {
  return withTenant(ctx, async (tx) => {
    const existing = await tx.billingDocumentLine.findUnique({ where: { id: lineId } });
    if (!existing) throw new CrmNotFoundError('BillingDocumentLine', lineId);
    await loadEditableDocument(tx, existing.documentId);
    await tx.billingDocumentLine.delete({ where: { id: lineId } });
    await writeAuditLog({
      tx,
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      actorType: ctx.userId ? 'user' : 'system',
      action: 'invoicing.line.removed',
      entityType: 'BillingDocumentLine',
      entityId: lineId,
      diff: { before: { description: existing.description } },
    });
    await recomputeTotals(tx, ctx.tenantId, existing.documentId);
    return loadWithLines(tx, existing.documentId);
  });
}

// ─────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────

/** Load a document + its current stage, throwing if missing/deleted or if the
 *  stage locks editing (docs/87 §3 `locksEditing`). */
async function loadEditableDocument(tx: Prisma.TransactionClient, documentId: string) {
  const doc = await tx.billingDocument.findUnique({
    where: { id: documentId },
    include: { stage: true },
  });
  if (doc?.deletedAt !== null) throw new CrmNotFoundError('BillingDocument', documentId);
  if (doc.stage.locksEditing) {
    throw new CrmValidationError('This document is locked for editing at its current stage.');
  }
  return doc;
}

async function resolveLineType(
  tx: Prisma.TransactionClient,
  tenantId: string,
  lineTypeId: string | null | undefined,
  lineTypeKey: string | undefined
): Promise<BillingDocumentLineType | null> {
  if (lineTypeId) {
    const byId = await tx.billingDocumentLineType.findUnique({ where: { id: lineTypeId } });
    if (!byId) throw new CrmNotFoundError('BillingDocumentLineType', lineTypeId);
    return byId;
  }
  if (lineTypeKey) {
    const byKey = await tx.billingDocumentLineType.findUnique({
      where: { tenantId_key: { tenantId, key: lineTypeKey } },
    });
    if (!byKey) throw new CrmNotFoundError('BillingDocumentLineType', lineTypeKey);
    return byKey;
  }
  return null;
}

/** A markup-mode line with no explicit directive falls back to its line type's
 *  default markup rule, when one is configured. */
function defaultMarkup(
  lineType: BillingDocumentLineType | null,
  pricingMode: BillingPricingMode
): LineMarkupInputType | null {
  if (pricingMode !== 'markup' && pricingMode !== 'pass_through') return null;
  if (!lineType?.defaultMarkupRuleId) return null;
  return { kind: 'rule', ruleId: lineType.defaultMarkupRuleId };
}

function parseMarkup(raw: unknown): LineMarkupInputType | null {
  const value = (raw as Record<string, unknown> | null)?.markup;
  return value == null ? null : LineMarkupInput.parse(value);
}

async function nextSortOrder(tx: Prisma.TransactionClient, documentId: string): Promise<number> {
  const last = await tx.billingDocumentLine.findFirst({
    where: { documentId },
    orderBy: { sortOrder: 'desc' },
    select: { sortOrder: true },
  });
  return (last?.sortOrder ?? -1) + 1;
}

async function loadWithLines(
  tx: Prisma.TransactionClient,
  documentId: string
): Promise<DocumentWithLines> {
  return tx.billingDocument.findUniqueOrThrow({
    where: { id: documentId },
    include: { lines: { orderBy: { sortOrder: 'asc' } } },
  });
}
