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
//   GET    /v1/builder/pages/:id/silica   → ONE page's silica body + its settings —
//                                            the page builder's load
//   PUT    /v1/builder/pages/:id/silica   → replace ONE page's silica body, leaving
//                                            every other page, the frame, the theme
//                                            and the symbols untouched
//   POST   /v1/builder/pages/:id/silica/publish
//                                          → put ONE page live, with the chrome
//                                            pointer it asks for, leaving every other
//                                            page's draft where it is
//
// Bodies are validated by the service-layer Zod schemas (the established route ↔
// service boundary), so api-rest keeps no @sparx/builder-schemas dependency.

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { pageService, siteService } from '@sparx/builder';
import { ok } from '@sparx/api-core/envelope';
import { requireRole } from '@sparx/api-core/auth';
import { withRequestTenant } from '@sparx/api-core/db';
import { requireBuilderModule, toBuilderContext } from '../../../lib/builder-context.js';
import { auditAndStore } from '../../../lib/seo-audit.js';

const IdParam = z.object({ id: z.string().uuid() });
const SilicaBody = z.object({ root: z.unknown() });

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

  /**
   * ONE page's silica body and settings — the page builder's load.
   *
   * `GET /v1/builder/site` answers this too, for every page at once. Several page
   * panes open together is the ordinary case here, so each reads its own row: the
   * cost is per pane rather than per pane × per page in the site.
   */
  app.get('/v1/builder/pages/:id/silica', async (request) => {
    requireRole(request, 'viewer');
    await requireBuilderModule(request);
    const { id } = IdParam.parse(request.params);
    const page = await siteService.loadPage(await toBuilderContext(request), id);
    return ok(page);
  });

  /**
   * Replace ONE page's silica body.
   *
   * The per-document editor's Save. It writes only this page — the frame, the
   * theme, the symbols and every other page are read and written back unchanged,
   * so two panes saving two different pages cannot overwrite each other the way
   * two whole-`Site` PUTs would.
   */
  app.put('/v1/builder/pages/:id/silica', async (request) => {
    requireRole(request, 'editor');
    await requireBuilderModule(request);
    const { id } = IdParam.parse(request.params);
    const body = SilicaBody.parse(request.body);
    const ctx = await toBuilderContext(request);
    const change = await siteService.setPageRoot(ctx, id, body.root as never);
    // Null means no such page — a stale pane, not a server fault. Reported rather
    // than thrown so the editor can say "this page has been deleted" instead of
    // showing a failed save on work that has nowhere left to go.
    return ok({ written: change !== null, reloadHints: change?.reloadHints ?? [] });
  });

  /**
   * Put ONE page live — the page builder's Publish.
   *
   * Distinct from `POST /:id/publish` above, which snapshots the LEGACY tree. This
   * one publishes the silica body together with the chrome pointer the page asks
   * for, and seals a release carrying the rest of the live site forward, so rolling
   * back still restores a whole site rather than one page over an empty one.
   */
  app.post('/v1/builder/pages/:id/silica/publish', async (request) => {
    requireRole(request, 'editor');
    await requireBuilderModule(request);
    const { id } = IdParam.parse(request.params);
    const ctx = await toBuilderContext(request);
    const published = await siteService.publishPage(ctx, id);
    // Re-grade the page that just went live. Advisory and independent — a failed
    // audit must never fail the publish that earned it.
    await withRequestTenant(request, (tx) =>
      auditAndStore(tx, ctx.tenantId, 'builder_page', id).catch(() => undefined)
    );
    return ok(published);
  });

  return Promise.resolve();
};

export default builderPageRoutes;
