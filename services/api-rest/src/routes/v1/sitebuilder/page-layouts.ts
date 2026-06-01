// Site Builder — page layouts per layout target (PageLayout, docs/36 §4-§5).
//
//   GET    /v1/sitebuilder/page-layouts?target_id=   → list layouts (optionally by target)
//   POST   /v1/sitebuilder/page-layouts              → resolve-or-create an (empty) layout
//   POST   /v1/sitebuilder/page-layouts/materialize  → "Customize": resolve-or-create + seed
//                                                       the code default into real sections
//   POST   /v1/sitebuilder/page-layouts/instantiate  → create a NEW named layout from a Page
//                                                       Template (docs/36 §10) → {pageLayout, sections}
//   GET    /v1/sitebuilder/page-layouts/:id          → one layout
//   PATCH  /v1/sitebuilder/page-layouts/:id          → rename (label only)
//   DELETE /v1/sitebuilder/page-layouts/:id          → delete (cascade sections + assignments)
//
// The editor resolves a layout here, then does section CRUD by `pageLayoutId`.

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { sectionService, pageLayoutService } from '@sparx/sitebuilder';
import { ok } from '@sparx/api-core/envelope';
import { requireRole } from '@sparx/api-core/auth';
import {
  requireSitebuilderModule,
  toSitebuilderContext,
} from '../../../lib/sitebuilder-context.js';

// Optional target filter; the service-layer schemas own full validation of the
// create/materialize bodies (the established route ↔ service boundary).
const ListQuery = z.object({ target_id: z.string().min(1).max(63).optional() });

const pageLayoutRoutes: FastifyPluginAsync = (app) => {
  app.get('/v1/sitebuilder/page-layouts', async (request) => {
    requireRole(request, 'viewer');
    await requireSitebuilderModule(request);
    const q = ListQuery.parse(request.query);
    const pageLayouts = await pageLayoutService.list(toSitebuilderContext(request), q.target_id);
    return ok({ pageLayouts });
  });

  app.post('/v1/sitebuilder/page-layouts', async (request) => {
    requireRole(request, 'editor');
    await requireSitebuilderModule(request);
    const pageLayout = await pageLayoutService.getOrCreate(
      toSitebuilderContext(request),
      request.body
    );
    return ok(pageLayout);
  });

  app.post('/v1/sitebuilder/page-layouts/materialize', async (request) => {
    requireRole(request, 'editor');
    await requireSitebuilderModule(request);
    const ctx = toSitebuilderContext(request);
    const pageLayout = await pageLayoutService.materializeDefault(ctx, request.body);
    const sections = await sectionService.listForPageLayout(ctx, pageLayout.id);
    return ok({ pageLayout, sections });
  });

  app.post('/v1/sitebuilder/page-layouts/instantiate', async (request) => {
    requireRole(request, 'editor');
    await requireSitebuilderModule(request);
    const ctx = toSitebuilderContext(request);
    const pageLayout = await pageLayoutService.instantiate(ctx, request.body);
    const sections = await sectionService.listForPageLayout(ctx, pageLayout.id);
    return ok({ pageLayout, sections });
  });

  app.get('/v1/sitebuilder/page-layouts/:id', async (request) => {
    requireRole(request, 'viewer');
    await requireSitebuilderModule(request);
    const { id } = request.params as { id: string };
    const pageLayout = await pageLayoutService.getById(toSitebuilderContext(request), id);
    return ok(pageLayout);
  });

  app.patch('/v1/sitebuilder/page-layouts/:id', async (request) => {
    requireRole(request, 'editor');
    await requireSitebuilderModule(request);
    const { id } = request.params as { id: string };
    const pageLayout = await pageLayoutService.rename(
      toSitebuilderContext(request),
      id,
      request.body
    );
    return ok(pageLayout);
  });

  app.delete('/v1/sitebuilder/page-layouts/:id', async (request) => {
    requireRole(request, 'editor');
    await requireSitebuilderModule(request);
    const { id } = request.params as { id: string };
    await pageLayoutService.remove(toSitebuilderContext(request), id);
    return ok({ deleted: true });
  });

  return Promise.resolve();
};

export default pageLayoutRoutes;
