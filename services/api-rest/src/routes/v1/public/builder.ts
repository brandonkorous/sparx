// Public read for PUBLISHED Builder pages (docs/44 §2.2) — the storefront render
// path's data source.
//
//   GET /v1/public/builder/page  ?tenant=<slug>&slug=<pageSlug>
//     → the published node tree + meta, or 404 if no published page has that slug
//
// No auth (`/v1/public/` is an auth-exempt prefix). Tenant resolved by slug (the
// tenants table is the only non-RLS row, safe to look up), then an RLS-scoped
// read via the service. Returns the PUBLISHED tree only — never the draft.

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { prisma } from '@sparx/db';
import { pageService } from '@sparx/builder';
import { ok } from '@sparx/api-core/envelope';
import { notFound } from '@sparx/api-core/errors';

const PageQuery = z.object({
  tenant: z.string().min(1).max(63),
  slug: z.string().min(1).max(160),
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

  return Promise.resolve();
};

export default publicBuilderRoutes;
