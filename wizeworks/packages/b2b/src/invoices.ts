// B2B invoices — net-terms accounts-receivable (docs/10 §9, docs/87 §15).
// Extracted from the api-rest routes.
//
// A B2B receivable is a BillingDocument on the system `net-terms-ar` workflow —
// NOT the legacy `b2b_invoices` table. These functions preserve the historical
// "invoice" projection the dashboard + portal read (status vocabulary: unpaid |
// partial | paid | overdue | void) while delegating the money authority to
// @wizeworks/crm's b2bArService + billingPaymentService (recomputeTotals re-syncs
// credit_used on every mutation). Manual create emits `b2b.invoice.created`; the
// caller publishes it once its transaction has committed.

import { z } from 'zod';
import { withTenant, type Prisma } from '@wizeworks/db';
import { b2bArService, billingPaymentService } from '@wizeworks/crm';
import { notFound, badRequest } from '@wizeworks/api-core/errors';
import type { B2bContext } from './context.js';
import type { PendingEvent } from './events.js';

// ── Schemas (shared with the REST routes) ─────────────────────────────────────

export const InvoiceListQuery = z.object({
  account_id: z.string().uuid().optional(),
  status: z.enum(['unpaid', 'partial', 'paid', 'overdue', 'void']).optional(),
  take: z.coerce.number().int().min(1).max(250).default(50),
  skip: z.coerce.number().int().min(0).default(0),
});

export const InvoiceCreateBody = z.object({
  accountId: z.string().uuid(),
  orderId: z.string().uuid().optional(),
  invoiceNumber: z.string().min(1).max(63),
  amountCents: z.number().int().min(1),
  dueAt: z.string().datetime(),
  notes: z.string().max(2000).optional(),
});

export const InvoiceUpdateBody = z.object({
  dueAt: z.string().datetime().optional(),
  notes: z.string().max(2000).optional(),
});

export const InvoiceMarkPaidBody = z.object({
  paidMethod: z.enum(['check', 'ach', 'wire', 'credit_card', 'other']),
  notes: z.string().max(2000).optional(),
});

export const InvoiceWriteOffBody = z.object({ notes: z.string().max(2000).optional() });

export type InvoiceListInput = z.infer<typeof InvoiceListQuery>;
export type InvoiceCreateInput = z.infer<typeof InvoiceCreateBody>;

// Map the caller-facing paid-method vocabulary to the billing payment-method enum.
const PAID_METHOD_MAP: Record<string, string> = {
  check: 'check',
  ach: 'ach',
  wire: 'wire',
  credit_card: 'card',
  other: 'other',
};

const INVOICE_INCLUDE = {
  company: { select: { id: true, companyName: true, paymentTerms: true } },
  payments: {
    orderBy: { receivedAt: 'desc' },
    include: { recordedBy: { select: { id: true, name: true, email: true } } },
  },
} satisfies Prisma.BillingDocumentInclude;

type InvoiceDoc = Prisma.BillingDocumentGetPayload<{ include: typeof INVOICE_INCLUDE }>;

function cents(d: Prisma.Decimal | number): number {
  return Math.round(Number(d) * 100);
}

function mapInvoice(doc: InvoiceDoc) {
  const meta = (doc.metadata ?? {}) as Record<string, unknown>;
  const lastPayment = doc.payments.find((p) => p.kind !== 'refund') ?? doc.payments[0] ?? null;
  return {
    id: doc.id,
    accountId: doc.companyId,
    orderId: typeof meta.orderId === 'string' ? meta.orderId : null,
    invoiceNumber: doc.number ?? '',
    amountCents: cents(doc.total),
    balanceCents: cents(doc.balance),
    status: doc.status,
    overdueDays: doc.overdueDays,
    dueAt: doc.dueAt ? doc.dueAt.toISOString() : null,
    paidAt: doc.paidAt ? doc.paidAt.toISOString() : null,
    paidMethod: doc.status === 'paid' ? (lastPayment?.method ?? null) : null,
    notes: doc.notes,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
    account: doc.company
      ? {
          id: doc.company.id,
          companyName: doc.company.companyName,
          paymentTerms: doc.company.paymentTerms,
        }
      : null,
    paidBy: lastPayment?.recordedBy
      ? {
          id: lastPayment.recordedBy.id,
          name: lastPayment.recordedBy.name,
          email: lastPayment.recordedBy.email,
        }
      : null,
  };
}

export type InvoiceView = ReturnType<typeof mapInvoice>;

/** Load + project one invoice, scoped to B2B-AR documents. */
async function loadInvoice(ctx: B2bContext, id: string): Promise<InvoiceView | null> {
  const doc = await withTenant(ctx, (tx) =>
    tx.billingDocument.findFirst({
      where: { id, companyId: { not: null }, deletedAt: null },
      include: INVOICE_INCLUDE,
    })
  );
  return doc ? mapInvoice(doc) : null;
}

// ── Reads ──────────────────────────────────────────────────────────────────────

export async function listInvoices(ctx: B2bContext, input: InvoiceListInput) {
  const where: Prisma.BillingDocumentWhereInput = {
    companyId: input.account_id ?? { not: null },
    deletedAt: null,
    ...(input.status ? { status: input.status } : {}),
  };

  const { items, total } = await withTenant(ctx, async (tx) => {
    const [items, total] = await Promise.all([
      tx.billingDocument.findMany({
        where,
        include: INVOICE_INCLUDE,
        orderBy: { dueAt: 'asc' },
        take: input.take,
        skip: input.skip,
      }),
      tx.billingDocument.count({ where }),
    ]);
    return { items, total };
  });

  return { items: items.map(mapInvoice), total, skip: input.skip, take: input.take };
}

export async function getInvoice(ctx: B2bContext, id: string): Promise<InvoiceView> {
  const invoice = await loadInvoice(ctx, id);
  if (!invoice) throw notFound('Invoice not found');
  return invoice;
}

// ── Writes ──────────────────────────────────────────────────────────────────

export interface CreateInvoiceResult {
  invoice: InvoiceView | null;
  events: PendingEvent[];
}

/**
 * Create a manual net-terms AR invoice. `propertyId` is the issuing site (docs/131
 * §3.6) — it decides the numbering sequence and the letterhead frozen at finalize.
 * The caller resolves it (REST: the active-site header; MCP: an explicit site or
 * the primary).
 */
export async function createInvoice(
  ctx: B2bContext,
  rawInput: unknown,
  propertyId: string
): Promise<CreateInvoiceResult> {
  const body = InvoiceCreateBody.parse(rawInput);

  const doc = await b2bArService.createOrderArDocument(ctx, {
    companyId: body.accountId,
    propertyId,
    orderId: body.orderId ?? null,
    amount: body.amountCents / 100,
    dueAt: new Date(body.dueAt),
    numberOverride: body.invoiceNumber,
    notes: body.notes ?? null,
    description: 'Invoice',
  });

  const invoice = await loadInvoice(ctx, doc.id);

  return {
    invoice,
    events: [
      {
        type: 'b2b.invoice.created',
        payload: {
          invoiceId: doc.id,
          accountId: body.accountId,
          amountCents: body.amountCents,
          dueAt: body.dueAt,
        },
      },
    ],
  };
}

export async function updateInvoice(
  ctx: B2bContext,
  id: string,
  rawInput: unknown
): Promise<InvoiceView | null> {
  const body = InvoiceUpdateBody.parse(rawInput);

  await b2bArService.updateArDocument(ctx, id, {
    ...(body.dueAt !== undefined ? { dueAt: new Date(body.dueAt) } : {}),
    ...(body.notes !== undefined ? { notes: body.notes } : {}),
  });

  return loadInvoice(ctx, id);
}

/** Record a single payment clearing the open balance, then lift the account's
 *  credit hold if it now has no open receivables. */
export async function markInvoicePaid(
  ctx: B2bContext,
  id: string,
  rawInput: unknown
): Promise<InvoiceView | null> {
  const body = InvoiceMarkPaidBody.parse(rawInput);

  const before = await withTenant(ctx, (tx) =>
    tx.billingDocument.findFirst({
      where: { id, companyId: { not: null }, deletedAt: null },
      select: { id: true, status: true, balance: true, companyId: true, notes: true },
    })
  );
  if (!before) throw notFound('Invoice not found');
  if (before.status === 'paid') throw badRequest('Invoice is already paid');
  if (before.status === 'void') throw badRequest('Cannot pay a voided invoice');

  const balance = Number(before.balance);
  if (balance > 0) {
    await billingPaymentService.recordPayment(ctx, id, {
      kind: 'payment',
      method: PAID_METHOD_MAP[body.paidMethod] ?? 'other',
      amount: balance,
      ...(body.notes !== undefined ? { note: body.notes } : {}),
    });
  }

  // Lift credit_hold if the account now has no open receivables.
  const liftAccountId = before.companyId;
  if (liftAccountId) {
    await withTenant(ctx, async (tx) => {
      const open = await tx.billingDocument.count({
        where: {
          companyId: liftAccountId,
          deletedAt: null,
          status: { in: ['unpaid', 'partial', 'overdue'] },
        },
      });
      if (open === 0) {
        await tx.company.updateMany({
          where: { id: liftAccountId, status: 'credit_hold' },
          data: { status: 'active' },
        });
      }
    });
  }

  return loadInvoice(ctx, id);
}

/** Void the receivable (write-off). */
export async function writeOffInvoice(
  ctx: B2bContext,
  id: string,
  rawInput: unknown
): Promise<InvoiceView | null> {
  const body = InvoiceWriteOffBody.parse(rawInput);

  const before = await withTenant(ctx, (tx) =>
    tx.billingDocument.findFirst({
      where: { id, companyId: { not: null }, deletedAt: null },
      select: { id: true, status: true },
    })
  );
  if (!before) throw notFound('Invoice not found');
  if (before.status === 'paid') throw badRequest('Cannot write off a paid invoice');
  if (before.status === 'void') throw badRequest('Invoice is already written off');

  await b2bArService.voidArDocument(ctx, id, body.notes !== undefined ? { note: body.notes } : {});

  return loadInvoice(ctx, id);
}
