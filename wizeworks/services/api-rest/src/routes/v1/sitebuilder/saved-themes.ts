// Site Builder — saved theme variants (docs/36 Brand+Theme tier).
//
//   GET    /v1/sitebuilder/saved-themes          → list the tenant's saved themes
//   POST   /v1/sitebuilder/saved-themes          → save a named variant
//   PATCH  /v1/sitebuilder/saved-themes/:id       → rename / update presentation
//   DELETE /v1/sitebuilder/saved-themes/:id       → remove
//   POST   /v1/sitebuilder/saved-themes/:id/apply → load into the working draft
//
// The brand/theme dashboard surface ("My themes" vs the read-only "Prebuilt"
// presets, docs/33) consumes these. Bodies are validated by the service-layer
// Zod schemas (the established route ↔ service boundary), so api-rest keeps no
// @wizeworks/sitebuilder-schemas dependency.

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { savedThemeService } from '@wizeworks/sitebuilder';
import { ok } from '@wizeworks/api-core/envelope';
import { requireRole } from '@wizeworks/api-core/auth';
import {
  requireSitebuilderModule,
  toSitebuilderContext,
  toSitebuilderPropertyContext,
} from '../../../lib/sitebuilder-context.js';
import { publishSiteUpdated } from '../../../lib/site-events.js';

const IdParam = z.object({ id: z.string().uuid() });

const savedThemeRoutes: FastifyPluginAsync = (app) => {
  app.get('/v1/sitebuilder/saved-themes', async (request) => {
    requireRole(request, 'viewer');
    await requireSitebuilderModule(request);
    const themes = await savedThemeService.list(toSitebuilderContext(request));
    return ok({ themes });
  });

  app.post('/v1/sitebuilder/saved-themes', async (request) => {
    requireRole(request, 'editor');
    await requireSitebuilderModule(request);
    const theme = await savedThemeService.create(toSitebuilderContext(request), request.body);
    return ok(theme);
  });

  app.patch('/v1/sitebuilder/saved-themes/:id', async (request) => {
    requireRole(request, 'editor');
    await requireSitebuilderModule(request);
    const { id } = IdParam.parse(request.params);
    const theme = await savedThemeService.update(toSitebuilderContext(request), id, request.body);
    return ok(theme);
  });

  app.delete('/v1/sitebuilder/saved-themes/:id', async (request) => {
    requireRole(request, 'editor');
    await requireSitebuilderModule(request);
    const { id } = IdParam.parse(request.params);
    const result = await savedThemeService.remove(toSitebuilderContext(request), id);
    return ok(result);
  });

  app.post('/v1/sitebuilder/saved-themes/:id/apply', async (request) => {
    requireRole(request, 'editor');
    await requireSitebuilderModule(request);
    const { id } = IdParam.parse(request.params);
    // `apply` writes the active site's draft config (docs/49 Phase 6) — property
    // context. The library CRUD above stays tenant-wide.
    const ctx = await toSitebuilderPropertyContext(request);
    const result = await savedThemeService.apply(ctx, id);
    // Applying a saved theme writes its colors and fonts straight onto the site's
    // LIVE brand override (no publish step), and that override is read out of the
    // website's cached business payload.
    await publishSiteUpdated(request.log, ctx.tenantId, ctx.userId ?? null, {
      propertyId: ctx.propertyId,
      changed: ['brand'],
    });
    return ok(result);
  });

  return Promise.resolve();
};

export default savedThemeRoutes;
