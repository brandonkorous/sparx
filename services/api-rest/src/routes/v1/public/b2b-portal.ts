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
//   GET /v1/public/b2b/portal/:accountId/quotes?tenant=&skip=&take=
//       → paged quote list

import type { FastifyPluginAsync, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { withTenant } from '@sparx/db';
import { inventoryService } from '@sparx/inventory';
import { ok, paged } from '@sparx/api-core/envelope';
import { unauthorized, forbidden, notFound } from '@sparx/api-core/errors';
import {
  verifyCustomerSession,
  SESSION_COOKIE_NAME,
  type CustomerAuthContext,
} from '@sparx/customer-auth';
import { resolveTenantId } from '../../../lib/public-commerce-context.js';

const PathAccountId = z.object({ accountId: z.string().uuid() });
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

/** Resolve the customer session cookie → customerId, or throw 401. */
async function requirePortalCustomer(
  request: FastifyRequest,
  ctx: CustomerAuthContext
): Promise<string> {
  const token = request.cookies[SESSION_COOKIE_NAME];
  if (!token) throw unauthorized('Not signed in.');
  const session = await verifyCustomerSession(ctx, token);
  if (!session) throw unauthorized('Session expired. Please sign in again.');
  return session.customerId;
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
        tx.b2BAccount.findFirst({
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
          where: { b2bAccountId: accountId, deletedAt: null },
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
        where: { customerId: { in: contactIds }, channel: 'b2b_portal' },
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

    const invoiceWhere = { b2bAccountId: accountId, deletedAt: null };
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

    const orderWhere = {
      customerId: { in: accountCustomerIds },
      channel: 'b2b_portal',
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
  app.get('/v1/public/b2b/portal/:accountId/quotes', async (request) => {
    const tenantId = await resolveTenantId(request);
    const ctx: CustomerAuthContext = { tenantId };
    const customerId = await requirePortalCustomer(request, ctx);
    const { accountId } = PathAccountId.parse(request.params);
    const role = await requireContactRole(ctx, customerId, accountId);
    const q = PagedQuery.parse(request.query);

    const quoteWhere =
      role === 'viewer' ? { b2bAccountId: accountId, customerId } : { b2bAccountId: accountId };

    const { quoteItems, quoteTotal } = await withTenant(ctx, async (tx) => {
      const [quoteItems, quoteTotal] = await Promise.all([
        tx.quote.findMany({
          where: quoteWhere,
          select: {
            id: true,
            quoteNumber: true,
            status: true,
            total: true,
            currency: true,
            validUntil: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'desc' },
          take: q.take,
          skip: q.skip,
        }),
        tx.quote.count({ where: quoteWhere }),
      ]);
      return { quoteItems, quoteTotal };
    });

    type QuoteRow = (typeof quoteItems)[number];

    return paged(
      quoteItems.map((q2: QuoteRow) => ({
        id: q2.id,
        quoteNumber: q2.quoteNumber,
        status: q2.status,
        totalCents: Math.round(Number(q2.total) * 100),
        currency: q2.currency,
        validUntil: q2.validUntil?.toISOString() ?? null,
        createdAt: q2.createdAt.toISOString(),
      })),
      { total: quoteTotal, skip: q.skip, take: q.take }
    );
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
