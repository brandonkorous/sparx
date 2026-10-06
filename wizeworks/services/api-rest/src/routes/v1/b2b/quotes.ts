// B2B quotes — a thin scoped-read view over BillingDocument (docs/10 §7,
// docs/87 convergence). A B2B quote/RFQ IS a BillingDocument on the system
// `b2b-quotes` workflow (crm-schemas/builtins/invoicing.ts) — there is no
// separate quote entity or lifecycle anymore. Creating a quote, pricing its
// lines, and advancing it through Draft → Submitted → ... → Accepted/Declined
// all go through the generic `/v1/invoicing/documents` endpoints (create,
// lines, /advance) — this file only projects a B2B-scoped list/detail read,
// mirroring the AR projection b2b/invoices.ts already establishes.
//
//   GET  /v1/b2b/quotes      → list, scoped to the b2b-quotes workflow, with
//                              `q` (number / business / person / email),
//                              `state` (open | accepted | closed),
//                              `account_id` and `stage`
//   GET  /v1/b2b/quotes/:id  → fetch one

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { withTenant, type Prisma } from '@wizeworks/db';
import { B2B_QUOTE_WORKFLOW_SLUG } from '@wizeworks/crm-schemas/builtins';
import { deliveryNeedsOf, poNumberOf } from '@wizeworks/crm-schemas';
import { ok, paged } from '@wizeworks/api-core/envelope';
import { requireRole } from '@wizeworks/api-core/auth';
import { notFound } from '@wizeworks/api-core/errors';
import { requireB2bModule, toB2bContext } from '../../../lib/b2b-context.js';

const PathId = z.object({ id: z.string().uuid() });

/**
 * The three answers a quote can be in, and the stored stage type behind each.
 *
 * `stage` (below) filters by the stage's tenant-facing NAME, which breaks the
 * moment a tenant renames a stage. `state` asks the stage's TYPE instead, which
 * is the schema's own three buckets and cannot be renamed away — so the chips a
 * person presses keep working on a workflow whose stages they have edited.
 *
 * One bucket gathers several stages: `open` is Draft, Submitted, Under Review
 * and Quoted all at once, because from the asker's side none of them has been
 * answered yet.
 */
const STATE_STAGE_TYPE = {
  open: 'draft',
  accepted: 'committed',
  closed: 'void',
} as const;

const ListQuery = z.object({
  account_id: z.string().uuid().optional(),
  // Quote number, the business that asked, or the person who asked — including
  // their email, because a quote from someone with no trade account is stored
  // against the person and that is how she knows which one it was (issue 763).
  q: z.string().max(200).optional(),
  // Which of the three answers. See STATE_STAGE_TYPE above.
  state: z.enum(['open', 'accepted', 'closed']).optional(),
  // Filters by the workflow stage's tenant-facing name (e.g. "Under Review") —
  // stages are tenant-editable, so this matches the seeded default label; a
  // tenant that renames its stages loses the filter's match, same tradeoff as
  // every other stage-name-keyed saved view on this platform. Prefer `state`.
  stage: z.string().max(120).optional(),
  take: z.coerce.number().int().min(1).max(250).default(50),
  skip: z.coerce.number().int().min(0).default(0),
});

const QUOTE_INCLUDE = {
  company: { select: { id: true, companyName: true } },
  customer: { select: { id: true, firstName: true, lastName: true, email: true } },
  stage: { select: { id: true, name: true, customerLabel: true, stageType: true } },
  // What was actually asked for. A quote IS its list of lines — a total with
  // nothing under it tells the person reading neither what was requested nor
  // what she priced, on the one document where that list is the whole content.
  lines: {
    select: {
      id: true,
      description: true,
      quantity: true,
      unitPrice: true,
      lineTotal: true,
      sortOrder: true,
    },
    orderBy: { sortOrder: 'asc' },
  },
} satisfies Prisma.BillingDocumentInclude;

type QuoteDoc = Prisma.BillingDocumentGetPayload<{ include: typeof QUOTE_INCLUDE }>;

/** One quote as the business reads it. Exported for its test. */
export function mapQuote(doc: QuoteDoc) {
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
    // What a buyer said when they sent it (sparx persona issue 086): their own
    // PO number, and when and where they need it. Both live in the metadata bag.
    poNumber: poNumberOf(doc.metadata),
    delivery: deliveryNeedsOf(doc.metadata),
    stage: {
      id: doc.stage.id,
      name: doc.stage.name,
      customerLabel: doc.stage.customerLabel,
      stageType: doc.stage.stageType,
    },
    lines: doc.lines.map((line) => ({
      id: line.id,
      description: line.description,
      quantity: line.quantity,
      unitPrice: line.unitPrice,
      lineTotal: line.lineTotal,
    })),
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

/**
 * What to look for, from what was asked for. Pure, and exported, so the parts
 * that are easy to get quietly wrong can be tested without a database.
 *
 * The workflow is what makes a document a quote, and it is the ONLY thing that
 * does. This used to also require `companyId: { not: null }` when no account was
 * asked for, which reads as "a trade quote must belong to a trade account" and
 * behaves as "hide any quote that does not". Fourteen of the fifteen quotes on
 * the dev machine had no account on them, so the screen said "No quotes yet"
 * over a table full of them — including one priced up two minutes earlier, in
 * this console, by the person reading it (issue 763). A quote with no account
 * attached still belongs to whoever asked for it, and she still has to see it.
 */
export function quoteListWhere(q: z.infer<typeof ListQuery>): Prisma.BillingDocumentWhereInput {
  // `stage` and `state` both narrow the SAME relation, so they are merged into
  // one clause rather than spread as two `stage:` keys — the second of which
  // would silently replace the first and drop a filter the caller asked for.
  // [[feedback_absent_behaves_like_fine]]
  const stageWhere: Prisma.DocumentStageWhereInput = {
    ...(q.stage ? { name: q.stage } : {}),
    ...(q.state ? { stageType: STATE_STAGE_TYPE[q.state] } : {}),
  };

  // A search of only spaces is not a search. Trimmed here rather than at the
  // caller so every caller gets it. [[feedback_the_empty_control_is_the_untested_one]]
  const term = q.q?.trim() ?? '';

  return {
    deletedAt: null,
    workflow: { slug: B2B_QUOTE_WORKFLOW_SLUG },
    ...(q.account_id ? { companyId: q.account_id } : {}),
    ...(Object.keys(stageWhere).length > 0 ? { stage: stageWhere } : {}),
    ...(term === ''
      ? {}
      : {
          OR: [
            { number: { contains: term, mode: 'insensitive' } },
            { company: { companyName: { contains: term, mode: 'insensitive' } } },
            { customer: { firstName: { contains: term, mode: 'insensitive' } } },
            { customer: { lastName: { contains: term, mode: 'insensitive' } } },
            { customer: { email: { contains: term, mode: 'insensitive' } } },
          ],
        }),
  };
}

// eslint-disable-next-line @typescript-eslint/require-await -- FastifyPluginAsync signature
const b2bQuoteRoutes: FastifyPluginAsync = async (app) => {
  app.get('/v1/b2b/quotes', async (request, reply) => {
    requireRole(request, 'viewer');
    await requireB2bModule(request);
    const ctx = toB2bContext(request);
    const q = ListQuery.parse(request.query);
    const where = quoteListWhere(q);

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
