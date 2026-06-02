// Builder — the site layout / chrome shell (docs/45). One layout per tenant, so
// the surface is singular (no catalog, no :id).
//
//   GET   /v1/builder/layout          → the tenant's layout (seeds the starter
//                                        shell on first call)
//   PATCH /v1/builder/layout          → save the draft tree and/or rename
//   POST  /v1/builder/layout/publish  → snapshot draft → published
//
// Bodies are validated by the service-layer Zod schemas (the established route ↔
// service boundary), so api-rest keeps no @sparx/builder-schemas dependency.

import type { FastifyPluginAsync } from 'fastify';
import { layoutService } from '@sparx/builder';
import { ok } from '@sparx/api-core/envelope';
import { requireRole } from '@sparx/api-core/auth';
import { requireBuilderModule, toBuilderContext } from '../../../lib/builder-context.js';

const builderLayoutRoutes: FastifyPluginAsync = (app) => {
  app.get('/v1/builder/layout', async (request) => {
    requireRole(request, 'viewer');
    await requireBuilderModule(request);
    const layout = await layoutService.getOrSeed(toBuilderContext(request));
    return ok(layout);
  });

  app.patch('/v1/builder/layout', async (request) => {
    requireRole(request, 'editor');
    await requireBuilderModule(request);
    const layout = await layoutService.update(toBuilderContext(request), request.body);
    return ok(layout);
  });

  app.post('/v1/builder/layout/publish', async (request) => {
    requireRole(request, 'editor');
    await requireBuilderModule(request);
    const layout = await layoutService.publish(toBuilderContext(request));
    return ok(layout);
  });

  return Promise.resolve();
};

export default builderLayoutRoutes;
