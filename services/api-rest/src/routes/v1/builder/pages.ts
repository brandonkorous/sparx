// Builder — the page catalog and draft/publish lifecycle (docs/41).
//
//   GET    /v1/builder/pages              → list the tenant's pages (seeds the
//                                            curated starter set on first call)
//   POST   /v1/builder/pages              → create a page (from a tree or blank)
//   POST   /v1/builder/pages/reorder      → reorder the catalog
//   GET    /v1/builder/pages/:id          → one page
//   PATCH  /v1/builder/pages/:id          → rename / save the draft tree / retarget
//   DELETE /v1/builder/pages/:id          → remove
//   POST   /v1/builder/pages/:id/publish  → snapshot draft → published
//   POST   /v1/builder/pages/:id/default  → make this the default for its recordType
//
// Bodies are validated by the service-layer Zod schemas (the established route ↔
// service boundary), so api-rest keeps no @sparx/builder-schemas dependency.

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { pageService } from '@sparx/builder';
import { ok } from '@sparx/api-core/envelope';
import { requireRole } from '@sparx/api-core/auth';
import { withRequestTenant } from '@sparx/api-core/db';
import { requireBuilderModule, toBuilderContext } from '../../../lib/builder-context.js';
import { auditAndStore } from '../../../lib/seo-audit.js';

const IdParam = z.object({ id: z.string().uuid() });

const builderPageRoutes: FastifyPluginAsync = (app) => {
  app.get('/v1/builder/pages', async (request) => {
    requireRole(request, 'viewer');
    await requireBuilderModule(request);
    const pages = await pageService.listOrSeed(await toBuilderContext(request));
    return ok({ pages });
  });

  app.post('/v1/builder/pages', async (request) => {
    requireRole(request, 'editor');
    await requireBuilderModule(request);
    const page = await pageService.create(await toBuilderContext(request), request.body);
    return ok(page);
  });

  app.post('/v1/builder/pages/reorder', async (request) => {
    requireRole(request, 'editor');
    await requireBuilderModule(request);
    const pages = await pageService.reorder(await toBuilderContext(request), request.body);
    return ok({ pages });
  });

  app.get('/v1/builder/pages/:id', async (request) => {
    requireRole(request, 'viewer');
    await requireBuilderModule(request);
    const { id } = IdParam.parse(request.params);
    const page = await pageService.get(await toBuilderContext(request), id);
    return ok(page);
  });

  app.patch('/v1/builder/pages/:id', async (request) => {
    requireRole(request, 'editor');
    await requireBuilderModule(request);
    const { id } = IdParam.parse(request.params);
    const page = await pageService.update(await toBuilderContext(request), id, request.body);
    return ok(page);
  });

  app.delete('/v1/builder/pages/:id', async (request) => {
    requireRole(request, 'editor');
    await requireBuilderModule(request);
    const { id } = IdParam.parse(request.params);
    await pageService.remove(await toBuilderContext(request), id);
    return ok({ id });
  });

  app.post('/v1/builder/pages/:id/publish', async (request) => {
    const auth = requireRole(request, 'editor');
    await requireBuilderModule(request);
    const { id } = IdParam.parse(request.params);
    const page = await pageService.publish(await toBuilderContext(request), id);
    // Refresh the stored SEO snapshot against the just-published tree so the
    // overview stays current (docs/50 §7). Best-effort — a snapshot write must
    // never fail the publish itself.
    await withRequestTenant(request, (tx) =>
      auditAndStore(tx, auth.tenantId, 'builder_page', id)
    ).catch(() => undefined);
    return ok(page);
  });

  app.post('/v1/builder/pages/:id/default', async (request) => {
    requireRole(request, 'editor');
    await requireBuilderModule(request);
    const { id } = IdParam.parse(request.params);
    const page = await pageService.setDefault(await toBuilderContext(request), id);
    return ok(page);
  });

  return Promise.resolve();
};

export default builderPageRoutes;
