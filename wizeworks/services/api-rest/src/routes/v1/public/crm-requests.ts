// Customer self-service support portal (docs/144 §7) — the authenticated
// counterpart to the site's support form.
//
//   GET  /v1/public/crm/account/requests            ?tenant=&scope=&page=&pageSize=
//   GET  /v1/public/crm/account/requests/:requestId ?tenant=
//   POST /v1/public/crm/account/requests            ?tenant=  { subject, message }
//   POST /v1/public/crm/account/requests/:requestId/replies ?tenant= { message }
//
// Auth is the same first-party httpOnly cookie (sparx_customer_session) the
// commerce and booking portals use; the tenant comes from ?tenant=<slug>. Every
// request is OWNERSHIP-CHECKED against the signed-in customer — a mismatch 404s
// rather than 403s, so this never confirms that somebody else's request exists.
// Gated on the `crm` module.
//
// WHAT THIS DELIBERATELY DOES NOT EXPOSE. A customer sees their own words, the
// stage name, and whether it is settled. They do NOT see the reply deadline, the
// warn instant, the breach stamps, who it is assigned to, internal notes, or
// tags. Those exist so a business can measure itself; publishing them would turn
// an internal target into a promise a customer can hold them to, and would leak
// staff names and workload to anyone with an account. `toRequestDto` is the only
// thing that decides what crosses that line — nothing here returns a raw row.

import type { FastifyPluginAsync, FastifyRequest } from 'fastify';
import { z } from 'zod';

import { isModuleEnabled } from '@wizeworks/auth';
import { ticketService, type TicketView } from '@wizeworks/crm';
import { type CustomerAuthContext } from '@wizeworks/customer-auth';
import { ok, paged } from '@wizeworks/api-core/envelope';
import { moduleDisabled, notFound } from '@wizeworks/api-core/errors';

import { resolveTenantId } from '../../../lib/public-commerce-context.js';
import { resolvePublicPropertyId } from '../../../lib/property.js';
import { requireCustomerId } from '../../../lib/customer-session.js';

const ListQuery = z.object({
  scope: z.enum(['open', 'settled', 'all']).default('open'),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
});

const IdParam = z.object({ requestId: z.string().uuid() });

const OpenBody = z.object({
  subject: z.string().trim().min(1).max(255),
  message: z.string().trim().min(1).max(10_000),
});

const ReplyBody = z.object({
  message: z.string().trim().min(1).max(10_000),
});

/** Resolve the tenant + gate on the CRM module (the portal is inert when the
 *  tenant has not activated it). */
async function requestContext(request: FastifyRequest): Promise<CustomerAuthContext> {
  const tenantId = await resolveTenantId(request);
  if (!(await isModuleEnabled(tenantId, 'crm'))) throw moduleDisabled('crm');
  return { tenantId };
}

/** The signed-in customer id for the active site, or 401. `scope` gates a
 *  customer MCP OAuth bearer; a first-party cookie session always passes. */
function requireCustomer(
  request: FastifyRequest,
  ctx: CustomerAuthContext,
  scope: string
): Promise<string> {
  return requireCustomerId(request, ctx, scope);
}

/**
 * The customer-facing projection of a request.
 *
 * `state` is derived from the stage's TYPE rather than its name, because stage
 * names are the tenant's own words ("Sorted", "Done and dusted") and a portal
 * cannot switch on those. The name still ships as `stage`, so the customer reads
 * the business's own vocabulary; `state` is what the UI branches on.
 */
function toRequestDto(view: TicketView): Record<string, unknown> {
  const stageType = view.ticket.stage?.stageType ?? 'open';
  const settled = stageType === 'resolved' || stageType === 'closed';
  return {
    id: view.ticket.id,
    number: view.ticket.number,
    subject: view.ticket.subject,
    description: view.ticket.description,
    stage: view.ticket.stage?.name ?? null,
    state: settled ? 'settled' : 'open',
    openedAt: view.ticket.createdAt.toISOString(),
    // Whether they have been got back to, and whether it is finished — the two
    // facts a person actually wants. Not WHEN we promised to, and not how close
    // we are to missing it.
    answered: view.ticket.firstRespondedAt !== null,
    settledAt: view.ticket.resolvedAt?.toISOString() ?? null,
  };
}

/** Load a request and assert it belongs to this customer (else 404 — never leak
 *  another customer's request existence). */
async function ownedRequest(
  ctx: CustomerAuthContext,
  requestId: string,
  customerId: string
): Promise<TicketView> {
  const view = await ticketService.get({ tenantId: ctx.tenantId }, requestId);
  if (view.ticket.customerId !== customerId) throw notFound('Request', requestId);
  return view;
}

// eslint-disable-next-line @typescript-eslint/require-await -- FastifyPluginAsync contract; route registration is sync
const crmRequestRoutes: FastifyPluginAsync = async (app) => {
  app.get('/v1/public/crm/account/requests', async (request) => {
    const { scope, page, pageSize } = ListQuery.parse(request.query);
    const ctx = await requestContext(request);
    const customerId = await requireCustomer(request, ctx, 'requests:read');

    const { items, total } = await ticketService.list(
      { tenantId: ctx.tenantId },
      {
        query: {
          customerId,
          // 'all' still means all of THEIRS — customerId above is the fence.
          state: scope === 'settled' ? 'resolved' : scope === 'open' ? 'open' : 'all',
          sort: 'created_desc',
          take: pageSize,
          skip: (page - 1) * pageSize,
        },
      }
    );

    return paged(items.map(toRequestDto), {
      page,
      per_page: pageSize,
      total,
      total_pages: Math.ceil(total / pageSize),
    });
  });

  app.get('/v1/public/crm/account/requests/:requestId', async (request) => {
    const { requestId } = IdParam.parse(request.params);
    const ctx = await requestContext(request);
    const customerId = await requireCustomer(request, ctx, 'requests:read');
    return ok(toRequestDto(await ownedRequest(ctx, requestId, customerId)));
  });

  /**
   * Raise a request from the portal.
   *
   * `source: 'form'` — the customer filled something in, which is what that
   * source means; the portal is not a separate kind of origin. No
   * `sourceRecordId`, so no intake dedupe: two deliberate submissions are two
   * requests, unlike an automation firing twice on one conversation.
   *
   * The reply deadline is attached by the service from the tenant's default
   * promise. Nothing here chooses one, and the customer cannot influence it —
   * priority is the business's judgement about its own workload, so this always
   * takes the default rather than letting the portal set urgency.
   */
  app.post('/v1/public/crm/account/requests', async (request, reply) => {
    const body = OpenBody.parse(request.body);
    const ctx = await requestContext(request);
    const customerId = await requireCustomer(request, ctx, 'requests:write');
    const propertyId = await resolvePublicPropertyId(
      ctx.tenantId,
      (request.query as { property?: string }).property ?? null
    );

    const view = await ticketService.create(
      { tenantId: ctx.tenantId },
      {
        subject: body.subject,
        description: body.message,
        source: 'form',
        customerId,
        ...(propertyId ? { propertyId } : {}),
      }
    );
    return reply.code(201).send(ok(toRequestDto(view)));
  });

  /** Add to a request they already raised. Never settles the reply promise —
   *  see `recordCustomerMessage`. */
  app.post('/v1/public/crm/account/requests/:requestId/replies', async (request, reply) => {
    const { requestId } = IdParam.parse(request.params);
    const body = ReplyBody.parse(request.body);
    const ctx = await requestContext(request);
    const customerId = await requireCustomer(request, ctx, 'requests:write');

    // Ownership is re-checked inside the service too; this call is what turns a
    // stranger's id into a 404 before any write is attempted.
    await ownedRequest(ctx, requestId, customerId);
    await ticketService.recordCustomerMessage({ tenantId: ctx.tenantId }, requestId, {
      customerId,
      body: body.message,
    });

    return reply.code(201).send(ok({ recorded: true }));
  });
};

export default crmRequestRoutes;
