// signatureService — e-sign on quotes and estimates (docs/144 §12).
//
// The rendering pipeline already produced a customer-facing document. What it
// could not do was let the customer ACCEPT one — so "approved" was a stage a
// member of staff moved a quote into on the customer's behalf. That is a record
// of a phone call. This is a signature.
//
// THREE THINGS MAKE IT ONE:
//
//   1. THE TOKEN IS NEVER STORED. Only its SHA-256 goes in the row, the same
//      rule the API keys follow. A database dump is then a list of things that
//      were signed, not a set of working signing links.
//   2. THE DOCUMENT IS FROZEN AT SIGNATURE, not at send. What the customer had
//      in front of them when they clicked is what the snapshot holds — so a line
//      edited the next morning cannot retroactively become part of what they
//      agreed to.
//   3. THE STAGE MOVES BECAUSE THEY SIGNED. Signing advances the document to the
//      workflow's first `committed` stage, which is what "customer-approved"
//      means everywhere else in the invoicing module. Without that the signature
//      is a row nobody's process reads.
//
// The public half runs on the tenant's OWN storefront, so the tenant is resolved
// the way every other public route resolves it — from the site the link points
// at — and the token then only has to identify one row inside it. RLS keeps
// doing its job on the signature table instead of needing an escape hatch, and a
// token from one business is not even a candidate key in another's.

import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

import { DeclineDocumentInput, RequestSignatureInput, SignDocumentInput } from '@sparx/crm-schemas';
import { withTenant } from '@sparx/db';
import type { BillingDocumentSignature, Prisma } from '@sparx/db';

import { writeAuditLog } from '../audit';
import { publishCrmEvent } from '../events';
import type { ServiceContext } from '../errors';
import { CrmNotFoundError, CrmValidationError } from '../errors';
import { buildSnapshotPayload } from './billing-snapshot';

/** 32 bytes of urlsafe base64 — 256 bits, the same strength as an API key. */
function mintToken(): { token: string; hash: string } {
  const token = randomBytes(32).toString('base64url');
  return { token, hash: hashToken(token) };
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** Constant-time compare, so a lookup miss and a hash mismatch cost the same. */
function sameHash(a: string, b: string): boolean {
  const left = Buffer.from(a, 'utf8');
  const right = Buffer.from(b, 'utf8');
  return left.length === right.length && timingSafeEqual(left, right);
}

export interface SignatureRequest {
  signature: BillingDocumentSignature;
  /** The only time the raw token exists. Not stored, not logged, not re-issuable. */
  token: string;
  /** Whether the caller asked for the customer to be emailed the link. */
  notify: boolean;
}

/**
 * Ask a customer to sign a document.
 *
 * A second request supersedes the first rather than living alongside it: two
 * live links to the same document means two people can sign it and the second
 * signature attests to a snapshot the first already froze. The old row is
 * revoked, kept, and visible in the history — "we re-sent it" is a fact worth
 * being able to see.
 */
export async function request(
  ctx: ServiceContext,
  documentId: string,
  rawInput: unknown
): Promise<SignatureRequest> {
  const input = RequestSignatureInput.parse(rawInput);
  const { token, hash } = mintToken();

  const signature = await withTenant(ctx, async (tx) => {
    const document = await tx.billingDocument.findUnique({
      where: { id: documentId },
      include: { stage: true },
    });
    if (!document) throw new CrmNotFoundError('BillingDocument', documentId);
    if (document.stage.stageType === 'void') {
      throw new CrmValidationError('That document has been voided — nothing to sign.');
    }
    if (document.stage.locksEditing) {
      throw new CrmValidationError(
        'That document is already final. A signature would come after the fact.'
      );
    }

    await tx.billingDocumentSignature.updateMany({
      where: { documentId, status: 'pending' },
      data: { status: 'revoked' },
    });

    const expiresAt = new Date();
    expiresAt.setUTCDate(expiresAt.getUTCDate() + input.expiresInDays);

    const created = await tx.billingDocumentSignature.create({
      data: {
        tenantId: ctx.tenantId,
        documentId,
        signerName: input.signerName,
        signerEmail: input.signerEmail.toLowerCase(),
        tokenHash: hash,
        expiresAt,
        requestedBy: ctx.userId ?? null,
      },
    });

    await writeAuditLog({
      tx,
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      actorType: ctx.userId ? 'user' : 'system',
      action: 'crm.document.signature_requested',
      entityType: 'BillingDocument',
      entityId: documentId,
      diff: { after: { signerEmail: created.signerEmail, expiresAt: expiresAt.toISOString() } },
    });

    return created;
  });

  // The event carries NO TOKEN. A bus message is logged, retried, dead-lettered
  // and read by whoever debugs the queue — a signing link in one is a signing
  // link in a log file. The token goes back to the caller and nowhere else; the
  // composition root that owns email builds the link and sends it.
  await publishCrmEvent({
    tenantId: ctx.tenantId,
    topic: 'crm.document.signature_requested',
    payload: {
      documentId,
      signatureId: signature.id,
      signerEmail: signature.signerEmail,
      expiresAt: signature.expiresAt.toISOString(),
    },
    dedupeKey: `crm.document.signature_requested:${signature.id}`,
  });

  return { signature, token, notify: input.notify };
}

/** Everything asked of this document, newest first. */
export async function listForDocument(
  ctx: ServiceContext,
  documentId: string
): Promise<BillingDocumentSignature[]> {
  return withTenant(ctx, (tx) =>
    tx.billingDocumentSignature.findMany({
      where: { documentId },
      orderBy: { requestedAt: 'desc' },
    })
  );
}

/** Stop a pending request working, without deleting the fact it was sent. */
export async function revoke(
  ctx: ServiceContext,
  signatureId: string
): Promise<BillingDocumentSignature> {
  return withTenant(ctx, async (tx) => {
    const before = await tx.billingDocumentSignature.findUnique({ where: { id: signatureId } });
    if (!before) throw new CrmNotFoundError('BillingDocumentSignature', signatureId);
    if (before.status !== 'pending') {
      throw new CrmValidationError('That request is no longer waiting on anybody.');
    }
    return tx.billingDocumentSignature.update({
      where: { id: signatureId },
      data: { status: 'revoked' },
    });
  });
}

/* ── The public half: token in, nothing trusted ──────────────────────────── */

/**
 * The word the SIGNER sees for what they are accepting.
 *
 * Normally the stage's own customer-facing label, because "Estimate", "Quote"
 * and "Work Order" are the tenant's vocabulary and using anything else would be
 * the platform talking over them.
 *
 * EXCEPT at a draft stage. "Draft" is an internal state — it means the business
 * has not finished writing it — and putting it in front of a customer produced
 * a page headed "Draft Q-000001" with a button reading "Accept this draft".
 * Nobody should be asked to sign something the sender is still calling a draft,
 * and a signer who reads it carefully is right to hesitate. The document is the
 * honest neutral word: never wrong, and never somebody's private label. The
 * REAL fix is on the sending side, where the panel now says so before the ask.
 */
function signerFacingLabel(stage: { stageType: string; customerLabel: string }): string {
  // Capitalised like any stage label would be: the page uses it as a heading
  // as-is and lowercases it for prose, so a lowercase value here rendered a
  // heading reading "document Q-000001".
  return stage.stageType === 'draft' ? 'Document' : stage.customerLabel;
}

/** What the signing page renders — deliberately the minimum a signer needs. */
export interface PublicSigningView {
  signatureId: string;
  status: BillingDocumentSignature['status'];
  signerName: string;
  signerEmail: string;
  expiresAt: string;
  signedAt: string | null;
  declineReason: string | null;
  document: {
    id: string;
    number: string | null;
    currency: string;
    total: number;
    validUntil: string | null;
    /** The stage's customer-facing noun — "Estimate", "Quote", "Work Order". */
    label: string;
    lines: { description: string; quantity: number; unitPrice: number; lineTotal: number }[];
  };
  business: { name: string; email: string | null };
}

/**
 * Resolve a token to the page's data.
 *
 * Expiry is checked and WRITTEN here rather than only compared: a link that has
 * run out should say so in the same words whether the sweep has been past yet or
 * not, and a page that says "expired" while the row still says "pending" is a
 * support ticket.
 */
export async function viewByToken(ctx: ServiceContext, token: string): Promise<PublicSigningView> {
  const hash = hashToken(token);

  const { row, doc } = await withTenant(ctx, async (tx) => {
    const found = await tx.billingDocumentSignature.findFirst({
      where: { tokenHash: hash },
      include: {
        document: {
          include: {
            stage: true,
            lines: { orderBy: { sortOrder: 'asc' } },
            property: { select: { name: true } },
          },
        },
      },
    });
    if (!found || !sameHash(found.tokenHash, hash)) {
      throw new CrmNotFoundError('BillingDocumentSignature', 'token');
    }

    if (found.status === 'pending' && found.expiresAt.getTime() < Date.now()) {
      await tx.billingDocumentSignature.update({
        where: { id: found.id },
        data: { status: 'expired' },
      });
      found.status = 'expired';
    } else if (found.status === 'pending' && found.viewedAt === null) {
      // "They opened it" is the difference between a customer who is thinking
      // about it and one who never got the email — which is the whole question
      // a business has three days after sending a quote.
      await tx.billingDocumentSignature.update({
        where: { id: found.id },
        data: { viewedAt: new Date() },
      });
    }

    return { row: found, doc: found.document };
  });
  return {
    signatureId: row.id,
    status: row.status,
    signerName: row.signerName,
    signerEmail: row.signerEmail,
    expiresAt: row.expiresAt.toISOString(),
    signedAt: row.signedAt?.toISOString() ?? null,
    declineReason: row.declineReason,
    document: {
      id: doc.id,
      number: doc.number,
      currency: doc.currency,
      total: Number(doc.total),
      validUntil: doc.validUntil?.toISOString() ?? null,
      label: signerFacingLabel(doc.stage),
      lines: doc.lines.map((l) => ({
        description: l.description,
        quantity: Number(l.quantity),
        unitPrice: Number(l.unitPrice),
        lineTotal: Number(l.lineTotal),
      })),
    },
    business: { name: doc.property?.name ?? '', email: null },
  };
}

export interface SignResult {
  signature: BillingDocumentSignature;
  /** The stage the document landed on, when signing moved it. */
  movedToStage: string | null;
}

/**
 * Sign it.
 *
 * Everything that makes this binding happens in ONE transaction: the snapshot is
 * frozen, the signature is stamped, the document advances, and the timeline gets
 * the entry. A signature recorded without its snapshot would attest to whatever
 * the document says next week, and a snapshot without the signature is a
 * document nobody agreed to — neither half is worth having alone.
 */
export async function signByToken(
  ctx: ServiceContext,
  rawInput: unknown,
  meta: { ip?: string; userAgent?: string } = {}
): Promise<SignResult> {
  const input = SignDocumentInput.parse(rawInput);
  const tokenHash = hashToken(input.token);

  const result = await withTenant(ctx, async (tx) => {
    const row = await tx.billingDocumentSignature.findFirst({
      where: { tokenHash },
      include: { document: { include: { stage: true, lines: { orderBy: { sortOrder: 'asc' } } } } },
    });
    if (!row) throw new CrmNotFoundError('BillingDocumentSignature', 'token');
    if (row.status === 'signed') {
      throw new CrmValidationError('This has already been signed — nothing more to do.');
    }
    if (row.status !== 'pending') {
      throw new CrmValidationError('This link is no longer active. Ask for a fresh one.');
    }
    if (row.expiresAt.getTime() < Date.now()) {
      await tx.billingDocumentSignature.update({
        where: { id: row.id },
        data: { status: 'expired' },
      });
      throw new CrmValidationError('This link has run out. Ask for a fresh one.');
    }

    const doc = row.document;

    const snapshot = await tx.billingDocumentSnapshot.create({
      data: {
        tenantId: row.tenantId,
        documentId: doc.id,
        stageId: doc.stageId,
        stageType: doc.stage.stageType,
        customerLabel: doc.stage.customerLabel,
        documentNumber: doc.number,
        snapshot: buildSnapshotPayload(
          doc,
          doc.lines,
          doc.stage
        ) as unknown as Prisma.InputJsonValue,
      },
    });

    const signedAt = new Date();
    const typedName = input.signerName?.trim() ?? '';
    const signature = await tx.billingDocumentSignature.update({
      where: { id: row.id },
      data: {
        status: 'signed',
        signedAt,
        snapshotId: snapshot.id,
        // The name they typed on the page wins over the one it was addressed
        // to — people sign for each other. `??` would keep an empty string,
        // which is the one value that must fall through.
        signerName: typedName !== '' ? typedName : row.signerName,
        signatureData: input.mark,
        ip: meta.ip?.slice(0, 45) ?? null,
        userAgent: meta.userAgent?.slice(0, 500) ?? null,
      },
    });

    // "Customer-approved" already has a meaning in the invoicing module — the
    // first `committed` stage of the document's workflow. Signing means that,
    // so it moves there rather than inventing a parallel notion of approved that
    // the board, the reports and the conversion path would each have to learn.
    const committed = await tx.documentStage.findFirst({
      where: { workflowId: doc.workflowId, stageType: 'committed' },
      orderBy: { sortOrder: 'asc' },
    });
    let movedToStage: string | null = null;
    if (committed && committed.id !== doc.stageId) {
      await tx.billingDocument.update({
        where: { id: doc.id },
        data: { stageId: committed.id },
      });
      movedToStage = committed.name;
    }

    // On the CUSTOMER's timeline, not just the document's. "They signed the
    // quote" is a thing that happened between a business and a person, and the
    // place a person's history lives is the contact.
    if (doc.customerId || doc.companyId) {
      await tx.crmActivity.create({
        data: {
          tenantId: row.tenantId,
          type: 'document.signed',
          customerId: doc.customerId,
          companyId: doc.companyId,
          description:
            `${signature.signerName} signed ${doc.stage.customerLabel.toLowerCase()} ${doc.number ?? ''}`.trim(),
          // `customer`, not `staff`: the person who did this does not work here,
          // and a timeline that credits it to whoever last touched the quote
          // reads as though we approved it on their behalf.
          actorType: 'customer',
          occurredAt: signedAt,
          linkedEntityType: 'billing_document',
          linkedEntityId: doc.id,
          metadata: { signatureId: signature.id, snapshotId: snapshot.id },
        },
      });
    }

    return { signature, movedToStage, tenantId: row.tenantId, documentId: doc.id };
  });

  await publishCrmEvent({
    tenantId: result.tenantId,
    topic: 'crm.document.signed',
    payload: { documentId: result.documentId, signatureId: result.signature.id },
    dedupeKey: `crm.document.signed:${result.signature.id}`,
  });

  return { signature: result.signature, movedToStage: result.movedToStage };
}

/** They said no. Recorded rather than deleted — a declined quote is information. */
export async function declineByToken(
  ctx: ServiceContext,
  rawInput: unknown
): Promise<BillingDocumentSignature> {
  const input = DeclineDocumentInput.parse(rawInput);

  const { row, updated } = await withTenant(ctx, async (tx) => {
    const found = await tx.billingDocumentSignature.findFirst({
      where: { tokenHash: hashToken(input.token) },
    });
    if (!found) throw new CrmNotFoundError('BillingDocumentSignature', 'token');
    if (found.status !== 'pending') {
      throw new CrmValidationError('This link is no longer active.');
    }
    return {
      row: found,
      updated: await tx.billingDocumentSignature.update({
        where: { id: found.id },
        data: {
          status: 'declined',
          declinedAt: new Date(),
          declineReason: input.reason?.slice(0, 500) ?? null,
        },
      }),
    };
  });

  await publishCrmEvent({
    tenantId: row.tenantId,
    topic: 'crm.document.declined',
    payload: { documentId: row.documentId, signatureId: row.id, reason: updated.declineReason },
    dedupeKey: `crm.document.declined:${row.id}`,
  });

  return updated;
}

/**
 * Retire links that ran out.
 *
 * Per tenant, like the SLA sweep and for the same reason: FORCE RLS means a
 * cross-tenant pass would see nothing at all, and the schedule that calls this
 * already walks tenants.
 */
export async function expireStale(ctx: ServiceContext): Promise<number> {
  return withTenant(ctx, async (tx) => {
    const { count } = await tx.billingDocumentSignature.updateMany({
      where: { status: 'pending', expiresAt: { lt: new Date() } },
      data: { status: 'expired' },
    });
    return count;
  });
}
