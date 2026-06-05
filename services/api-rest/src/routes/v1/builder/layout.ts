// Builder — the site layout catalog / chrome shell (docs/45). A tenant keeps many
// layouts; exactly one is ACTIVE (the live chrome the storefront serves). Mirrors
// the page catalog (pages.ts).
//
//   GET    /v1/builder/layouts              → list the tenant's layouts (seeds the
//                                              starter shell, active, on first call)
//   POST   /v1/builder/layouts              → create a layout (from a tree or the starter)
//   GET    /v1/builder/layouts/active       → the live layout (seeds on first call)
//   GET    /v1/builder/layouts/:id          → one layout
//   PATCH  /v1/builder/layouts/:id          → rename / save the draft tree
//   DELETE /v1/builder/layouts/:id          → remove (refused for the live layout)
//   POST   /v1/builder/layouts/:id/publish  → snapshot draft → published
//   POST   /v1/builder/layouts/:id/activate → make this published layout live
//
// Bodies are validated by the service-layer Zod schemas (the established route ↔
// service boundary), so api-rest keeps no @sparx/builder-schemas dependency.

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { layoutService } from '@sparx/builder';
import { ok } from '@sparx/api-core/envelope';
import { requireRole } from '@sparx/api-core/auth';
import { requireBuilderModule, toBuilderContext } from '../../../lib/builder-context.js';

const IdParam = z.object({ id: z.string().uuid() });

const builderLayoutRoutes: FastifyPluginAsync = (app) => {
  app.get('/v1/builder/layouts', async (request) => {
    requireRole(request, 'viewer');
    await requireBuilderModule(request);
    const layouts = await layoutService.listOrSeed(await toBuilderContext(request));
    return ok({ layouts });
  });

  app.post('/v1/builder/layouts', async (request) => {
    requireRole(request, 'editor');
    await requireBuilderModule(request);
    const layout = await layoutService.create(await toBuilderContext(request), request.body);
    return ok(layout);
  });

  // Static route registered before `:id` so it isn't swallowed by the param.
  app.get('/v1/builder/layouts/active', async (request) => {
    requireRole(request, 'viewer');
    await requireBuilderModule(request);
    // Seed-on-first-use (listOrSeed) then pick the live layout — the page editor
    // renders it as the locked backdrop, so it must never open unframed.
    const layouts = await layoutService.listOrSeed(await toBuilderContext(request));
    const active = layouts.find((l) => l.isActive) ?? layouts[0] ?? null;
    return ok(active);
  });

  app.get('/v1/builder/layouts/:id', async (request) => {
    requireRole(request, 'viewer');
    await requireBuilderModule(request);
    const { id } = IdParam.parse(request.params);
    const layout = await layoutService.get(await toBuilderContext(request), id);
    return ok(layout);
  });

  app.patch('/v1/builder/layouts/:id', async (request) => {
    requireRole(request, 'editor');
    await requireBuilderModule(request);
    const { id } = IdParam.parse(request.params);
    const layout = await layoutService.update(await toBuilderContext(request), id, request.body);
    return ok(layout);
  });

  app.delete('/v1/builder/layouts/:id', async (request) => {
    requireRole(request, 'editor');
    await requireBuilderModule(request);
    const { id } = IdParam.parse(request.params);
    await layoutService.remove(await toBuilderContext(request), id);
    return ok({ id });
  });

  app.post('/v1/builder/layouts/:id/publish', async (request) => {
    requireRole(request, 'editor');
    await requireBuilderModule(request);
    const { id } = IdParam.parse(request.params);
    const layout = await layoutService.publish(await toBuilderContext(request), id);
    return ok(layout);
  });

  app.post('/v1/builder/layouts/:id/activate', async (request) => {
    requireRole(request, 'editor');
    await requireBuilderModule(request);
    const { id } = IdParam.parse(request.params);
    const layout = await layoutService.setActive(await toBuilderContext(request), id);
    return ok(layout);
  });

  return Promise.resolve();
};

export default builderLayoutRoutes;
