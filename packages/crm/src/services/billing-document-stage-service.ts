// billingDocumentStageService — stage advancement, snapshots, and per-stage
// numbering for authored billing documents (docs/87 §3/§4/§9).
//
// Advancing a document to a new stage runs that stage's configured ENTRY
// EFFECTS, in order:
//   1. numberOnEnter   → allocate the stable per-SITE sequence once (docs/131
//      §3.6), then (re)format the visible number with this stage's prefix
//      (EST-… → INV-…).
//   2. final / void     → stamp finalizedAt / voidedAt + AR status, and FREEZE
//      the issuer identity onto the document.
//   3. snapshotOnEnter  → freeze an immutable BillingDocumentSnapshot of the
//      document exactly as it stands (lines + totals + party), AFTER numbering
//      so the frozen copy carries the right number.
//   4. locksEditing     → enforced in billing-line-service / header update; the
//      frozen snapshot is what preserves the approved/final state regardless.
//
// `applyStageEntryEffects` is exported so document CREATE can run the initial
// stage's effects too (the default single-stage Invoice mints its INV- number on
// create, §9). Snapshots are append-only — a void/correction adds a new row, it
// never rewrites one.

import { AdvanceBillingDocumentInput } from '@sparx/crm-schemas';
import { withTenant } from '@sparx/db';
import type { BillingDocument, BillingDocumentSnapshot, DocumentStage, Prisma } from '@sparx/db';

import { writeAuditLog } from '../audit';
import { publishCrmEvent, type CrmTopic } from '../events';
import type { ServiceContext } from '../errors';
import { CrmNotFoundError, CrmValidationError } from '../errors';
import { netTermsDays } from './billing-ar';
import { buildSnapshotPayload } from './billing-snapshot';
import type { DocumentWithLines } from './billing-document-service';
import { formatBillingNumber, nextBillingDocumentSeq } from './record-numbers';

// Fallback when a stage is configured `numberOnEnter` without a prefix — the
// universal invoice prefix. Seeded workflows always set one; this only guards a
// hand-edited stage.
const DEFAULT_NUMBER_PREFIX = 'INV-';

/**
 * The seller block, frozen onto a document at finalize (docs/131 §3.6).
 *
 * Carries BOTH names on purpose. `siteName` is the trading name the customer
 * recognises — the business they think they bought from — while `legalName` and
 * `taxId` identify the entity that is actually liable, and on a multi-brand
 * tenant those are different strings. A document that prints only one of them is
 * either unrecognisable to the customer or unusable to the tax authority.
 *
 * `taxId` is included ONLY when the entity is registered: printing a VAT number
 * a business does not have is a misrepresentation, and `taxRegistered` exists
 * precisely to gate it.
 */
async function snapshotIssuer(
  tx: Prisma.TransactionClient,
  tenantId: string,
  propertyId: string
): Promise<Prisma.InputJsonValue> {
  const [site, business, tenant] = await Promise.all([
    tx.property.findUnique({ where: { id: propertyId }, select: { name: true } }),
    tx.tenantBusiness.findUnique({ where: { tenantId } }),
    tx.tenant.findUnique({ where: { id: tenantId }, select: { name: true } }),
  ]);
  return {
    siteName: site?.name ?? business?.businessName ?? tenant?.name ?? '',
    legalName: business?.businessName ?? tenant?.name ?? '',
    entityType: business?.entityType ?? null,
    registrationNumber: business?.registrationNumber ?? null,
    taxId: business?.taxRegistered ? (business.taxId ?? null) : null,
    phone: business?.phone ?? null,
    supportEmail: business?.supportEmail ?? null,
    address: {
      line1: business?.addressLine1 ?? null,
      line2: business?.addressLine2 ?? null,
      city: business?.city ?? null,
      region: business?.region ?? null,
      postalCode: business?.postalCode ?? null,
      country: business?.country ?? null,
    },
  };
}

interface PendingDocEvent {
  topic: CrmTopic;
  payload: Record<string, unknown>;
  dedupeKey: string;
}

// ─────────────────────────────────────────────────────────────────────────
// Stage advancement
// ─────────────────────────────────────────────────────────────────────────

export async function advance(
  ctx: ServiceContext,
  documentId: string,
  rawInput: unknown
): Promise<DocumentWithLines> {
  const input = AdvanceBillingDocumentInput.parse(rawInput);
  const events = await withTenant(ctx, async (tx) => {
    const doc = await tx.billingDocument.findUnique({ where: { id: documentId } });
    if (doc?.deletedAt !== null) throw new CrmNotFoundError('BillingDocument', documentId);

    const target = await tx.documentStage.findUnique({ where: { id: input.stageId } });
    if (!target) throw new CrmNotFoundError('DocumentStage', input.stageId);
    // A stage from another workflow is not a valid destination for this document.
    if (target.workflowId !== doc.workflowId) {
      throw new CrmNotFoundError('DocumentStage', input.stageId);
    }
    if (target.id === doc.stageId) {
      throw new CrmValidationError('Document is already at this stage.');
    }
    const fromStageId = doc.stageId;

    // Move first, then re-load so entry effects observe the new stage.
    const moved = await tx.billingDocument.update({
      where: { id: documentId },
      data: { stageId: target.id },
    });
    const { document: afterEffects, events: entryEvents } = await applyStageEntryEffects(
      tx,
      ctx,
      moved,
      target
    );

    await writeAuditLog({
      tx,
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      actorType: ctx.userId ? 'user' : 'system',
      action: 'invoicing.document.stage_changed',
      entityType: 'BillingDocument',
      entityId: documentId,
      diff: { before: { stageId: fromStageId }, after: { stageId: target.id } },
    });

    const stageChanged: PendingDocEvent = {
      topic: 'crm.billing_document.stage_changed',
      payload: {
        ...docEventPayload(afterEffects),
        fromStageId,
        toStageId: target.id,
        stageType: target.stageType,
      },
      dedupeKey: `crm.billing_document.stage_changed:${documentId}:${target.id}`,
    };
    return [stageChanged, ...entryEvents];
  });

  // Publish post-commit (the bridge tees crm.* to automation + webhooks).
  for (const e of events) {
    await publishCrmEvent({
      tenantId: ctx.tenantId,
      topic: e.topic,
      payload: e.payload,
      dedupeKey: e.dedupeKey,
    });
  }
  return loadDocumentWithLines(ctx, documentId);
}

/** Apply a stage's entry effects (numbering, lifecycle timestamps, snapshot)
 *  inside the caller's transaction. Returns the updated document plus the
 *  lifecycle events (finalized/voided) the caller publishes post-commit. Shared
 *  by `advance` and document CREATE so the initial stage is treated identically
 *  to any later transition. */
export async function applyStageEntryEffects(
  tx: Prisma.TransactionClient,
  ctx: ServiceContext,
  document: BillingDocument,
  stage: DocumentStage
): Promise<{ document: BillingDocument; events: PendingDocEvent[] }> {
  const events: PendingDocEvent[] = [];
  const data: Prisma.BillingDocumentUpdateInput = {};

  // 1. Numbering — allocate the stable sequence once; later stages only swap the
  //    prefix while keeping the suffix (EST-000123 → INV-000123).
  if (stage.numberOnEnter) {
    let seq = document.numberSeq;
    if (seq === null) {
      // The ISSUING site's sequence (docs/131 §3.6), read off the document
      // itself — never re-resolved from the request, because a document numbered
      // while the operator happened to have another site selected would take a
      // number out of the wrong business's books.
      seq = await nextBillingDocumentSeq(tx, ctx.tenantId, document.propertyId);
      data.numberSeq = seq;
    }
    data.number = formatBillingNumber(stage.numberPrefix ?? DEFAULT_NUMBER_PREFIX, seq);
  }

  // 2. Lifecycle timestamps + AR status driven by the semantic stage type.
  const enteringFinal = stage.stageType === 'final' && document.finalizedAt === null;
  if (enteringFinal) {
    const finalizedAt = new Date();
    data.finalizedAt = finalizedAt;
    // Freeze WHO ISSUED this (docs/131 §3.6, docs/130 §2.7). billTo/shipTo were
    // already snapshotted here and the seller was not, so renaming a site — or
    // editing the legal entity's address — silently rewrote the letterhead on
    // invoices already in customers' hands. Finalize is the right moment: it is
    // the point the document stops being editable.
    if (document.issuedBy === null) {
      data.issuedBy = await snapshotIssuer(tx, ctx.tenantId, document.propertyId);
    }
    // Net-terms B2B documents get a due date from the account's terms on finalize
    // (§8). Retail / already-dated documents keep their dueAt.
    if (document.companyId && document.dueAt === null) {
      const account = await tx.company.findUnique({
        where: { id: document.companyId },
        select: { paymentTerms: true },
      });
      const days = netTermsDays(account?.paymentTerms);
      if (days > 0) {
        const due = new Date(finalizedAt);
        due.setUTCDate(due.getUTCDate() + days);
        data.dueAt = due;
      }
    }
  }
  if (stage.stageType === 'void') {
    data.voidedAt = document.voidedAt ?? new Date();
    data.status = 'void';
  }

  let updated = document;
  if (Object.keys(data).length > 0) {
    updated = await tx.billingDocument.update({ where: { id: document.id }, data });
  }

  // 3. Snapshot AFTER numbering, so the frozen copy carries the right number.
  if (stage.snapshotOnEnter) {
    await freezeSnapshot(tx, ctx, updated, stage);
  }

  // 4. Lifecycle events (collected for the caller to publish post-commit).
  if (enteringFinal) {
    events.push({
      topic: 'crm.billing_document.finalized',
      payload: docEventPayload(updated),
      dedupeKey: `crm.billing_document.finalized:${updated.id}`,
    });
  }
  if (stage.stageType === 'void') {
    events.push({
      topic: 'crm.billing_document.voided',
      payload: docEventPayload(updated),
      dedupeKey: `crm.billing_document.voided:${updated.id}`,
    });
  }
  return { document: updated, events };
}

// ─────────────────────────────────────────────────────────────────────────
// Snapshots (append-only history)
// ─────────────────────────────────────────────────────────────────────────

export async function listSnapshots(
  ctx: ServiceContext,
  documentId: string
): Promise<BillingDocumentSnapshot[]> {
  return withTenant(ctx, async (tx) => {
    const doc = await tx.billingDocument.findUnique({ where: { id: documentId } });
    if (!doc) throw new CrmNotFoundError('BillingDocument', documentId);
    return tx.billingDocumentSnapshot.findMany({
      where: { documentId },
      orderBy: { createdAt: 'desc' },
    });
  });
}

export async function getSnapshot(
  ctx: ServiceContext,
  snapshotId: string
): Promise<BillingDocumentSnapshot> {
  const snap = await withTenant(ctx, (tx) =>
    tx.billingDocumentSnapshot.findUnique({ where: { id: snapshotId } })
  );
  if (!snap) throw new CrmNotFoundError('BillingDocumentSnapshot', snapshotId);
  return snap;
}

// ─────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────

/** Freeze an immutable snapshot of the document + its lines at this stage. */
async function freezeSnapshot(
  tx: Prisma.TransactionClient,
  ctx: ServiceContext,
  document: BillingDocument,
  stage: DocumentStage
): Promise<BillingDocumentSnapshot> {
  const lines = await tx.billingDocumentLine.findMany({
    where: { documentId: document.id },
    orderBy: { sortOrder: 'asc' },
  });
  const payload = buildSnapshotPayload(document, lines, stage);
  const snapshot = await tx.billingDocumentSnapshot.create({
    data: {
      tenantId: ctx.tenantId,
      documentId: document.id,
      stageId: stage.id,
      stageType: stage.stageType,
      customerLabel: stage.customerLabel,
      documentNumber: document.number,
      snapshot: payload as unknown as Prisma.InputJsonValue,
      createdById: ctx.userId ?? null,
    },
  });
  await writeAuditLog({
    tx,
    tenantId: ctx.tenantId,
    actorId: ctx.userId ?? null,
    actorType: ctx.userId ? 'user' : 'system',
    action: 'invoicing.document.snapshot_frozen',
    entityType: 'BillingDocumentSnapshot',
    entityId: snapshot.id,
    diff: { after: { stageId: stage.id, documentNumber: document.number } },
  });
  return snapshot;
}

function docEventPayload(doc: BillingDocument): Record<string, unknown> {
  return {
    documentId: doc.id,
    number: doc.number,
    customerId: doc.customerId,
    companyId: doc.companyId,
    stageId: doc.stageId,
    total: Number(doc.total),
    currency: doc.currency,
  };
}

async function loadDocumentWithLines(
  ctx: ServiceContext,
  documentId: string
): Promise<DocumentWithLines> {
  return withTenant(ctx, (tx) =>
    tx.billingDocument.findUniqueOrThrow({
      where: { id: documentId },
      include: { lines: { orderBy: { sortOrder: 'asc' } } },
    })
  );
}
