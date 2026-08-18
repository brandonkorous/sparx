// B2B customer portal — authenticated-customer surface for B2B account data.
// (docs/10 §11, docs/64 B2B Ph5)
//
// Uses the same httpOnly `sparx_customer_session` cookie as the storefront
// account endpoints. After session verification the handler checks
// `b2b_account_contacts` to confirm the customer has an active role on the
// requested account (contact_role gate). Contacts see only their own account's
// data; any cross-account attempt returns 403.
//
//   GET /v1/public/b2b/portal?tenant=<slug>
//       → [{accountId, companyName, role, creditLimit, creditUsed, status}]
//
//   GET /v1/public/b2b/portal/:accountId/summary?tenant=
//       → { account, invoiceSummary, recentOrders }
//
//   GET /v1/public/b2b/portal/:accountId/invoices?tenant=&skip=&take=
//       → paged invoice list
//
//   GET /v1/public/b2b/portal/:accountId/orders?tenant=&skip=&take=
//       → paged order list scoped to this customer's orders on the account
//
//   GET  /v1/public/b2b/portal/:accountId/quotes?tenant=&skip=&take=
//        → paged quote list (a quote IS a BillingDocument on the system
//          `b2b-quotes` workflow — docs/87 convergence)
//   POST /v1/public/b2b/portal/:accountId/quotes?tenant=
//        → submit a new RFQ (creates a draft document + its lines, then
//          advances it straight to "Submitted")
//   POST /v1/public/b2b/portal/:accountId/quotes/:id/accept?tenant=
//        → customer accepts a merchant-priced quote ("Quoted" → "Accepted")
//   POST /v1/public/b2b/portal/:accountId/quotes/:id/decline?tenant=
//        → customer declines a merchant-priced quote ("Quoted" → "Declined")

import type { FastifyPluginAsync, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { withTenant } from '@wizeworks/db';
import {
  b2bQuoteService,
  billingDocumentService,
  billingDocumentStageService,
  billingLineService,
} from '@wizeworks/crm';
import { B2B_QUOTE_WORKFLOW_SLUG } from '@wizeworks/crm-schemas/builtins';
import { inventoryService } from '@wizeworks/inventory';
import { ok, paged } from '@wizeworks/api-core/envelope';
import { forbidden, notFound } from '@wizeworks/api-core/errors';
import { type CustomerAuthContext } from '@wizeworks/customer-auth';
import { resolveTenantId } from '../../../lib/public-commerce-context.js';
import { requireCustomerId } from '../../../lib/customer-session.js';

// Contact roles allowed to submit/accept/decline a quote (docs/64 §5.2) —
// `approver`/`viewer` are read-only for quotes, same as for orders/invoices.
const QUOTE_WRITER_ROLES = new Set(['primary_contact', 'buyer']);

function requireQuoteWriter(role: string): void {
  if (!QUOTE_WRITER_ROLES.has(role)) {
    throw forbidden('Your role on this account cannot submit or respond to quotes.');
  }
}

const PathAccountId = z.object({ accountId: z.string().uuid() });
const PathAccountQuoteId = z.object({ accountId: z.string().uuid(), id: z.string().uuid() });
const PagedQuery = z.object({
  take: z.coerce.number().int().min(1).max(100).default(20),
  skip: z.coerce.number().int().min(0).default(0),
});
const AvailabilityBody = z.object({
  variantIds: z.array(z.string().uuid()).min(1).max(200),
  warehouseId: z.string().uuid().optional(),
});
const HoldsQuery = z.object({
  status: z.enum(['active', 'released', 'consumed']).optional(),
  take: z.coerce.number().int().min(1).max(100).default(20),
  skip: z.coerce.number().int().min(0).default(0),
});

/** The signed-in customer id for the active site, or 401 (docs/27 v2 — resolved
 *  in lib/customer-session: session → Better Auth user → per-site membership). The
 *  whole portal is read-only, so a customer MCP OAuth bearer needs `b2b:read`
 *  (docs/113 §5); a cookie session always passes. */
function requirePortalCustomer(request: FastifyRequest, ctx: CustomerAuthContext): Promise<string> {
  return requireCustomerId(request, ctx, 'b2b:read');
}

/** Verify the customer has an active contact role on `accountId` and return the
 *  role string. Throws 403 if no active contact row exists. */
async function requireContactRole(
  ctx: CustomerAuthContext,
  customerId: string,
  accountId: string
): Promise<string> {
  const contact = await withTenant(ctx, (tx) =>
    tx.b2bAccountContact.findFirst({
      where: { customerId, accountId, isActive: true },
      select: { role: true },
    })
  );
  if (!contact) throw forbidden('You do not have access to this B2B account.');
  return contact.role;
}

/** Guard against an IDOR on quote id — confirm `id` is actually a
 *  `b2b-quotes`-workflow document belonging to `accountId` before any
 *  lifecycle write, so a contact can't act on another account's document by
 *  guessing/passing an arbitrary id. */
async function assertOwnQuote(
  ctx: CustomerAuthContext,
  accountId: string,
  id: string
): Promise<void> {
  const doc = await withTenant(ctx, (tx) =>
    tx.billingDocument.findFirst({
      where: {
        id,
        deletedAt: null,
        companyId: accountId,
        workflow: { slug: B2B_QUOTE_WORKFLOW_SLUG },
      },
      select: { id: true },
    })
  );
  if (!doc) throw notFound('quote');
}

// eslint-disable-next-line @typescript-eslint/require-await -- FastifyPluginAsync signature
const b2bPortalRoutes: FastifyPluginAsync = async (app) => {
  // ── List accounts the customer has access to ──────────────────────────────
  app.get('/v1/public/b2b/portal', async (request) => {
    const tenantId = await resolveTenantId(request);
    const ctx: CustomerAuthContext = { tenantId };
    const customerId = await requirePortalCustomer(request, ctx);

    const contacts = await withTenant(ctx, (tx) =>
      tx.b2bAccountContact.findMany({
        where: { customerId, isActive: true },
        include: {
          account: {
            select: {
              id: true,
              companyName: true,
              creditLimit: true,
              creditUsed: true,
              status: true,
              paymentTerms: true,
            },
          },
        },
        orderBy: { createdAt: 'asc' },
      })
    );

    const accounts = contacts.map((c) => ({
      accountId: c.accountId,
      companyName: c.account.companyName,
      role: c.role,
      creditLimit: Number(c.account.creditLimit),
      creditUsed: Number(c.account.creditUsed),
      creditAvailable: Math.max(0, Number(c.account.creditLimit) - Number(c.account.creditUsed)),
      status: c.account.status,
      paymentTerms: c.account.paymentTerms,
    }));

    return ok({ accounts });
  });

  // ── Account summary ───────────────────────────────────────────────────────
  app.get('/v1/public/b2b/portal/:accountId/summary', async (request) => {
    const tenantId = await resolveTenantId(request);
    const ctx: CustomerAuthContext = { tenantId };
    const customerId = await requirePortalCustomer(request, ctx);
    const { accountId } = PathAccountId.parse(request.params);
    const role = await requireContactRole(ctx, customerId, accountId);

    const [account, invoiceCounts, contactIds] = await withTenant(ctx, (tx) =>
      Promise.all([
        tx.company.findFirst({
          where: { id: accountId, deletedAt: null },
          select: {
            id: true,
            companyName: true,
            creditLimit: true,
            creditUsed: true,
            status: true,
            paymentTerms: true,
            discountPercent: true,
          },
        }),
        // Net-terms AR now lives on billing_documents (docs/87 §15). Summarise the
        // account's receivables by status, summing the OPEN balance per bucket.
        tx.billingDocument.groupBy({
          by: ['status'],
          where: { companyId: accountId, deletedAt: null },
          _count: { id: true },
          _sum: { balance: true },
        }),
        tx.b2bAccountContact
          .findMany({ where: { accountId, isActive: true }, select: { customerId: true } })
          .then((rows) => rows.map((r) => r.customerId)),
      ])
    );

    if (!account) throw notFound('B2B account not found');

    const recentOrders = await withTenant(ctx, (tx) =>
      tx.order.findMany({
        // No channel filter: B2B orders place through the same storefront
        // checkout everyone uses and carry channel='storefront', never
        // 'b2b_portal' (no code path sets that value) — contactIds already
        // scopes this to the account's own orders.
        where: { customerId: { in: contactIds } },
        select: {
          id: true,
          orderNumber: true,
          status: true,
          total: true,
          currency: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 5,
      })
    );

    const invoiceSummary = {
      unpaidCount: 0,
      unpaidCents: 0,
      overdueCount: 0,
      overdueCents: 0,
      paidCount: 0,
    };
    for (const g of invoiceCounts) {
      const balanceCents = Math.round(Number(g._sum.balance ?? 0) * 100);
      if (g.status === 'unpaid' || g.status === 'partial') {
        invoiceSummary.unpaidCount += g._count.id;
        invoiceSummary.unpaidCents += balanceCents;
      } else if (g.status === 'overdue') {
        invoiceSummary.overdueCount = g._count.id;
        invoiceSummary.overdueCents = balanceCents;
      } else if (g.status === 'paid') {
        invoiceSummary.paidCount = g._count.id;
      }
    }

    return ok({
      account: {
        ...account,
        creditLimit: Number(account.creditLimit),
        creditUsed: Number(account.creditUsed),
        creditAvailable: Math.max(0, Number(account.creditLimit) - Number(account.creditUsed)),
        discountPercent: Number(account.discountPercent),
        role,
      },
      invoiceSummary,
      recentOrders: recentOrders.map((o) => ({
        id: o.id,
        orderNumber: o.orderNumber,
        status: o.status,
        totalCents: Math.round(Number(o.total) * 100),
        currency: o.currency,
        createdAt: o.createdAt.toISOString(),
      })),
    });
  });

  // ── Invoices ──────────────────────────────────────────────────────────────
  app.get('/v1/public/b2b/portal/:accountId/invoices', async (request) => {
    const tenantId = await resolveTenantId(request);
    const ctx: CustomerAuthContext = { tenantId };
    const customerId = await requirePortalCustomer(request, ctx);
    const { accountId } = PathAccountId.parse(request.params);
    await requireContactRole(ctx, customerId, accountId);
    const q = PagedQuery.parse(request.query);

    const invoiceWhere = { companyId: accountId, deletedAt: null };
    const { invoiceItems, invoiceTotal } = await withTenant(ctx, async (tx) => {
      const [invoiceItems, invoiceTotal] = await Promise.all([
        tx.billingDocument.findMany({
          where: invoiceWhere,
          select: {
            id: true,
            number: true,
            total: true,
            balance: true,
            status: true,
            overdueDays: true,
            dueAt: true,
            paidAt: true,
            metadata: true,
            notes: true,
            createdAt: true,
          },
          orderBy: { dueAt: 'asc' },
          take: q.take,
          skip: q.skip,
        }),
        tx.billingDocument.count({ where: invoiceWhere }),
      ]);
      return { invoiceItems, invoiceTotal };
    });

    type InvoiceRow = (typeof invoiceItems)[number];

    return paged(
      invoiceItems.map((inv: InvoiceRow) => {
        const meta = (inv.metadata ?? {}) as Record<string, unknown>;
        return {
          id: inv.id,
          invoiceNumber: inv.number ?? '',
          amountCents: Math.round(Number(inv.total) * 100),
          balanceCents: Math.round(Number(inv.balance) * 100),
          status: inv.status,
          overdueDays: inv.overdueDays,
          orderId: typeof meta.orderId === 'string' ? meta.orderId : null,
          notes: inv.notes,
          dueAt: inv.dueAt ? inv.dueAt.toISOString() : null,
          paidAt: inv.paidAt ? inv.paidAt.toISOString() : null,
          createdAt: inv.createdAt.toISOString(),
        };
      }),
      { total: invoiceTotal, skip: q.skip, take: q.take }
    );
  });

  // ── Orders for this account ───────────────────────────────────────────────
  app.get('/v1/public/b2b/portal/:accountId/orders', async (request) => {
    const tenantId = await resolveTenantId(request);
    const ctx: CustomerAuthContext = { tenantId };
    const customerId = await requirePortalCustomer(request, ctx);
    const { accountId } = PathAccountId.parse(request.params);
    const role = await requireContactRole(ctx, customerId, accountId);
    const q = PagedQuery.parse(request.query);

    // Orders are linked to customers, not accounts directly. Resolve all active
    // contact customer IDs for this account first, then scope the order query.
    // Viewers see only their own orders; other roles see all account contacts' orders.
    const accountCustomerIds = await withTenant(ctx, (tx) =>
      role === 'viewer'
        ? Promise.resolve([customerId])
        : tx.b2bAccountContact
            .findMany({
              where: { accountId, isActive: true },
              select: { customerId: true },
            })
            .then((rows) => rows.map((r) => r.customerId))
    );

    // No channel filter: B2B orders place through the same storefront checkout
    // everyone uses and carry channel='storefront', never 'b2b_portal' (no code
    // path sets that value) — accountCustomerIds already scopes this correctly.
    const orderWhere = {
      customerId: { in: accountCustomerIds },
    };

    const { orderItems, orderTotal } = await withTenant(ctx, async (tx) => {
      const [orderItems, orderTotal] = await Promise.all([
        tx.order.findMany({
          where: orderWhere,
          select: {
            id: true,
            orderNumber: true,
            status: true,
            total: true,
            currency: true,
            createdAt: true,
            customer: { select: { id: true, firstName: true, lastName: true, email: true } },
          },
          orderBy: { createdAt: 'desc' },
          take: q.take,
          skip: q.skip,
        }),
        tx.order.count({ where: orderWhere }),
      ]);
      return { orderItems, orderTotal };
    });

    type OrderRow = (typeof orderItems)[number];

    return paged(
      orderItems.map((o: OrderRow) => ({
        id: o.id,
        orderNumber: o.orderNumber,
        status: o.status,
        totalCents: Math.round(Number(o.total) * 100),
        currency: o.currency,
        createdAt: o.createdAt.toISOString(),
        customerName:
          [o.customer?.firstName, o.customer?.lastName].filter(Boolean).join(' ') || null,
        customerEmail: o.customer?.email ?? null,
      })),
      { total: orderTotal, skip: q.skip, take: q.take }
    );
  });

  // ── Quotes ────────────────────────────────────────────────────────────────
  // A quote IS a BillingDocument on the system `b2b-quotes` workflow (docs/87
  // convergence) — there is no separate quote entity anymore.
  app.get('/v1/public/b2b/portal/:accountId/quotes', async (request) => {
    const tenantId = await resolveTenantId(request);
    const ctx: CustomerAuthContext = { tenantId };
    const customerId = await requirePortalCustomer(request, ctx);
    const { accountId } = PathAccountId.parse(request.params);
    const role = await requireContactRole(ctx, customerId, accountId);
    const q = PagedQuery.parse(request.query);

    const quoteWhere = {
      deletedAt: null,
      workflow: { slug: B2B_QUOTE_WORKFLOW_SLUG },
      companyId: accountId,
      ...(role === 'viewer' ? { customerId } : {}),
    };

    const { quoteItems, quoteTotal } = await withTenant(ctx, async (tx) => {
      const [quoteItems, quoteTotal] = await Promise.all([
        tx.billingDocument.findMany({
          where: quoteWhere,
          select: {
            id: true,
            number: true,
            total: true,
            currency: true,
            validUntil: true,
            createdAt: true,
            stage: { select: { name: true, customerLabel: true, stageType: true } },
          },
          orderBy: { createdAt: 'desc' },
          take: q.take,
          skip: q.skip,
        }),
        tx.billingDocument.count({ where: quoteWhere }),
      ]);
      return { quoteItems, quoteTotal };
    });

    type QuoteRow = (typeof quoteItems)[number];

    return paged(
      quoteItems.map((q2: QuoteRow) => ({
        id: q2.id,
        number: q2.number,
        stage: q2.stage,
        totalCents: Math.round(Number(q2.total) * 100),
        currency: q2.currency,
        validUntil: q2.validUntil?.toISOString() ?? null,
        createdAt: q2.createdAt.toISOString(),
      })),
      { total: quoteTotal, skip: q.skip, take: q.take }
    );
  });

  // Submit a new RFQ — creates a draft document + its requested lines (no
  // pricing yet; the merchant prices them in the "respond" step on the
  // dashboard), then advances it straight to "Submitted" so it shows up in the
  // merchant's queue immediately.
  const SubmitQuoteBody = z.object({
    customerNote: z.string().max(2000).optional(),
    lines: z
      .array(
        z.object({
          description: z.string().min(1).max(500),
          quantity: z.number().positive().default(1),
          variantId: z.string().uuid().optional(),
        })
      )
      .min(1)
      .max(50),
  });

  app.post('/v1/public/b2b/portal/:accountId/quotes', async (request, reply) => {
    const tenantId = await resolveTenantId(request);
    const ctx: CustomerAuthContext = { tenantId };
    const customerId = await requirePortalCustomer(request, ctx);
    const { accountId } = PathAccountId.parse(request.params);
    const role = await requireContactRole(ctx, customerId, accountId);
    requireQuoteWriter(role);
    const body = SubmitQuoteBody.parse(request.body);

    const { draftStage, submittedStage } = await withTenant(ctx, async (tx) => ({
      draftStage: await b2bQuoteService.b2bQuoteDraftStage(tx, ctx.tenantId),
      submittedStage: await b2bQuoteService.b2bQuoteStageByName(tx, ctx.tenantId, 'Submitted'),
    }));

    let doc = await billingDocumentService.create(ctx, {
      workflowId: draftStage.workflowId,
      stageId: draftStage.id,
      customerId,
      companyId: accountId,
      ...(body.customerNote !== undefined ? { customerNote: body.customerNote } : {}),
    });

    // A requested line has no price yet — the merchant sets it while
    // responding. `addLine`'s default `flat` pricing mode requires an
    // explicit `unitPrice` and throws without one, so a product-linked line
    // uses the `catalog` line type instead (auto-resolves to the variant's
    // list price, a sensible reference the merchant can override) and a
    // free-text line explicitly passes `unitPrice: 0` (nothing to reference).
    for (const line of body.lines) {
      doc = await billingLineService.addLine(ctx, doc.id, {
        description: line.description,
        quantity: line.quantity,
        ...(line.variantId
          ? { variantId: line.variantId, lineTypeKey: 'catalog' }
          : { unitPrice: 0 }),
      });
    }

    doc = await billingDocumentStageService.advance(ctx, doc.id, { stageId: submittedStage.id });

    reply.code(201);
    return ok({ id: doc.id, number: doc.number });
  });

  const AcceptDeclineBody = z.object({
    reason: z.string().max(500).optional(),
  });

  app.post('/v1/public/b2b/portal/:accountId/quotes/:id/accept', async (request) => {
    const tenantId = await resolveTenantId(request);
    const ctx: CustomerAuthContext = { tenantId };
    const customerId = await requirePortalCustomer(request, ctx);
    const { accountId, id } = PathAccountQuoteId.parse(request.params);
    const role = await requireContactRole(ctx, customerId, accountId);
    requireQuoteWriter(role);
    await assertOwnQuote(ctx, accountId, id);

    const acceptedStage = await withTenant(ctx, (tx) =>
      b2bQuoteService.b2bQuoteStageByName(tx, ctx.tenantId, 'Accepted')
    );
    const doc = await billingDocumentStageService.advance(ctx, id, { stageId: acceptedStage.id });
    return ok({ id: doc.id, stageId: doc.stageId });
  });

  app.post('/v1/public/b2b/portal/:accountId/quotes/:id/decline', async (request) => {
    const tenantId = await resolveTenantId(request);
    const ctx: CustomerAuthContext = { tenantId };
    const customerId = await requirePortalCustomer(request, ctx);
    const { accountId, id } = PathAccountQuoteId.parse(request.params);
    const role = await requireContactRole(ctx, customerId, accountId);
    requireQuoteWriter(role);
    await assertOwnQuote(ctx, accountId, id);
    const body = AcceptDeclineBody.parse(request.body ?? {});

    const declinedStage = await withTenant(ctx, (tx) =>
      b2bQuoteService.b2bQuoteStageByName(tx, ctx.tenantId, 'Declined')
    );
    if (body.reason !== undefined) {
      await billingDocumentService.update(ctx, id, { declinedReason: body.reason });
    }
    const doc = await billingDocumentStageService.advance(ctx, id, { stageId: declinedStage.id });
    return ok({ id: doc.id, stageId: doc.stageId });
  });

  // ── Account-scoped availability (docs/100 P6d) ─────────────────────────────
  // The account sees real master availability + its own holds + purchasing limits.
  app.post('/v1/public/b2b/portal/:accountId/availability', async (request) => {
    const tenantId = await resolveTenantId(request);
    const ctx: CustomerAuthContext = { tenantId };
    const customerId = await requirePortalCustomer(request, ctx);
    const { accountId } = PathAccountId.parse(request.params);
    await requireContactRole(ctx, customerId, accountId);
    const body = AvailabilityBody.parse(request.body);

    const rows = await inventoryService.accountAvailability(ctx, {
      accountId,
      variantIds: body.variantIds,
      ...(body.warehouseId ? { warehouseId: body.warehouseId } : {}),
    });
    return ok({ availability: rows });
  });

  // ── The account's fleet / work-order holds ─────────────────────────────────
  app.get('/v1/public/b2b/portal/:accountId/holds', async (request) => {
    const tenantId = await resolveTenantId(request);
    const ctx: CustomerAuthContext = { tenantId };
    const customerId = await requirePortalCustomer(request, ctx);
    const { accountId } = PathAccountId.parse(request.params);
    await requireContactRole(ctx, customerId, accountId);
    const q = HoldsQuery.parse(request.query);

    const { items, total } = await inventoryService.listFleetHolds(ctx, {
      accountId,
      ...(q.status ? { status: q.status } : {}),
      take: q.take,
      skip: q.skip,
    });
    return paged(items, { total, skip: q.skip, take: q.take });
  });
};

export default b2bPortalRoutes;
