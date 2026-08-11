// CRM companies — the organisation a contact belongs to (docs/144 §11).
//
//   GET    /v1/crm/companies                        → list (filter by status / rep / search)
//   POST   /v1/crm/companies                        → create
//   GET    /v1/crm/companies/:id                    → fetch one
//   PATCH  /v1/crm/companies/:id                    → update (status flips, credit-hold here)
//   DELETE /v1/crm/companies/:id                    → soft delete
//   GET    /v1/crm/companies/:id/contacts           → list contacts
//   POST   /v1/crm/companies/:id/contacts           → link a customer as a contact (role)
//   PATCH  /v1/crm/companies/:id/contacts/:contactId → change role / activate / deactivate
//   GET    /v1/crm/companies/match-domain?email=…   → which company owns this email domain
//
// EVERY ROUTE IS ALSO MOUNTED AT `/v1/crm/b2b-accounts`, its name before the
// rename. A path lives in somebody's integration, their API key script and their
// saved request collection; renaming the table is our business and breaking
// their Monday morning is not. `/v1/crm/companies` is the documented one and the
// only one the workbench calls — the alias is kept working, not advertised.
//
// Contacts are the write path pricing, checkout net-terms, and the storefront
// B2B portal all key off (packages/db/prisma/schema/62-b2b-contacts.prisma) —
// without a row here, a staff-created company is unreachable by any shopper. The
// contact routes keep the `b2bAccountContactService` name for the same reason
// the table does: an authorised BUYER is not the same thing as a person who
// happens to work somewhere.

import type { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { b2bAccountContactService, companyService } from '@sparx/crm';
import { ok, paged } from '@sparx/api-core/envelope';
import { requireRole } from '@sparx/api-core/auth';
import {
  activeCrmSite,
  requireCrmModule,
  requireCrmOrB2bModule,
  toCrmContext,
} from '../../../lib/crm-context.js';

const PathId = z.object({ id: z.string().uuid() });
const PathContactId = z.object({ id: z.string().uuid(), contactId: z.string().uuid() });

const ListQuery = z.object({
  status: z.enum(['active', 'credit_hold', 'suspended', 'inactive']).optional(),
  assigned_rep_id: z.string().uuid().nullable().optional(),
  q: z.string().max(255).optional(),
  domain: z.string().max(255).optional(),
  take: z.coerce.number().int().min(1).max(250).optional(),
  skip: z.coerce.number().int().min(0).optional(),
});

const MatchQuery = z.object({ email: z.string().max(320) });

/** Canonical first. Order matters only for the OpenAPI dump, which lists the
 *  first registration of a handler. */
const PREFIXES = ['/v1/crm/companies', '/v1/crm/b2b-accounts'] as const;

function register(app: FastifyInstance, base: string): void {
  // Readable by a B2B tenant without CRM — a company is where trade terms live,
  // and the /b2b/orders Account filter depends on this.
  app.get(base, async (request) => {
    requireRole(request, 'viewer');
    await requireCrmOrB2bModule(request);
    const q = ListQuery.parse(request.query);
    const { items, total } = await companyService.list(toCrmContext(request), {
      status: q.status,
      assignedRepId: q.assigned_rep_id ?? undefined,
      q: q.q,
      domain: q.domain,
      take: q.take,
      skip: q.skip,
    });
    return paged(items, { total, per_page: q.take ?? 50 });
  });

  // "Who does this email address belong to?" — the read behind the offer a new
  // contact gets (docs/144 §11). Returns the company or null; it NEVER writes,
  // which is the whole distinction between offering and guessing.
  app.get(`${base}/match-domain`, async (request) => {
    requireRole(request, 'viewer');
    await requireCrmOrB2bModule(request);
    const { email } = MatchQuery.parse(request.query);
    // The SITE's preference, not the tenant's — whether to suggest an employer
    // is saved per business, so reading it at tenant scope always found nothing
    // and always answered "turned off", however the switch was set.
    const propertyId = await activeCrmSite(request);
    const match = await companyService.matchByEmailDomain(toCrmContext(request), email, propertyId);
    return ok(match);
  });

  app.get(`${base}/:id`, async (request) => {
    requireRole(request, 'viewer');
    await requireCrmOrB2bModule(request);
    const { id } = PathId.parse(request.params);
    const company = await companyService.get(toCrmContext(request), id);
    return ok(company);
  });

  app.post(base, async (request, reply) => {
    requireRole(request, 'editor');
    await requireCrmModule(request);
    const company = await companyService.create(toCrmContext(request), request.body);
    reply.code(201);
    return ok(company);
  });

  app.patch(`${base}/:id`, async (request) => {
    requireRole(request, 'editor');
    await requireCrmModule(request);
    const { id } = PathId.parse(request.params);
    const company = await companyService.update(toCrmContext(request), id, request.body);
    return ok(company);
  });

  app.delete(`${base}/:id`, async (request, reply) => {
    requireRole(request, 'admin');
    await requireCrmModule(request);
    const { id } = PathId.parse(request.params);
    await companyService.softDelete(toCrmContext(request), id);
    reply.code(204);
  });

  app.get(`${base}/:id/contacts`, async (request) => {
    requireRole(request, 'viewer');
    await requireCrmModule(request);
    const { id } = PathId.parse(request.params);
    const items = await b2bAccountContactService.list(toCrmContext(request), id);
    return paged(items, { total: items.length, per_page: items.length || 1 });
  });

  app.post(`${base}/:id/contacts`, async (request, reply) => {
    requireRole(request, 'editor');
    await requireCrmModule(request);
    const { id } = PathId.parse(request.params);
    const contact = await b2bAccountContactService.create(toCrmContext(request), id, request.body);
    reply.code(201);
    return ok(contact);
  });

  app.patch(`${base}/:id/contacts/:contactId`, async (request) => {
    requireRole(request, 'editor');
    await requireCrmModule(request);
    const { id, contactId } = PathContactId.parse(request.params);
    const contact = await b2bAccountContactService.update(
      toCrmContext(request),
      id,
      contactId,
      request.body
    );
    return ok(contact);
  });
}

const companyRoutes: FastifyPluginAsync = (app) => {
  for (const prefix of PREFIXES) register(app, prefix);
  return Promise.resolve();
};

export default companyRoutes;
