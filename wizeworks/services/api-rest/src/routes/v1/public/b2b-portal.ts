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
//          `b2b-quotes` workflow — docs/87 convergence), each with its
//          lines and the name of the site that issued it
//   POST /v1/public/b2b/portal/:accountId/quotes?tenant=
//        → submit a new RFQ in one go (a quote at "Submitted", with any PO
//          number and delivery needs). A request built up from the catalog
//          is in b2b-portal-buying.ts
//   POST /v1/public/b2b/portal/:accountId/quotes/:id/accept?tenant=
//        → customer accepts a merchant-priced quote ("Quoted" → "Accepted")
//   POST /v1/public/b2b/portal/:accountId/quotes/:id/decline?tenant=
//        → customer declines a merchant-priced quote ("Quoted" → "Declined")

import type { FastifyPluginAsync, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { withTenant } from '@wizeworks/db';
import { approvalService } from '@wizeworks/b2b';
import {
  accountOrderGate,
  b2bQuoteRequestService,
  b2bQuoteService,
  billingDocumentConversionService,
  billingDocumentService,
  billingDocumentStageService,
  billingRenderService,
  CrmValidationError,
  ISSUED_BILL_WHERE,
  taskService,
} from '@wizeworks/crm';
import { deliveryNeedsOf, poNumberOf } from '@wizeworks/crm-schemas';
import { B2B_QUOTE_WORKFLOW_SLUG } from '@wizeworks/crm-schemas/builtins';
import { inventoryService } from '@wizeworks/inventory';
import { commerceSiteService, pricingService } from '@wizeworks/commerce';
import { ok, paged } from '@wizeworks/api-core/envelope';
import { forbidden, notFound, validationError } from '@wizeworks/api-core/errors';
import { type CustomerAuthContext } from '@wizeworks/customer-auth';
import { resolveTenantId } from '../../../lib/public-commerce-context.js';
import { renderTenantInvoiceHtml, resolveInvoiceBrand } from '../../../lib/invoice-render.js';
import { requireCustomerId } from '../../../lib/customer-session.js';
import { requirePortalWriter } from '../../../lib/portal-writer.js';
import {
  accountPricer,
  portalDocumentPrintable,
  portalQuoteMoney,
  quotePricesShown,
} from '../../../lib/portal-quote-prices.js';

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
 *  in lib/customer-session: session → Better Auth user → per-site membership). A
 *  customer MCP OAuth bearer needs `b2b:read` to READ (docs/113 §5); a cookie
 *  session always passes. Sending, accepting and declining a quote change things
 *  (accepting places an order), so those take `requirePortalWriter` instead,
 *  which refuses a connected app (sparx persona issue 086). */
function requirePortalCustomer(request: FastifyRequest, ctx: CustomerAuthContext): Promise<string> {
  return requireCustomerId(request, ctx, 'b2b:read');
}

/** A task for whoever looks after an accepted quote whose order could not be
 *  made: the person the quote is assigned to, else the business's owner (the
 *  same fallback the automation engine uses for its tasks). */
async function tellTheBusinessTheOrderFailed(
  ctx: CustomerAuthContext,
  documentId: string,
  reason: string
): Promise<void> {
  const facts = await withTenant(ctx, async (tx) => {
    const doc = await tx.billingDocument.findUnique({
      where: { id: documentId },
      select: {
        number: true,
        assignedUserId: true,
        customerId: true,
        customer: { select: { firstName: true, lastName: true, email: true } },
      },
    });
    const owner = await tx.user.findFirst({
      where: { role: 'owner' },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    });
    return { doc, ownerId: owner?.id ?? null };
  });
  const assignee = facts.doc?.assignedUserId ?? facts.ownerId;
  if (!facts.doc || !assignee) return;
  const who =
    ([facts.doc.customer?.firstName, facts.doc.customer?.lastName].filter(Boolean).join(' ') ||
      facts.doc.customer?.email) ??
    'The buyer';
  const quote = facts.doc.number ? `quote ${facts.doc.number}` : 'a quote';
  await taskService.create(
    { tenantId: ctx.tenantId, userId: assignee },
    {
      title: `${who} accepted ${quote}, but its order could not be made`,
      description: `${reason} Open the quote and turn it into an order once this is sorted out.`,
      priority: 'high',
      assignedToUserId: assignee,
      customerId: facts.doc.customerId,
    }
  );
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

/**
 * The account's bills, as its buyer sees them: issued bills only, so a quote is
 * listed under Quotes and never as an unpaid invoice, and a draft the shop has
 * not sent is not shown (sparx persona issue 084).
 */
function accountBillsWhere(accountId: string) {
  return { companyId: accountId, deletedAt: null, ...ISSUED_BILL_WHERE };
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

    const [account, invoiceCounts, contactIds, settings] = await withTenant(ctx, (tx) =>
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
        // Bills only: a quote carries `unpaid` from the moment it exists, and
        // Renée's account read "2 unpaid invoices, $4,753.60" over one $678.00
        // invoice and an unaccepted quote (sparx persona issue 084).
        tx.billingDocument.groupBy({
          by: ['status'],
          where: accountBillsWhere(accountId),
          _count: { id: true },
          _sum: { balance: true },
        }),
        tx.b2bAccountContact
          .findMany({ where: { accountId, isActive: true }, select: { customerId: true } })
          .then((rows) => rows.map((r) => r.customerId)),
        // The currency the account's limit and bills are in: the business's own,
        // from its primary site. The page printed every figure in dollars
        // because nothing told it otherwise (sparx persona issue 085).
        commerceSiteService.resolveSettingsRow(tx, ctx.tenantId, null),
      ])
    );

    if (!account) throw notFound('B2B account not found');

    const recentOrders = await withTenant(ctx, (tx) =>
      tx.order.findMany({
        // No channel filter: B2B orders place through the same storefront
        // checkout everyone uses and carry channel='storefront', and an accepted
        // quote's order carries 'b2b_portal' (sparx persona issue 085). Both are
        // the account's; contactIds already scopes this to them.
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
        currency: settings?.defaultCurrency ?? 'USD',
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

    const invoiceWhere = accountBillsWhere(accountId);
    const { invoiceItems, invoiceTotal } = await withTenant(ctx, async (tx) => {
      const [invoiceItems, invoiceTotal] = await Promise.all([
        tx.billingDocument.findMany({
          where: invoiceWhere,
          select: {
            id: true,
            number: true,
            total: true,
            balance: true,
            // Every amount on the page was printed in dollars, because the
            // currency never left the server (sparx persona issue 085).
            currency: true,
            status: true,
            overdueDays: true,
            dueAt: true,
            paidAt: true,
            // The order it bills: the real link now (issue 084's migration),
            // the old metadata note for anything older.
            orderId: true,
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
          currency: inv.currency,
          status: inv.status,
          overdueDays: inv.overdueDays,
          orderId: inv.orderId ?? (typeof meta.orderId === 'string' ? meta.orderId : null),
          poNumber: poNumberOf(inv.metadata),
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
  // ── Print or save as PDF (sparx persona issue 085) ─────────────────────────
  // The /b2b page promises "The buyer gets a branded quote PDF". The buyer got
  // an email with the figures in it and nothing they could keep, print or file:
  // only the business could print the document. This is the SAME branded page
  // the business previews (its published print template, its logo, its frozen
  // letterhead), served to the buyer for their own account, which their browser
  // prints or saves as a PDF. The quote and invoice emails link to it.
  //
  // What a buyer may print: a quote once the business has priced it and made
  // the offer (`portalDocumentPrintable`), and an invoice that has been issued. A draft
  // is the business's working copy, not something it has said to them.
  app.get('/v1/public/b2b/portal/:accountId/documents/:id/print', async (request, reply) => {
    const tenantId = await resolveTenantId(request);
    const ctx: CustomerAuthContext = { tenantId };
    const customerId = await requirePortalCustomer(request, ctx);
    const { accountId, id } = PathAccountQuoteId.parse(request.params);
    const role = await requireContactRole(ctx, customerId, accountId);

    const doc = await withTenant(ctx, (tx) =>
      tx.billingDocument.findFirst({
        where: {
          id,
          companyId: accountId,
          deletedAt: null,
          // A viewer sees only their own quotes in the list; the print follows.
          OR: [
            {
              workflow: { slug: B2B_QUOTE_WORKFLOW_SLUG },
              ...(role === 'viewer' ? { customerId } : {}),
            },
            ISSUED_BILL_WHERE,
          ],
        },
        select: {
          id: true,
          issuedBy: true,
          propertyId: true,
          metadata: true,
          stage: { select: { name: true, stageType: true } },
          workflow: { select: { slug: true } },
        },
      })
    );
    // A quote prints once the offer is made, by the quotes list's own rule
    // (sparx persona issue 086); an issued bill always.
    if (
      !doc ||
      !portalDocumentPrintable({
        isQuote: doc.workflow.slug === B2B_QUOTE_WORKFLOW_SLUG,
        stage: doc.stage,
        metadata: doc.metadata,
      })
    ) {
      throw notFound('That document is not on this account.');
    }

    const data = await billingRenderService.buildRenderData(ctx, doc.id);
    const brand = await resolveInvoiceBrand(ctx, doc.issuedBy);
    const html = await renderTenantInvoiceHtml(ctx, data, brand, doc.propertyId);
    void reply.header('Content-Type', 'text/html; charset=utf-8');
    void reply.header(
      'Content-Disposition',
      `inline; filename="${data.number ?? 'document'}.html"`
    );
    return reply.send(html);
  });

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
            subtotal: true,
            discountTotal: true,
            taxTotal: true,
            shippingTotal: true,
            surchargeTotal: true,
            coreChargeTotal: true,
            total: true,
            currency: true,
            validUntil: true,
            // The buyer's own purchase order number, when one was given.
            metadata: true,
            createdAt: true,
            stage: { select: { name: true, customerLabel: true, stageType: true } },
            // The site that issued it, so the buyer reads who is working on it.
            property: { select: { name: true } },
            // What was asked for and, once priced, what it costs. Without these a
            // buyer could accept a total without seeing a single line of it
            // (sparx persona issue 084).
            lines: {
              select: {
                id: true,
                description: true,
                quantity: true,
                unitPrice: true,
                lineSubtotal: true,
                lineTotal: true,
                // A rebuilt part's refundable core deposit, per unit. It is in
                // the quote's total but not in any line's amount, so without it
                // the lines do not add up to the total.
                coreCharge: true,
              },
              orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
            },
            // The order an accepted quote became, and whether it is waiting for
            // sign-off, so the quote can say so (sparx persona issue 085).
            convertedOrder: { select: { id: true, orderNumber: true, status: true } },
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

    // Who each held order is waiting on, so its quote can name them rather than
    // the business (sparx persona issue 087). Read only for the few that are held.
    const heldSignOffs = new Map(
      await Promise.all(
        quoteItems.flatMap((q2: QuoteRow) =>
          q2.convertedOrder?.status === 'pending_approval'
            ? [
                approvalService
                  .heldOrderSignOff(ctx, q2.convertedOrder.id)
                  .then((signOff) => [q2.convertedOrder!.id, signOff] as const),
              ]
            : []
        )
      )
    );

    return paged(
      quoteItems.map((q2: QuoteRow) => {
        // No money before the business has made the offer: a request the buyer
        // sent starts at their account's price, and those are the business's
        // working figures until it prices and sends it (sparx persona issue 086).
        const money = portalQuoteMoney(
          {
            totalCents: Math.round(Number(q2.total) * 100),
            // The parts of `totalCents`, so the buyer can see how it adds up.
            totals: {
              subtotalCents: Math.round(Number(q2.subtotal) * 100),
              discountCents: Math.round(Number(q2.discountTotal) * 100),
              taxCents: Math.round(Number(q2.taxTotal) * 100),
              shippingCents: Math.round(Number(q2.shippingTotal) * 100),
              surchargeCents: Math.round(Number(q2.surchargeTotal) * 100),
              coreDepositCents: Math.round(Number(q2.coreChargeTotal) * 100),
            },
            lines: q2.lines.map((l) => ({
              id: l.id,
              description: l.description,
              quantity: Number(l.quantity),
              unitPriceCents: Math.round(Number(l.unitPrice) * 100),
              lineSubtotalCents: Math.round(Number(l.lineSubtotal) * 100),
              lineTotalCents: Math.round(Number(l.lineTotal) * 100),
              coreDepositCents:
                l.coreCharge == null ? null : Math.round(Number(l.coreCharge) * 100),
            })),
          },
          quotePricesShown(q2.stage, q2.metadata)
        );
        return {
          id: q2.id,
          number: q2.number,
          stage: q2.stage,
          totalCents: money.totalCents,
          totals: money.totals,
          currency: q2.currency,
          validUntil: q2.validUntil?.toISOString() ?? null,
          createdAt: q2.createdAt.toISOString(),
          poNumber: poNumberOf(q2.metadata),
          // When and where the buyer said they need it (sparx persona issue 086).
          delivery: deliveryNeedsOf(q2.metadata),
          shopName: q2.property.name,
          order: q2.convertedOrder
            ? {
                id: q2.convertedOrder.id,
                orderNumber: q2.convertedOrder.orderNumber,
                status: q2.convertedOrder.status,
                signOff: heldSignOffs.get(q2.convertedOrder.id) ?? null,
              }
            : null,
          lines: money.lines,
        };
      }),
      { total: quoteTotal, skip: q.skip, take: q.take }
    );
  });

  // Submit a new RFQ in one go: a quote at "Submitted" with the requested lines
  // (no prices yet; the business prices them on the dashboard). A request built
  // up from the catalog over time is `b2b-portal-buying.ts`; both make the quote
  // through `b2bQuoteRequestService.createRequestedQuote`, so both carry the PO
  // number and the delivery needs the same way (sparx persona issue 086).
  const SubmitQuoteBody = z.object({
    customerNote: z.string().max(2000).optional(),
    poNumber: z.string().trim().max(63).optional(),
    neededBy: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
    deliverTo: z.string().trim().max(1000).optional(),
    deliveryNotes: z.string().trim().max(2000).optional(),
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
    const customerId = await requirePortalWriter(request, ctx);
    const { accountId } = PathAccountId.parse(request.params);
    const role = await requireContactRole(ctx, customerId, accountId);
    requireQuoteWriter(role);
    const body = SubmitQuoteBody.parse(request.body);

    const quote = await b2bQuoteRequestService.createRequestedQuote(
      ctx,
      {
        customerId,
        accountId,
        customerNote: body.customerNote ?? null,
        poNumber: body.poNumber ?? null,
        delivery: {
          neededBy: body.neededBy ?? null,
          deliverTo: body.deliverTo ?? null,
          notes: body.deliveryNotes ?? null,
        },
        lines: body.lines.map((line) => ({
          variantId: line.variantId ?? null,
          description: line.description,
          quantity: line.quantity,
        })),
      },
      // Each catalog line starts at this account's price (sparx persona issue 086).
      { accountPrice: accountPricer(ctx, pricingService.resolveForAccount) }
    );

    reply.code(201);
    return ok(quote);
  });

  const AcceptDeclineBody = z.object({
    reason: z.string().max(500).optional(),
  });

  // ACCEPTING IS ORDERING. The /b2b page promises "On accept, the quote converts
  // straight to an order at the quoted prices", and accepting only moved the
  // quote to Accepted: the order waited for the business to notice a task and
  // press a button (sparx persona issue 085). Now the order is written here,
  // through the same rule checkout uses (`account-order-gate.ts`): it goes
  // ahead, or waits for the business to sign it off when it is over a spending
  // limit or the account's credit, and announces itself either way.
  //
  // An account the business has stopped (credit hold, suspended, not trading)
  // is refused BEFORE the quote moves, so a refusal leaves the quote standing
  // as it was rather than accepted with nothing behind it.
  app.post('/v1/public/b2b/portal/:accountId/quotes/:id/accept', async (request) => {
    const tenantId = await resolveTenantId(request);
    const ctx: CustomerAuthContext = { tenantId };
    const customerId = await requirePortalWriter(request, ctx);
    const { accountId, id } = PathAccountQuoteId.parse(request.params);
    const role = await requireContactRole(ctx, customerId, accountId);
    requireQuoteWriter(role);
    await assertOwnQuote(ctx, accountId, id);

    const account = await withTenant(ctx, (tx) =>
      tx.company.findUnique({ where: { id: accountId }, select: { status: true } })
    );
    const refusal = account ? accountOrderGate.accountStandingRefusal(account.status) : null;
    if (refusal) throw validationError(refusal);

    const acceptedStage = await withTenant(ctx, (tx) =>
      b2bQuoteService.b2bQuoteStageByName(tx, ctx.tenantId, 'Accepted')
    );
    const doc = await billingDocumentStageService.advance(ctx, id, { stageId: acceptedStage.id });

    try {
      const converted = await billingDocumentConversionService.convertToOrder(ctx, id, {
        channel: 'b2b_portal',
      });
      return ok({
        id: doc.id,
        stageId: doc.stageId,
        order: {
          id: converted.order.id,
          orderNumber: converted.order.orderNumber,
          held: converted.held.length > 0,
          // Who the held order is waiting on (sparx persona issue 087).
          signOff:
            converted.held.length > 0
              ? await approvalService.heldOrderSignOff(ctx, converted.order.id)
              : null,
        },
        orderProblem: null,
      });
    } catch (err) {
      if (!(err instanceof CrmValidationError)) throw err;
      // The quote IS accepted; only the order is missing. Somebody at the
      // business has to know, because nothing else will tell them: the order
      // they would have been told about does not exist.
      request.log.warn(
        { err, tenantId, documentId: id },
        'b2b-portal: quote accepted but the order could not be made'
      );
      await tellTheBusinessTheOrderFailed(ctx, id, err.message);
      return ok({
        id: doc.id,
        stageId: doc.stageId,
        order: null,
        orderProblem: err.message,
      });
    }
  });

  app.post('/v1/public/b2b/portal/:accountId/quotes/:id/decline', async (request) => {
    const tenantId = await resolveTenantId(request);
    const ctx: CustomerAuthContext = { tenantId };
    const customerId = await requirePortalWriter(request, ctx);
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
