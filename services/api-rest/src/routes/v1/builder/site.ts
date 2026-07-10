// Builder — the silica-native SITE persistence seam (docs/118 Stage 3).
//
//   GET    /v1/builder/site          → the property's stored silica site (pages +
//                                       frame + symbols), theme-less; null when the
//                                       property has no silica site materialized yet
//   PUT    /v1/builder/site          → reconcile the whole extracted `Site` (the
//                                       debounced `<Builder onChange>` autosave)
//   POST   /v1/builder/site/publish  → snapshot every silica draft tree → published
//   DELETE /v1/builder/site          → discard the silica site; the editor re-opens
//                                       on the current starter seed (the re-seed
//                                       lifecycle — catalog composites are STAMPED,
//                                       so an improved factory can only reach a page
//                                       that is stamped again). Destructive: admin.
//
// The silica `<Builder>` owns the multi-page site in memory and hands back the
// WHOLE `Site` on every edit, so persistence is one whole-site reconcile — not the
// per-page PATCH the sparx studio uses. Bodies are validated by the service-layer
// Zod schema (`SiteSyncInput`), keeping api-rest free of @sparx/builder-schemas.

import type { FastifyPluginAsync } from 'fastify';
import { siteService } from '@sparx/builder';
import { ok } from '@sparx/api-core/envelope';
import { requireRole } from '@sparx/api-core/auth';
import { requireBuilderModule, toBuilderContext } from '../../../lib/builder-context.js';

const builderSiteRoutes: FastifyPluginAsync = (app) => {
  app.get('/v1/builder/site', async (request) => {
    requireRole(request, 'viewer');
    await requireBuilderModule(request);
    const site = await siteService.load(await toBuilderContext(request));
    return ok({ site });
  });

  app.put('/v1/builder/site', async (request) => {
    requireRole(request, 'editor');
    await requireBuilderModule(request);
    await siteService.sync(await toBuilderContext(request), request.body);
    return ok({ saved: true });
  });

  app.post('/v1/builder/site/publish', async (request) => {
    requireRole(request, 'editor');
    await requireBuilderModule(request);
    await siteService.publish(await toBuilderContext(request));
    return ok({ published: true });
  });

  // Destructive — it throws away every silica page + the frame, published included.
  // `admin`, not `editor`: an editor may publish their own work, but discarding the
  // whole site is an owner's decision.
  app.delete('/v1/builder/site', async (request) => {
    requireRole(request, 'admin');
    await requireBuilderModule(request);
    await siteService.reset(await toBuilderContext(request));
    return ok({ reset: true });
  });

  return Promise.resolve();
};

export default builderSiteRoutes;
