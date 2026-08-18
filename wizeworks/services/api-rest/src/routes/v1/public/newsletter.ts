// Public newsletter / marketing-list capture — the generic "join a named list"
// endpoint.
//
//   POST /v1/public/newsletter ?tenant=<slug>   → opt a visitor into a tenant's
//   marketing list. Body carries `email` (+ optional name), a `list` slug (e.g.
//   'early-access', 'newsletter'), and an optional free-text `note`.
//
// This is DISTINCT from /v1/public/signup, which is the storefront "Email signup"
// block (site-scoped, docs/51 §7). This route is the platform/first-party surface:
// the sparx.works /early waitlist on sparx/apps/web posts here with tenant=<platform>
// and list='early-access'. Both ultimately call customerService.subscribe — the
// same CRM contact spine — but stay honestly-named at the edge.
//
// No auth (anonymous visitors), MODULE-GATED on CRM (the contact spine is a CRM
// concern). IP is captured server-side as opt-in proof. The reply never reveals
// whether the email was already on file — a signup form must not be an email oracle.

import type { FastifyPluginAsync, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { isModuleEnabled } from '@wizeworks/auth';
import { customerService } from '@wizeworks/crm';
import { prisma, withTenant } from '@wizeworks/db';
import { ok } from '@wizeworks/api-core/envelope';
import { moduleDisabled, notFound } from '@wizeworks/api-core/errors';

const Query = z.object({
  tenant: z.string().min(1).max(63),
  // Optional site (web property) slug to scope the contact to. Omitted → the
  // tenant's primary site (so a contact is never left floating tenant-level).
  property: z.string().min(1).max(63).optional(),
});

const Body = z.object({
  email: z.string().email().max(255),
  firstName: z.string().max(255).optional(),
  lastName: z.string().max(255).optional(),
  // The named list to join. Kebab-case slug; defaults to the generic newsletter.
  list: z
    .string()
    .min(1)
    .max(63)
    .regex(/^[a-z0-9-]+$/, 'list must be a kebab-case slug')
    .default('newsletter'),
  // Free-text captured with the opt-in (e.g. the waitlist "what are you building?").
  note: z.string().max(2000).optional(),
});

function clientIp(request: FastifyRequest): string | undefined {
  return request.ip || undefined;
}

const publicNewsletterRoutes: FastifyPluginAsync = (app) => {
  app.post('/v1/public/newsletter', async (request) => {
    const q = Query.parse(request.query);
    const body = Body.parse(request.body);

    const tenant = await prisma.tenant.findUnique({
      where: { slug: q.tenant },
      select: { id: true },
    });
    if (!tenant) throw notFound('Tenant', q.tenant);

    // The contact spine is a CRM concern — gate the capture on it.
    if (!(await isModuleEnabled(tenant.id, 'crm'))) throw moduleDisabled('crm');

    // Scope the contact to a SITE so the dashboard's per-site CRM views include
    // it — a contact with no property floats at the tenant level and shows under
    // no site. Use the named `?property=` slug if given, else the tenant's primary
    // site. properties is FORCE RLS, so resolve under withTenant.
    const property = await withTenant({ tenantId: tenant.id }, (tx) =>
      q.property
        ? tx.property.findFirst({
            where: { tenantId: tenant.id, slug: q.property },
            select: { id: true },
          })
        : tx.property.findFirst({
            where: { tenantId: tenant.id, isPrimary: true },
            select: { id: true },
          })
    );

    await customerService.subscribe(
      { tenantId: tenant.id },
      {
        email: body.email,
        firstName: body.firstName ?? null,
        lastName: body.lastName ?? null,
        propertyId: property?.id ?? null,
        source: 'signup',
        list: body.list,
        note: body.note ?? null,
        ipAddress: clientIp(request),
      }
    );

    return ok({ ok: true });
  });

  return Promise.resolve();
};

export default publicNewsletterRoutes;
