// billingDocumentService — authored billing documents (docs/87 §2/§6/§7).
//
// Document header CRUD + total recomputation. Line add/update/remove (and the
// per-line pricing that feeds totals) live in billing-line-service.ts so each
// file stays focused; both share `recomputeTotals` here. A document bills a
// retail Customer OR a Company (the Deal pattern) and sits on a workflow at a
// stage. Totals derive from the lines + the document's taxRate/shipping/surcharge.

import {
  CreateBillingDocumentInput,
  ListBillingDocumentsInput,
  UpdateBillingDocumentInput,
  withPoNumber,
} from '@wizeworks/crm-schemas';
import { NOT_OWED_STAGE_TYPES, PRICE_OFFER_WORKFLOW_SLUGS } from '@wizeworks/crm-schemas/builtins';
// `Prisma` as a VALUE, not a type-only import: `Prisma.DbNull` is a runtime
// sentinel, and it is the only way to ask a nullable Json column whether a key
// is present.
import { nameSearchClauses, Prisma, withTenant } from '@wizeworks/db';
import type { BillingDocument, BillingDocumentLine } from '@wizeworks/db';

import { writeAuditLog } from '../audit';
import { publishCrmEvent, type CrmTopic } from '../events';
import type { ServiceContext } from '../errors';
import { CrmNotFoundError, CrmValidationError } from '../errors';
import {
  aggregatePayments,
  deriveDocumentStatus,
  bucketAging,
  AGING_BUCKETS,
  type AgingBucketKey,
} from './billing-ar';
import { applyStageEntryEffects } from './billing-document-stage-service';
import { computeBillingTotals } from './billing-totals';
import { closeWhenDocumentMovesOn } from './task-service';
import { businessTimeZone } from './business-clock';
import { documentRecipient } from './account-contact-billing';

/** The tenant's primary site — the issuer for a document created without one
 *  (docs/131 §3.6). Every tenant has exactly one, seeded at provisioning, so the
 *  throw is a real invariant violation rather than a routine miss. */
async function resolvePrimarySiteId(
  tx: Prisma.TransactionClient,
  tenantId: string
): Promise<string> {
  const row = await tx.property.findFirst({
    where: { tenantId, isPrimary: true },
    select: { id: true },
  });
  if (!row) throw new CrmNotFoundError('Property', `primary for tenant ${tenantId}`);
  return row.id;
}

interface PendingDocEvent {
  topic: CrmTopic;
  payload: Record<string, unknown>;
  dedupeKey: string;
}

export interface DocumentWithLines extends BillingDocument {
  lines: BillingDocumentLine[];
  /**
   * Where this document would actually be sent, resolved the same way the send
   * route resolves it: the frozen `billTo` address first, else the customer's.
   *
   * It exists because the console could only see `billTo.email`, so the Send
   * dialog told the owner "there is no email address on this invoice" about an
   * invoice whose customer has one — and then sent it anyway when she confirmed,
   * because the server knew the fallback and the screen did not. One rule, read
   * from one place.
   *
   * Optional: only the single-document read resolves it.
   */
  billedToEmail?: string | null;
}

// ─────────────────────────────────────────────────────────────────────────
// Reads
// ─────────────────────────────────────────────────────────────────────────

/** A list row: the document plus the billed party resolved for display. */
export interface BillingDocumentListItem extends BillingDocument {
  billedToName: string | null;
  /** A quote or estimate: a price offered, not money owed (issue 764). The list
   *  holds both, and a row has to know which it is to say the right thing. */
  priceOffer: boolean;
  /** Where the document stands on its workflow ("Accepted", "Invoice"), for a
   *  row whose payment status means nothing, which is every price offer. */
  stageName: string;
  stageType: string;
  /** When the customer was actually emailed this, or null. Read off the metadata
   *  bag, which is where the send route records it — there is no column. Lifted
   *  onto the row because "unpaid" and "never sent" look identical otherwise. */
  sentAt: string | null;
}

/**
 * Midnight UTC of the current date.
 *
 * "Past due" is a question about DATES, not instants: a bill due today is not
 * late at 3pm. Everything else in AR settles this through `daysPastDue`; a
 * query cannot call that per row, so it compares against the same boundary.
 */
function startOfUtcToday(now: Date = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

export async function list(
  ctx: ServiceContext,
  rawFilter: unknown = {}
): Promise<{ items: BillingDocumentListItem[]; total: number }> {
  const filter = ListBillingDocumentsInput.parse(rawFilter);
  return withTenant(ctx, async (tx) => {
    const where: Prisma.BillingDocumentWhereInput = {
      ...(filter.includeDeleted ? {} : { deletedAt: null }),
      // Member access ceiling (docs/131 §3.3): only the member's businesses'
      // documents. propertyId is required here, so no null case to admit.
      ...(filter.propertyIds ? { propertyId: { in: filter.propertyIds } } : {}),
      ...(filter.workflowId ? { workflowId: filter.workflowId } : {}),
      ...(filter.stageId ? { stageId: filter.stageId } : {}),
      ...(filter.customerId ? { customerId: filter.customerId } : {}),
      // A PAYMENT STATUS IS ASKED OF A BILL. A quote carries `unpaid` from the
      // moment it exists, so "Owed" listed Wasatch Front's accepted quote beside
      // its invoices, $4,075.60 "owed" twice over (sparx persona issue 085).
      // Through the shared rule, so the filter and the Outstanding figure above
      // it cannot disagree. Not for "Written off": a void document is the one
      // that rule leaves out on purpose.
      ...(filter.status
        ? { status: filter.status, ...(filter.status === 'void' ? {} : ISSUED_BILL_WHERE) }
        : {}),
      // IS IT LATE? Asked of the due date, never of the status column.
      //
      // `status` is written by `recomputeTotals`, which runs when something is
      // DONE to a document — a line, a payment, a void. A due date passing is
      // not something being done, so nothing writes it, and `status = 'overdue'`
      // returns only the documents that happened to be touched after they went
      // late. The B2B dunning scan re-marks its own accounts (every late B2B
      // invoice on the dev database is correctly `overdue`); a shop billing an
      // ordinary customer has nothing doing that for it.
      //
      // Measured before this existed: 54 documents / $51,456.69 genuinely past
      // due, of which `status = 'overdue'` found 30 / $26,983.76. The aging
      // report on the same platform got it right all along, because it derives
      // from `dueAt` — so the two screens answered one question two ways,
      // $24,472.93 apart.
      //
      // `status in (unpaid|partial|overdue)` rather than ignoring status
      // entirely: paid and void documents have a due date in the past too, and
      // neither is money anybody is waiting for. Matches the aging report's own
      // filter exactly, which is the point.
      ...(filter.pastDue
        ? {
            // Through the shared rule, so "late" cannot mean something this
            // screen's own Outstanding figure disagrees with. The due-date
            // clause below already kept quotes out by accident — no quote or
            // estimate on the platform carries a due date, because an offer runs
            // OUT rather than falling DUE — but "by accident" is not a rule, and
            // the sentence above claiming this excluded drafts was about status.
            ...OWED_DOCUMENT_WHERE,
            balance: { gt: 0 },
            // A document due TODAY is not late. Comparing instants makes it late
            // partway through its own due date — the trap `daysPastDue` exists
            // to avoid, applied here to the query.
            dueAt: { not: null, lt: startOfUtcToday() },
          }
        : {}),
      // WAS IT ACTUALLY SENT? There is no `sent_at` column — the send route
      // records it in the metadata bag — so this asks whether that key is
      // present. `not: Prisma.DbNull` rather than a JSON equality, because the
      // value is a timestamp string nobody knows in advance.
      //
      // Worth filtering to because an unpaid invoice nobody sent and an unpaid
      // invoice sent three weeks ago read identically on this list and are
      // completely different problems, and only one of them is the customer's
      // fault. It is also what makes the dunning ladder's new "was it sent"
      // guard safe: a bill she never sends is no longer chased, so it has to be
      // findable here instead.
      ...(filter.sent === undefined
        ? {}
        : filter.sent
          ? { metadata: { path: ['sentAt'], not: Prisma.DbNull } }
          : { NOT: { metadata: { path: ['sentAt'], not: Prisma.DbNull } } }),
      AND: [
        // A COMPANY'S DOCUMENTS INCLUDE ITS PEOPLE'S. Billing a named contact
        // writes `customerId` and leaves `companyId` null — which is correct,
        // that is who the document is made out to — so matching the column
        // alone answered "what has been billed to this company as an entity",
        // not "what does this company owe me". A trade supplier deciding
        // whether to release the next order needs the second one, and the first
        // reads as a company with no debts while somebody there is 60 days
        // late.
        //
        // Shares this `AND` array with the search below rather than taking a
        // key of its own, because one `AND` key would silently overwrite the
        // other.
        ...(filter.companyId
          ? [
              {
                OR: [
                  { companyId: filter.companyId },
                  { customer: { companyId: filter.companyId } },
                ],
              },
            ]
          : []),
        // No denormalized customer/account name column (bill-to/ship-to are
        // frozen JSON, not queryable) — search the document number directly and
        // fall back to the live customer/B2B-account relations. Every typed word
        // must land somewhere, so a two-part name finds its invoices.
        ...nameSearchClauses(filter.q, (term) => [
          { number: { contains: term, mode: 'insensitive' as const } },
          { customer: { firstName: { contains: term, mode: 'insensitive' as const } } },
          { customer: { lastName: { contains: term, mode: 'insensitive' as const } } },
          { customer: { email: { contains: term, mode: 'insensitive' as const } } },
          { company: { companyName: { contains: term, mode: 'insensitive' as const } } },
        ]),
      ],
    };
    const [rows, total] = await Promise.all([
      tx.billingDocument.findMany({
        where,
        orderBy: orderByFor(filter.sortBy, filter.order),
        take: filter.limit,
        skip: filter.offset,
        // The billed party, resolved for the LIST.
        //
        // Without this a list row carries `customerId` and the frozen `billTo`
        // JSON, and nothing else — and `billTo` is only written when a document
        // is snapshotted, so every draft and every open document showed a blank
        // customer column. "INV-000002, unpaid, $100.00" with no name is not a
        // row anyone can act on; identifying who owes you is the entire job of
        // a receivables list.
        include: {
          customer: { select: { firstName: true, lastName: true, companyName: true, email: true } },
          company: { select: { companyName: true } },
          workflow: { select: { slug: true } },
          stage: { select: { name: true, stageType: true } },
        },
      }),
      tx.billingDocument.count({ where }),
    ]);

    const items = rows.map(({ customer, company, workflow, stage, ...document }) => ({
      ...document,
      billedToName: billedToName(document.billTo, customer, company),
      sentAt: sentAtOf(document.metadata),
      priceOffer: PRICE_OFFER_WORKFLOW_SLUGS.includes(workflow.slug),
      stageName: stage.name,
      stageType: stage.stageType,
    }));
    return { items, total };
  });
}

/** When the send route last emailed this document. One reader, so the shape of
 *  the metadata bag is decoded in one place rather than at each call site. */
function sentAtOf(metadata: Prisma.JsonValue): string | null {
  if (metadata && typeof metadata === 'object' && !Array.isArray(metadata)) {
    const value = (metadata as Record<string, unknown>).sentAt;
    if (typeof value === 'string' && value.trim()) return value;
  }
  return null;
}

/** Shape of the two relations the list resolves a name from. */
type BilledCustomer = {
  firstName: string | null;
  lastName: string | null;
  companyName: string | null;
  email: string | null;
} | null;
type BilledAccount = { companyName: string } | null;

/**
 * Who this document bills, as one display string.
 *
 * Resolution order matters and is not arbitrary. The FROZEN `billTo` wins when
 * present: once a document is issued it must keep naming whoever it named at
 * the time, even if that customer later changes their name or is deleted — that
 * is the whole reason bill-to is snapshotted rather than joined. The live
 * relations are the fallback for everything not yet frozen, which in practice
 * is every draft and open document.
 */
function billedToName(
  billTo: Prisma.JsonValue,
  customer: BilledCustomer,
  account: BilledAccount
): string | null {
  if (billTo && typeof billTo === 'object' && !Array.isArray(billTo)) {
    const frozen = (billTo as Record<string, unknown>).name;
    if (typeof frozen === 'string' && frozen.trim()) return frozen;
  }
  if (account?.companyName) return account.companyName;
  if (customer) {
    const person = [customer.firstName, customer.lastName].filter(Boolean).join(' ').trim();
    return customer.companyName ?? (person || customer.email) ?? null;
  }
  return null;
}

/**
 * Sort order for a paged list.
 *
 * Two things here are load-bearing for PAGINATION specifically, not just for
 * sorting, and both are invisible until a list is long enough to page:
 *
 * 1. The `id` tiebreaker. `skip`/`take` re-runs the query per page, and rows
 *    that tie on the sort column have no guaranteed order between runs — so a
 *    document can appear on both page 1 and page 2 while another is never
 *    shown at all. Postgres is free to do this; it is not a bug you can rely
 *    on not hitting. A unique final key makes the total order deterministic.
 *
 * 2. NULLS LAST in both directions. `dueAt` is null for a document with no due
 *    date and `numberSeq` is null for an unnumbered draft. Postgres defaults to
 *    NULLS LAST ascending but NULLS FIRST descending, so "newest due date
 *    first" would otherwise open with a block of documents that have no due
 *    date at all — the least useful rows, in the most prominent position.
 */
function orderByFor(
  sortBy: ListBillingDocumentsInput['sortBy'],
  order: ListBillingDocumentsInput['order']
): Prisma.BillingDocumentOrderByWithRelationInput[] {
  const nullable = { sort: order, nulls: 'last' } as const;

  switch (sortBy) {
    // Sorts on the LIVE relation, while the column displays the frozen
    // bill-to name where one exists — so an issued document that was renamed
    // at the customer's end sorts by its current name and displays its
    // historical one. That is the lesser of the two evils: the alternative is
    // no customer sort at all, because the frozen name lives in JSON and
    // cannot be ordered by. Documents billing a B2B account order by company
    // name; the two groups therefore cluster rather than interleave.
    case 'customer':
      return [
        { company: { companyName: order } },
        { customer: { companyName: order } },
        { customer: { lastName: order } },
        { id: order },
      ];
    // URGENCY, not the alphabet. `statusRank` is a generated column
    // (overdue 10 → unpaid 20 → partial 30 → paid 40 → void 50), so ascending
    // is "what needs chasing first" — which is what an operator means when
    // they sort a receivables list by status. Ordering on `status` itself
    // would sort the text and put PAID second.
    case 'status':
      return [{ statusRank: order }, { dueAt: nullable }, { id: order }];
    case 'number':
      return [{ numberSeq: nullable }, { id: order }];
    case 'dueAt':
      return [{ dueAt: nullable }, { id: order }];
    case 'total':
      return [{ total: order }, { id: order }];
    case 'balance':
      return [{ balance: order }, { id: order }];
    case 'createdAt':
      return [{ createdAt: order }, { id: order }];
    case 'updatedAt':
      return [{ updatedAt: order }, { id: order }];
  }
}

export interface AgingBucketOut {
  key: AgingBucketKey;
  label: string;
  count: number;
  balance: number;
}

export interface AgingReport {
  asOf: string;
  buckets: AgingBucketOut[];
  totalOutstanding: number;
  totalCount: number;
}

/**
 * A bill the business has actually issued, paid or not: not an offer (a quote
 * or an estimate) and not a draft or void document. The half of
 * `OWED_DOCUMENT_WHERE` that is about WHAT the document is rather than whether
 * it has been paid, for a list that shows paid bills too. A trade buyer's
 * invoice list counted an unaccepted quote as an unpaid invoice (sparx persona
 * issue 084).
 */
export const ISSUED_BILL_WHERE: Prisma.BillingDocumentWhereInput = {
  workflow: { slug: { notIn: [...PRICE_OFFER_WORKFLOW_SLUGS] } },
  stage: { stageType: { notIn: [...NOT_OWED_STAGE_TYPES] } },
};

/**
 * WHAT COUNTS AS MONEY SOMEBODY OWES — as a query, in one place.
 *
 * Eight queries across four packages asked this and every one of them asked it
 * as `status in (unpaid | partial | overdue)`. That is the PAYMENT state, and a
 * quote nobody has sent carries `unpaid` and a balance exactly like an invoice,
 * because the status machine is payment-derived and knows nothing about
 * workflows (`billing-ar.ts` says so in its first paragraph).
 *
 * So every quote and estimate on the platform was counted as a receivable
 * (issue 857): $9,345.64 over 16 documents, and 39% of what one shop's console
 * told her she was owed. The rule that tells a bill from an offer has existed
 * since issue 764 and has a guard against second copies — it simply was never
 * asked here.
 *
 * Spread this rather than repeating its clauses: a ninth query that spells its
 * own version is the shape of the bug it fixes.
 */
export const OWED_DOCUMENT_WHERE: Prisma.BillingDocumentWhereInput = {
  status: { in: ['unpaid', 'partial', 'overdue'] },
  ...ISSUED_BILL_WHERE,
};

/** AR aging report (docs/87 §8): open billing documents bucketed by days past
 *  due. Lives on the invoicing surface but is the canonical AR view that B2B /
 *  Commerce dashboards pull from. Scope it to one B2B account (`companyId`) or
 *  to all B2B AR (`b2bOnly`, e.g. the B2B Invoices page) — otherwise it spans every
 *  open document.
 *
 *  Selects through `OWED_DOCUMENT_WHERE`, so a quote is not a receivable. This
 *  read `status in (unpaid | partial | overdue)` alone, under a comment saying
 *  "paid/void carry no balance" — true, and about the wrong question. A quote
 *  nobody has sent carries `unpaid` and a balance too (issue 857). */
export async function aging(
  ctx: ServiceContext,
  filter: { companyId?: string; b2bOnly?: boolean } = {}
): Promise<AgingReport> {
  const scope: Prisma.BillingDocumentWhereInput = filter.companyId
    ? { companyId: filter.companyId }
    : filter.b2bOnly
      ? { companyId: { not: null } }
      : {};
  return withTenant(ctx, async (tx) => {
    const rows = await tx.billingDocument.findMany({
      where: {
        deletedAt: null,
        ...OWED_DOCUMENT_WHERE,
        ...scope,
      },
      select: { balance: true, dueAt: true },
    });
    const now = new Date();
    // Bucketed on HER clock. A balance due today in Denver must not appear under
    // "1–30 days late" because UTC has already started tomorrow, and this report
    // and the receivables screen have to agree about which bucket it is in.
    const timeZone = await businessTimeZone(tx, ctx.tenantId);
    const grouped = bucketAging(
      rows.map((r) => ({ balance: Number(r.balance), dueAt: r.dueAt })),
      now,
      timeZone
    );
    const buckets: AgingBucketOut[] = AGING_BUCKETS.map(({ key, label }) => ({
      key,
      label,
      count: grouped[key].count,
      balance: grouped[key].balance,
    }));
    return {
      asOf: now.toISOString(),
      buckets,
      totalOutstanding: Math.round(buckets.reduce((s, b) => s + b.balance, 0) * 100) / 100,
      totalCount: buckets.reduce((s, b) => s + b.count, 0),
    };
  });
}

export async function get(ctx: ServiceContext, documentId: string): Promise<DocumentWithLines> {
  return withTenant(ctx, async (tx) => {
    const doc = await tx.billingDocument.findUnique({
      where: { id: documentId },
      include: {
        lines: { orderBy: { sortOrder: 'asc' } },
        customer: { select: { email: true } },
      },
    });
    if (doc?.deletedAt !== null) throw new CrmNotFoundError('BillingDocument', documentId);
    const { customer, ...document } = doc;
    // The same answer the send itself reaches (`documentRecipient`), so the
    // Send box names the address the email will really go to.
    const billedToEmail = await documentRecipient(tx, {
      billTo: document.billTo,
      companyId: document.companyId,
      customerEmail: customer?.email ?? null,
    });
    return { ...document, billedToEmail };
  });
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
        'This workflow has no stages. Add a stage before creating a document.'
      );
    }
    // Resolve the starting stage: the one supplied (must belong to the workflow)
    // or the workflow's first stage.
    const stage = input.stageId
      ? workflow.stages.find((s) => s.id === input.stageId)
      : workflow.stages[0];
    if (!stage) throw new CrmNotFoundError('DocumentStage', input.stageId ?? '(first)');

    const { inheritedCompanyId } = await assertPartyExists(
      tx,
      input.customerId ?? null,
      input.companyId ?? null
    );
    // A caller that named the account wins; one that named only a person gets
    // the account that person buys for. Never the other way round — a document
    // deliberately addressed to one account must not be moved to another
    // because of who happened to ask for it.
    const companyId = input.companyId ?? inheritedCompanyId;

    // The ISSUING site (docs/131 §3.6) — set once at create and never changed,
    // because it is what `numberSeq` is allocated against. Re-homing a document
    // after it has a number would take a number out of one business's books and
    // drop it into another's, leaving a gap in the first.
    const propertyId = input.propertyId ?? (await resolvePrimarySiteId(tx, ctx.tenantId));

    const created = await tx.billingDocument.create({
      data: {
        tenantId: ctx.tenantId,
        propertyId,
        workflowId: workflow.id,
        stageId: stage.id,
        customerId: input.customerId ?? null,
        companyId,
        assignedUserId: input.assignedUserId ?? null,
        currency: input.currency,
        taxRate: input.taxRate,
        billTo: (input.billTo ?? null) as Prisma.InputJsonValue,
        shipTo: (input.shipTo ?? null) as Prisma.InputJsonValue,
        shippingTotal: input.shippingTotal,
        surchargeTotal: input.surchargeTotal,
        notes: input.notes ?? null,
        customerNote: input.customerNote ?? null,
        validUntil: input.validUntil ? new Date(input.validUntil) : null,
        dueAt: input.dueAt ? new Date(input.dueAt) : null,
        // The buyer's PO number rides in the bag, where checkout puts an
        // order's (issue 077).
        metadata: withPoNumber(input.metadata ?? {}, input.poNumber) as Prisma.InputJsonValue,
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
        companyId: withLines.companyId,
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

    // The account to attach when the caller moved the document to a person who
    // buys for one, and did not name an account itself. Same rule as create.
    let adoptedCompanyId: string | null = null;
    if (input.customerId !== undefined || input.companyId !== undefined) {
      const customerId = input.customerId !== undefined ? input.customerId : before.customerId;
      const companyId = input.companyId !== undefined ? input.companyId : before.companyId;
      if (!customerId && !companyId) {
        throw new CrmValidationError('A billing document must bill a customer or a B2B account.');
      }
      const { inheritedCompanyId } = await assertPartyExists(tx, customerId, companyId);
      if (input.companyId === undefined && !before.companyId) adoptedCompanyId = inheritedCompanyId;
    }

    await tx.billingDocument.update({
      where: { id: documentId },
      data: {
        ...(input.customerId !== undefined ? { customerId: input.customerId } : {}),
        ...(input.companyId !== undefined
          ? { companyId: input.companyId }
          : adoptedCompanyId
            ? { companyId: adoptedCompanyId }
            : {}),
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
        ...(input.customerNote !== undefined ? { customerNote: input.customerNote } : {}),
        ...(input.declinedReason !== undefined ? { declinedReason: input.declinedReason } : {}),
        ...(input.validUntil !== undefined
          ? { validUntil: input.validUntil ? new Date(input.validUntil) : null }
          : {}),
        ...(input.dueAt !== undefined ? { dueAt: input.dueAt ? new Date(input.dueAt) : null } : {}),
        // The PO number is MERGED into whatever bag the document ends up with,
        // so a header save never wipes the send record that lives beside it.
        ...(input.metadata !== undefined || input.poNumber !== undefined
          ? {
              metadata: (input.poNumber !== undefined
                ? withPoNumber(input.metadata ?? before.metadata, input.poNumber)
                : input.metadata) as Prisma.InputJsonValue,
            }
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
    // A task waiting on a removed document has nothing left to wait for.
    await closeWhenDocumentMovesOn(tx, ctx, { documentId, byUserId: ctx.userId ?? null });
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
      coreCharge: l.coreCharge === null ? null : Number(l.coreCharge),
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
    // Overdue is a claim about a DAY, so it is decided on the business's day.
    timeZone: await businessTimeZone(tx, tenantId),
  });
  const paidAt = status === 'paid' ? (doc.paidAt ?? now) : null;

  const updated = await tx.billingDocument.update({
    where: { id: documentId },
    data: {
      subtotal: totals.subtotal,
      discountTotal: totals.discountTotal,
      taxTotal: totals.taxTotal,
      coreChargeTotal: totals.coreChargeTotal,
      total: totals.total,
      amountPaid,
      depositTotal,
      balance,
      status,
      paidAt,
    },
  });

  // A B2B document's open balance IS the account's net-terms AR (docs/87 §15), so
  // this single money chokepoint is also where credit utilisation re-syncs — every
  // create / line / payment / void funnels through here, so `credit_used` can never
  // drift from open AR regardless of which surface mutated the document. Retail
  // documents (no account) skip it. The function sums open `billing_documents`
  // balances and is RLS-safe (runs under the caller's tenant GUC).
  if (updated.companyId) {
    await tx.$executeRaw`SELECT sync_b2b_credit_used(${updated.companyId}::uuid)`;
  }

  return updated;
}

/** Throw a clean NOT_FOUND if a referenced party doesn't exist for this tenant,
 *  instead of letting an FK violation surface. */
/**
 * Check the party a document bills, and report the trade account behind them.
 *
 * The returned `inheritedCompanyId` is the wholesale account the CUSTOMER buys
 * for, when the caller named a person and not an account. It matters because
 * every B2B view of a document is keyed on `companyId`: the Quotes list, the
 * wholesale invoice list, and the account's own portal all ask "which business
 * is this for" and get nothing from a document that only knows the person who
 * asked. Fourteen of the fifteen quotes on the dev machine had no account on
 * them, and so appeared in nobody's Quotes list (issue 763).
 */
async function assertPartyExists(
  tx: Prisma.TransactionClient,
  customerId: string | null,
  companyId: string | null
): Promise<{ inheritedCompanyId: string | null }> {
  let inheritedCompanyId: string | null = null;
  if (customerId) {
    const customer = await tx.customer.findUnique({ where: { id: customerId } });
    if (customer?.deletedAt !== null) throw new CrmNotFoundError('Customer', customerId);
    inheritedCompanyId = customer.companyId;
  }
  if (companyId) {
    const account = await tx.company.findUnique({ where: { id: companyId } });
    if (!account) throw new CrmNotFoundError('Company', companyId);
  }
  return { inheritedCompanyId };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
