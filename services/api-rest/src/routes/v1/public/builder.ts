// Public read for PUBLISHED Builder pages + the site layout (docs/44 §2.2,
// docs/45 §2.6) — the storefront render path's data source.
//
//   GET /v1/public/builder/page        ?tenant=<slug>&slug=<pageSlug>
//     → the published page tree + meta, or 404 if no published page has that slug
//   GET /v1/public/builder/collection  ?tenant=<slug>&recordType=<type>
//     → the published COLLECTION template for a record type (commerce.product,
//       cms.page, …) — the generic per-record router (docs/44 §3 B). 404 if none.
//   GET /v1/public/builder/layout      ?tenant=<slug>
//     → the published chrome tree + meta, or 404 if no layout has been published
//
// No auth (`/v1/public/` is an auth-exempt prefix). Tenant resolved by slug (the
// tenants table is the only non-RLS row, safe to look up), then an RLS-scoped
// read via the service. Returns the PUBLISHED tree only — never the draft.

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { prisma } from '@sparx/db';
import { pageService, layoutService } from '@sparx/builder';
import { ok } from '@sparx/api-core/envelope';
import { notFound } from '@sparx/api-core/errors';

const PageQuery = z.object({
  tenant: z.string().min(1).max(63),
  slug: z.string().min(1).max(160),
});

const CollectionQuery = z.object({
  tenant: z.string().min(1).max(63),
  recordType: z.string().min(1).max(63),
});

const TenantQuery = z.object({
  tenant: z.string().min(1).max(63),
});

async function resolveTenantBySlug(slug: string): Promise<string> {
  const t = await prisma.tenant.findUnique({ where: { slug }, select: { id: true } });
  if (!t) throw notFound('Tenant', slug);
  return t.id;
}

const publicBuilderRoutes: FastifyPluginAsync = (app) => {
  app.get('/v1/public/builder/page', async (request) => {
    const q = PageQuery.parse(request.query);
    const tenantId = await resolveTenantBySlug(q.tenant);
    const page = await pageService.getPublishedBySlug({ tenantId }, q.slug);
    if (!page) throw notFound('Builder page', q.slug);
    return ok(page);
  });

  app.get('/v1/public/builder/collection', async (request) => {
    const q = CollectionQuery.parse(request.query);
    const tenantId = await resolveTenantBySlug(q.tenant);
    const page = await pageService.getPublishedByRecordType({ tenantId }, q.recordType);
    if (!page) throw notFound('Builder collection template', q.recordType);
    return ok(page);
  });

  app.get('/v1/public/builder/layout', async (request) => {
    const q = TenantQuery.parse(request.query);
    const tenantId = await resolveTenantBySlug(q.tenant);
    const layout = await layoutService.getPublished({ tenantId });
    if (!layout) throw notFound('Builder layout', q.tenant);
    return ok(layout);
  });

  return Promise.resolve();
};

export default publicBuilderRoutes;
