// Direct-customer estimate requests — the non-B2B counterpart to the B2B
// portal's quotes (docs/87 §15 convergence). A signed-in storefront customer
// (Layer 2, no B2B account needed) can ask for an estimate on work or parts;
// the merchant prices it in the dashboard; the customer approves or declines.
// An estimate IS a BillingDocument on the system `customer-estimates`
// workflow — gated on the `invoicing` module.
//
//   GET  /v1/public/commerce/account/estimates?tenant=&skip=&take=
//        → paged list of the signed-in customer's own estimates
//   POST /v1/public/commerce/account/estimates?tenant=
//        → submit a new request (creates a draft document + its lines)
//   POST /v1/public/commerce/account/estimates/:id/accept?tenant=
//        → customer approves a merchant-priced estimate
//   POST /v1/public/commerce/account/estimates/:id/decline?tenant=
//        → customer declines a merchant-priced estimate

import type { FastifyPluginAsync, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { isModuleEnabled } from '@sparx/auth';
import { withTenant } from '@sparx/db';
import {
  billingDocumentService,
  billingDocumentStageService,
  billingLineService,
  customerEstimateService,
} from '@sparx/crm';
import { CUSTOMER_ESTIMATE_WORKFLOW_SLUG } from '@sparx/crm-schemas/builtins';
import { ok, paged } from '@sparx/api-core/envelope';
import { moduleDisabled, notFound } from '@sparx/api-core/errors';
import { type CustomerAuthContext } from '@sparx/customer-auth';
import { resolveTenantId } from '../../../lib/public-commerce-context.js';
import { requireCustomerId } from '../../../lib/customer-session.js';

const PagedQuery = z.object({
  take: z.coerce.number().int().min(1).max(100).default(20),
  skip: z.coerce.number().int().min(0).default(0),
});
const PathId = z.object({ id: z.string().uuid() });

const SubmitEstimateBody = z.object({
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
const DeclineBody = z.object({ reason: z.string().max(500).optional() });

async function requireInvoicingContext(request: FastifyRequest): Promise<CustomerAuthContext> {
  const tenantId = await resolveTenantId(request);
  if (!(await isModuleEnabled(tenantId, 'invoicing'))) throw moduleDisabled('invoicing');
  return { tenantId };
}

/** IDOR guard — confirm `id` is actually a `customer-estimates`-workflow
 *  document belonging to the signed-in customer before any lifecycle write. */
async function assertOwnEstimate(
  ctx: CustomerAuthContext,
  customerId: string,
  id: string
): Promise<void> {
  const doc = await withTenant(ctx, (tx) =>
    tx.billingDocument.findFirst({
      where: {
        id,
        customerId,
        deletedAt: null,
        workflow: { slug: CUSTOMER_ESTIMATE_WORKFLOW_SLUG },
      },
      select: { id: true },
    })
  );
  if (!doc) throw notFound('estimate');
}

// eslint-disable-next-line @typescript-eslint/require-await -- FastifyPluginAsync signature
const estimateRoutes: FastifyPluginAsync = async (app) => {
  app.get('/v1/public/commerce/account/estimates', async (request) => {
    const ctx = await requireInvoicingContext(request);
    const customerId = await requireCustomerId(request, ctx, 'estimates:read');
    const q = PagedQuery.parse(request.query);

    const where = {
      deletedAt: null,
      workflow: { slug: CUSTOMER_ESTIMATE_WORKFLOW_SLUG },
      customerId,
    };
    const { items, total } = await withTenant(ctx, async (tx) => {
      const [items, total] = await Promise.all([
        tx.billingDocument.findMany({
          where,
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
        tx.billingDocument.count({ where }),
      ]);
      return { items, total };
    });

    return paged(
      items.map((d) => ({
        id: d.id,
        number: d.number,
        stage: d.stage,
        totalCents: Math.round(Number(d.total) * 100),
        currency: d.currency,
        validUntil: d.validUntil?.toISOString() ?? null,
        createdAt: d.createdAt.toISOString(),
      })),
      { total, skip: q.skip, take: q.take }
    );
  });

  app.post('/v1/public/commerce/account/estimates', async (request, reply) => {
    const ctx = await requireInvoicingContext(request);
    const customerId = await requireCustomerId(request, ctx, 'estimates:write');
    const body = SubmitEstimateBody.parse(request.body);

    const requestedStage = await withTenant(ctx, (tx) =>
      customerEstimateService.customerEstimateRequestedStage(tx, ctx.tenantId)
    );

    let doc = await billingDocumentService.create(ctx, {
      workflowId: requestedStage.workflowId,
      stageId: requestedStage.id,
      customerId,
      ...(body.customerNote !== undefined ? { customerNote: body.customerNote } : {}),
    });

    for (const line of body.lines) {
      doc = await billingLineService.addLine(ctx, doc.id, {
        description: line.description,
        quantity: line.quantity,
        ...(line.variantId ? { variantId: line.variantId } : {}),
      });
    }

    reply.code(201);
    return ok({ id: doc.id, number: doc.number });
  });

  app.post('/v1/public/commerce/account/estimates/:id/accept', async (request) => {
    const ctx = await requireInvoicingContext(request);
    const customerId = await requireCustomerId(request, ctx, 'estimates:write');
    const { id } = PathId.parse(request.params);
    await assertOwnEstimate(ctx, customerId, id);

    const approvedStage = await withTenant(ctx, (tx) =>
      customerEstimateService.customerEstimateStageByName(tx, ctx.tenantId, 'Approved')
    );
    const doc = await billingDocumentStageService.advance(ctx, id, { stageId: approvedStage.id });
    return ok({ id: doc.id, stageId: doc.stageId });
  });

  app.post('/v1/public/commerce/account/estimates/:id/decline', async (request) => {
    const ctx = await requireInvoicingContext(request);
    const customerId = await requireCustomerId(request, ctx, 'estimates:write');
    const { id } = PathId.parse(request.params);
    await assertOwnEstimate(ctx, customerId, id);
    const body = DeclineBody.parse(request.body ?? {});

    const declinedStage = await withTenant(ctx, (tx) =>
      customerEstimateService.customerEstimateStageByName(tx, ctx.tenantId, 'Declined')
    );
    if (body.reason !== undefined) {
      await billingDocumentService.update(ctx, id, { declinedReason: body.reason });
    }
    const doc = await billingDocumentStageService.advance(ctx, id, { stageId: declinedStage.id });
    return ok({ id: doc.id, stageId: doc.stageId });
  });
};

export default estimateRoutes;
