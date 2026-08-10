// B2B quotes — a thin scoped-read view over BillingDocument (docs/10 §7,
// docs/87 convergence). A B2B quote/RFQ IS a BillingDocument on the system
// `b2b-quotes` workflow (crm-schemas/builtins/invoicing.ts) — there is no
// separate quote entity or lifecycle anymore. Creating a quote, pricing its
// lines, and advancing it through Draft → Submitted → ... → Accepted/Declined
// all go through the generic `/v1/invoicing/documents` endpoints (create,
// lines, /advance) — this file only projects a B2B-scoped list/detail read,
// mirroring the AR projection b2b/invoices.ts already establishes.
//
//   GET  /v1/b2b/quotes      → list (filtered by account, scoped to the
//                              b2b-quotes workflow)
//   GET  /v1/b2b/quotes/:id  → fetch one

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { withTenant, type Prisma } from '@sparx/db';
import { B2B_QUOTE_WORKFLOW_SLUG } from '@sparx/crm-schemas/builtins';
import { ok, paged } from '@sparx/api-core/envelope';
import { requireRole } from '@sparx/api-core/auth';
import { notFound } from '@sparx/api-core/errors';
import { requireB2bModule, toB2bContext } from '../../../lib/b2b-context.js';

const PathId = z.object({ id: z.string().uuid() });

const ListQuery = z.object({
  account_id: z.string().uuid().optional(),
  // Filters by the workflow stage's tenant-facing name (e.g. "Under Review") —
  // stages are tenant-editable, so this matches the seeded default label; a
  // tenant that renames its stages loses the filter's match, same tradeoff as
  // every other stage-name-keyed saved view on this platform.
  stage: z.string().max(120).optional(),
  take: z.coerce.number().int().min(1).max(250).default(50),
  skip: z.coerce.number().int().min(0).default(0),
});

const QUOTE_INCLUDE = {
  company: { select: { id: true, companyName: true } },
  customer: { select: { id: true, firstName: true, lastName: true, email: true } },
  stage: { select: { id: true, name: true, customerLabel: true, stageType: true } },
} satisfies Prisma.BillingDocumentInclude;

type QuoteDoc = Prisma.BillingDocumentGetPayload<{ include: typeof QUOTE_INCLUDE }>;

function mapQuote(doc: QuoteDoc) {
  return {
    id: doc.id,
    number: doc.number,
    accountId: doc.companyId,
    customerId: doc.customerId,
    subtotal: doc.subtotal,
    taxTotal: doc.taxTotal,
    total: doc.total,
    currency: doc.currency,
    validUntil: doc.validUntil ? doc.validUntil.toISOString() : null,
    customerNote: doc.customerNote,
    stage: {
      id: doc.stage.id,
      name: doc.stage.name,
      customerLabel: doc.stage.customerLabel,
      stageType: doc.stage.stageType,
    },
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
    account: doc.company ? { id: doc.company.id, companyName: doc.company.companyName } : null,
    customer: doc.customer
      ? {
          id: doc.customer.id,
          firstName: doc.customer.firstName,
          lastName: doc.customer.lastName,
          email: doc.customer.email,
        }
      : null,
  };
}

// eslint-disable-next-line @typescript-eslint/require-await -- FastifyPluginAsync signature
const b2bQuoteRoutes: FastifyPluginAsync = async (app) => {
  app.get('/v1/b2b/quotes', async (request, reply) => {
    requireRole(request, 'viewer');
    await requireB2bModule(request);
    const ctx = toB2bContext(request);
    const q = ListQuery.parse(request.query);

    const where: Prisma.BillingDocumentWhereInput = {
      deletedAt: null,
      workflow: { slug: B2B_QUOTE_WORKFLOW_SLUG },
      ...(q.account_id ? { companyId: q.account_id } : { companyId: { not: null } }),
      ...(q.stage ? { stage: { name: q.stage } } : {}),
    };

    const { items, total } = await withTenant(ctx, async (tx) => {
      const [items, total] = await Promise.all([
        tx.billingDocument.findMany({
          where,
          include: QUOTE_INCLUDE,
          orderBy: { createdAt: 'desc' },
          take: q.take,
          skip: q.skip,
        }),
        tx.billingDocument.count({ where }),
      ]);
      return { items, total };
    });

    return reply.send(paged(items.map(mapQuote), { total, skip: q.skip, take: q.take }));
  });

  app.get('/v1/b2b/quotes/:id', async (request, reply) => {
    requireRole(request, 'viewer');
    await requireB2bModule(request);
    const ctx = toB2bContext(request);
    const { id } = PathId.parse(request.params);

    const doc = await withTenant(ctx, (tx) =>
      tx.billingDocument.findFirst({
        where: { id, deletedAt: null, workflow: { slug: B2B_QUOTE_WORKFLOW_SLUG } },
        include: QUOTE_INCLUDE,
      })
    );
    if (!doc) throw notFound('quote');
    return reply.send(ok(mapQuote(doc)));
  });
};

export default b2bQuoteRoutes;
