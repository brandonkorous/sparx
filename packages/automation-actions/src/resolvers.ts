// Module entity resolvers + scanners (docs/81 §5.3, docs/90 ADR).
//
// The engine's built-in resolvers (`@sparx/automation/resolvers/builtins`) cover
// the crm-core entities (customer / deal / order). This module fills the seam for
// the rest of the baked-in workflow catalog — quote, billing document, B2B
// account, chat conversation, product/inventory — plus the scheduled SCANNERS the
// cart-abandonment / chat-unresponded / invoicing-dunning seeds fan out over.
// Registered through the same `registerResolver` / `registerScanner` seam the
// worker installs at boot (`installModuleActions`).
//
// Every resolver hydrates a FLAT, dotted-path field map (RLS-scoped via `ctx.tx`)
// — the same contract conditions, the entitySnapshot, and the email DataSource
// layer read. Customer-addressed entities resolve `customer.email` (directly, or
// via a B2B account's primary contact) so an `email.send_campaign` wired to them
// can address the recipient.

import {
  registerResolver,
  registerScanner,
  type ResolvedFields,
  type ScannedRow,
  type TenantCtx,
} from '@sparx/automation';

const MS_PER_DAY = 86_400_000;

/** Prisma Decimal | number | null → number | null. */
function num(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function str(v: unknown): string {
  if (typeof v === 'string') return v;
  throw new Error(`expected string id on trigger payload, got ${typeof v}`);
}

// ─── customer contact (shared) ───────────────────────────────────────────────
//
// Many entities are addressed through a Customer — directly (`customerId`) or, for
// a B2B document, via the account's primary contact. Resolving it here keeps every
// entity's `customer.*` field set identical (so a template/condition reads the same
// keys no matter which entity triggered).

const CUSTOMER_CONTACT_SELECT = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  company: true,
  doNotContact: true,
} as const;

interface ContactLike {
  id: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  company: string | null;
  doNotContact: boolean;
}

function contactFields(c: ContactLike | null): ResolvedFields {
  if (!c) return {};
  const fullName = [c.firstName, c.lastName].filter(Boolean).join(' ');
  return {
    'customer.id': c.id,
    'customer.email': c.email,
    'customer.firstName': c.firstName,
    'customer.lastName': c.lastName,
    'customer.fullName': fullName.length > 0 ? fullName : null,
    'customer.company': c.company,
    'customer.doNotContact': c.doNotContact,
  };
}

/** Resolve the addressable Customer for an entity: the linked customer, else the
 *  B2B account's active primary contact (any active contact as a fallback). */
async function resolveContact(
  ctx: TenantCtx,
  ref: { customerId?: string | null; b2bAccountId?: string | null }
): Promise<ResolvedFields> {
  if (ref.customerId) {
    const c = await ctx.tx.customer.findUnique({
      where: { id: ref.customerId },
      select: CUSTOMER_CONTACT_SELECT,
    });
    if (c) return contactFields(c);
  }
  if (ref.b2bAccountId) {
    const primary = await ctx.tx.b2bAccountContact.findFirst({
      where: { accountId: ref.b2bAccountId, isActive: true, role: 'primary_contact' },
      select: { customer: { select: CUSTOMER_CONTACT_SELECT } },
    });
    const contact =
      primary ??
      (await ctx.tx.b2bAccountContact.findFirst({
        where: { accountId: ref.b2bAccountId, isActive: true },
        select: { customer: { select: CUSTOMER_CONTACT_SELECT } },
      }));
    if (contact) return contactFields(contact.customer);
  }
  return {};
}

// ─── quote ───────────────────────────────────────────────────────────────────

async function hydrateQuote(ctx: TenantCtx, quoteId: string): Promise<ResolvedFields> {
  const q = await ctx.tx.quote.findUnique({
    where: { id: quoteId },
    select: {
      id: true,
      quoteNumber: true,
      status: true,
      total: true,
      currency: true,
      validUntil: true,
      customerId: true,
      b2bAccountId: true,
    },
  });
  if (!q) return {};
  return {
    'quote.id': q.id,
    'quote.number': q.quoteNumber,
    'quote.status': q.status,
    'quote.total': num(q.total),
    'quote.currency': q.currency,
    'quote.validUntil': q.validUntil,
    ...(await resolveContact(ctx, { customerId: q.customerId, b2bAccountId: q.b2bAccountId })),
  };
}

// ─── billing document (invoicing) ─────────────────────────────────────────────

const BILLING_SELECT = {
  id: true,
  number: true,
  status: true,
  dueAt: true,
  balance: true,
  total: true,
  currency: true,
  assignedUserId: true,
  customerId: true,
  b2bAccountId: true,
  workflow: { select: { slug: true } },
  stage: { select: { stageType: true } },
} as const;

interface BillingLike {
  id: string;
  number: string | null;
  status: string;
  dueAt: Date | null;
  balance: unknown;
  total: unknown;
  currency: string;
  assignedUserId: string | null;
  customerId: string | null;
  b2bAccountId: string | null;
  workflow: { slug: string };
  stage: { stageType: string };
}

/** Field map for a billing document. `overdueDays` / `daysUntilDue` are COMPUTED
 *  from `dueAt` (not the stored `overdue_days`, which only the B2B AR escalation
 *  maintains) so the standalone-invoicing dunning seeds fire for every workflow. */
function billingFields(d: BillingLike, now: number): ResolvedFields {
  const dueMs = d.dueAt ? d.dueAt.getTime() : null;
  const daysUntilDue = dueMs !== null ? Math.floor((dueMs - now) / MS_PER_DAY) : null;
  const overdueDays = dueMs !== null && dueMs < now ? Math.floor((now - dueMs) / MS_PER_DAY) : 0;
  return {
    'invoice.id': d.id,
    'invoice.number': d.number,
    'invoice.status': d.status,
    'invoice.dueAt': d.dueAt,
    'invoice.daysUntilDue': daysUntilDue,
    'invoice.overdueDays': overdueDays,
    'invoice.balance': num(d.balance),
    'invoice.total': num(d.total),
    'invoice.currency': d.currency,
    'invoice.assignedUserId': d.assignedUserId,
    'invoice.workflowSlug': d.workflow.slug,
    'invoice.stageType': d.stage.stageType,
  };
}

async function hydrateBillingDocument(ctx: TenantCtx, docId: string): Promise<ResolvedFields> {
  const d = await ctx.tx.billingDocument.findUnique({
    where: { id: docId },
    select: BILLING_SELECT,
  });
  if (!d) return {};
  return {
    ...billingFields(d, Date.now()),
    ...(await resolveContact(ctx, { customerId: d.customerId, b2bAccountId: d.b2bAccountId })),
  };
}

// ─── B2B account (event) ──────────────────────────────────────────────────────

async function hydrateB2bAccount(ctx: TenantCtx, accountId: string): Promise<ResolvedFields> {
  const a = await ctx.tx.b2BAccount.findUnique({
    where: { id: accountId },
    select: {
      id: true,
      companyName: true,
      status: true,
      paymentTerms: true,
      creditLimit: true,
      assignedRepId: true,
    },
  });
  if (!a) return {};
  return {
    'b2bAccount.id': a.id,
    'b2bAccount.companyName': a.companyName,
    'b2bAccount.status': a.status,
    'b2bAccount.paymentTerms': a.paymentTerms,
    'b2bAccount.creditLimit': num(a.creditLimit),
    'b2bAccount.assignedRepId': a.assignedRepId,
    ...(await resolveContact(ctx, { b2bAccountId: a.id })),
  };
}

// ─── chat conversation (event + scan) ─────────────────────────────────────────

const CONVERSATION_SELECT = {
  id: true,
  status: true,
  assignedToId: true,
  assignedTo: { select: { email: true } },
  visitorName: true,
  visitorEmail: true,
  customerId: true,
  customer: { select: CUSTOMER_CONTACT_SELECT },
} as const;

interface ConversationLike {
  id: string;
  status: string;
  assignedToId: string | null;
  assignedTo: { email: string | null } | null;
  visitorName: string | null;
  visitorEmail: string | null;
  customerId: string | null;
  customer: ContactLike | null;
}

/** Conversation fields + its addressable contact (a linked Customer, else the
 *  anonymous visitor's captured name/email). `assignedToEmail` lets a staff alert
 *  reach the assigned agent (else it falls back to the tenant notify address). */
function conversationFields(c: ConversationLike): ResolvedFields {
  const fields: ResolvedFields = {
    'conversation.id': c.id,
    'conversation.status': c.status,
    'conversation.assignedToId': c.assignedToId,
    'conversation.assignedToEmail': c.assignedTo?.email ?? null,
  };
  if (c.customer) {
    Object.assign(fields, contactFields(c.customer));
  } else if (c.visitorEmail || c.visitorName) {
    fields['customer.email'] = c.visitorEmail;
    fields['customer.firstName'] = c.visitorName;
    fields['customer.fullName'] = c.visitorName;
  }
  return fields;
}

// ─── product / inventory (event) ──────────────────────────────────────────────

async function hydrateInventory(
  ctx: TenantCtx,
  payload: Record<string, unknown>
): Promise<ResolvedFields> {
  const variantId = typeof payload.variantId === 'string' ? payload.variantId : null;
  if (!variantId) return {};
  const v = await ctx.tx.productVariant.findUnique({
    where: { id: variantId },
    select: { id: true, sku: true, product: { select: { id: true, title: true } } },
  });
  if (!v) return {};
  // The inventory.low / .depleted event carries the on-hand level; fall back to
  // null rather than a second query if it's absent.
  const onHand =
    typeof payload.onHand === 'number'
      ? payload.onHand
      : typeof payload.quantity === 'number'
        ? payload.quantity
        : null;
  return {
    'product.id': v.product.id,
    'product.title': v.product.title,
    'variant.id': v.id,
    'variant.sku': v.sku,
    'inventory.quantity': onHand,
  };
}

// ─── registration ─────────────────────────────────────────────────────────────

// Quote lifecycle events (CRM publishes `crm.quote.*`). The seed catalog triggers
// `b2b-quote-received` off `crm.quote.submitted`; the rest round-trip so an existing
// rule on any quote event still resolves.
const QUOTE_EVENTS = [
  'crm.quote.submitted',
  'crm.quote.accepted',
  'crm.quote.declined',
  'crm.quote.expired',
];

// Billing-document events (CRM publishes `crm.billing_document.*`).
const BILLING_EVENTS = [
  'crm.billing_document.created',
  'crm.billing_document.stage_changed',
  'crm.billing_document.finalized',
  'crm.billing_document.paid',
];

// B2B account events. A gated apply→approve flow + its `b2b.account.approved`
// event is not built (docs/90) — in the self-serve model account creation IS the
// "approved" moment, so the `b2b-account-approved` welcome email triggers here.
const B2B_ACCOUNT_EVENTS = ['crm.b2b_account.created'];

const INVENTORY_EVENTS = ['inventory.low', 'inventory.depleted'];

let installed = false;

/** Register the module entity resolvers + scheduled scanners exactly once. */
export function installEntityResolvers(): void {
  if (installed) return;
  installed = true;

  for (const ev of QUOTE_EVENTS) {
    registerResolver(ev, (ctx, p) => hydrateQuote(ctx, str(p.quoteId ?? p.id)));
  }
  for (const ev of BILLING_EVENTS) {
    registerResolver(ev, (ctx, p) =>
      hydrateBillingDocument(ctx, str(p.documentId ?? p.billingDocumentId ?? p.id))
    );
  }
  for (const ev of B2B_ACCOUNT_EVENTS) {
    registerResolver(ev, (ctx, p) => hydrateB2bAccount(ctx, str(p.accountId ?? p.id)));
  }
  for (const ev of INVENTORY_EVENTS) {
    registerResolver(ev, (ctx, p) => hydrateInventory(ctx, p));
  }

  // ── scheduled scanners ──────────────────────────────────────────────────────

  // Cart abandonment (interval scan). A cart is "cold" once it has gone untouched
  // for >30 min while still holding items. `recoveredAt: null` EXCLUDES purchased
  // carts (checkout stamps recoveredAt on order placement — checkout-service.ts),
  // so a buyer never gets an abandoned-cart email. Only carts with an emailable
  // customer are returned (a guest cart has no address). The 7-day floor bounds the
  // candidate set; the interval cadence's once-per-entity dedupe fires a single run.
  registerScanner('cart', async (ctx: TenantCtx): Promise<ScannedRow[]> => {
    const now = Date.now();
    const coldBefore = new Date(now - 30 * 60_000);
    const floor = new Date(now - 7 * MS_PER_DAY);
    const rows = await ctx.tx.cart.findMany({
      where: {
        recoveredAt: null,
        updatedAt: { lt: coldBefore, gt: floor },
        items: { some: {} },
        customer: { is: { email: { not: null } } },
      },
      select: {
        id: true,
        totalCents: true,
        currency: true,
        customer: { select: CUSTOMER_CONTACT_SELECT },
      },
      take: 5_000,
    });
    return rows.map((c) => ({
      id: c.id,
      fields: {
        'cart.id': c.id,
        'cart.totalCents': c.totalCents,
        'cart.currency': c.currency,
        ...contactFields(c.customer),
      },
    }));
  });

  // Chat conversation scan (interval). Serves two seeds, partitioned by the
  // predicate's `conversation.status`:
  //   • open + no STAFF reply yet → staff "unresponded" alert (the predicate adds
  //     a `conversation.minutesSinceCreated >= N` threshold so a brand-new chat
  //     isn't flagged).
  //   • recently resolved → customer satisfaction survey.
  // The 7-day floor bounds the candidate set; the interval cadence's
  // once-per-entity dedupe fires each seed a single time per conversation.
  registerScanner('conversation', async (ctx: TenantCtx): Promise<ScannedRow[]> => {
    const now = Date.now();
    const floor = new Date(now - 7 * MS_PER_DAY);
    const rows = await ctx.tx.chatConversation.findMany({
      where: {
        OR: [
          {
            status: 'open',
            createdAt: { gt: floor },
            messages: { none: { senderType: 'staff' } },
          },
          { status: 'resolved', resolvedAt: { gt: floor } },
        ],
      },
      select: { ...CONVERSATION_SELECT, createdAt: true },
      take: 5_000,
    });
    return rows.map((c) => ({
      id: c.id,
      fields: {
        ...conversationFields(c as ConversationLike),
        'conversation.minutesSinceCreated': Math.floor((now - c.createdAt.getTime()) / 60_000),
      },
    }));
  });

  // Quote expiry (interval scan). Submitted (awaiting-decision) quotes whose
  // `validUntil` falls within the next 48h — the b2b-quote-expiring nudge fans out
  // over these. The interval cadence's once-per-entity dedupe fires a single
  // reminder as a quote enters the window; a quote that's accepted/declined/expired
  // leaves the `submitted` set and stops matching.
  registerScanner('quote', async (ctx: TenantCtx): Promise<ScannedRow[]> => {
    const now = Date.now();
    const horizon = new Date(now + 48 * 3_600_000);
    const rows = await ctx.tx.quote.findMany({
      where: {
        status: 'submitted',
        validUntil: { not: null, gt: new Date(now), lte: horizon },
      },
      select: {
        id: true,
        quoteNumber: true,
        status: true,
        total: true,
        currency: true,
        validUntil: true,
        customerId: true,
        b2bAccountId: true,
      },
      take: 5_000,
    });
    return Promise.all(
      rows.map(async (q) => ({
        id: q.id,
        fields: {
          'quote.id': q.id,
          'quote.number': q.quoteNumber,
          'quote.status': q.status,
          'quote.total': num(q.total),
          'quote.currency': q.currency,
          'quote.validUntil': q.validUntil,
          ...(await resolveContact(ctx, { customerId: q.customerId, b2bAccountId: q.b2bAccountId })),
        },
      }))
    );
  });

  // Billing-document due/overdue (daily scan). Every open net-terms document with a
  // due date; the seed predicates select the exact window (`daysUntilDue == 3`,
  // `overdueDays == 7/14/30`) and partition user invoices vs B2B AR by `workflowSlug`.
  registerScanner('billing_document', async (ctx: TenantCtx): Promise<ScannedRow[]> => {
    const now = Date.now();
    const docs = await ctx.tx.billingDocument.findMany({
      where: {
        deletedAt: null,
        status: { in: ['unpaid', 'partial', 'overdue'] },
        dueAt: { not: null },
      },
      select: BILLING_SELECT,
      take: 5_000,
    });
    return Promise.all(
      docs.map(async (d) => ({
        id: d.id,
        fields: {
          ...billingFields(d as BillingLike, now),
          ...(await resolveContact(ctx, {
            customerId: d.customerId,
            b2bAccountId: d.b2bAccountId,
          })),
        },
      }))
    );
  });
}
