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
//   GET    /v1/builder/layouts/silica       → the ACTIVE layout's silica chrome, on
//                                              its own — the layout builder's load
//   PUT    /v1/builder/layouts/silica       → replace the ACTIVE layout's silica
//                                              chrome, leaving pages, theme and
//                                              symbols untouched
//   POST   /v1/builder/layouts/silica/publish
//                                            → put the chrome live on its own,
//                                              leaving every page draft where it is
//
// Bodies are validated by the service-layer Zod schemas (the established route ↔
// service boundary), so api-rest keeps no @sparx/builder-schemas dependency.

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { layoutService, siteService } from '@sparx/builder';
import { ok } from '@sparx/api-core/envelope';
import { requireRole } from '@sparx/api-core/auth';
import {
  requireBuilderModule,
  siteChromeOptions,
  toBuilderContext,
} from '../../../lib/builder-context.js';

const IdParam = z.object({ id: z.string().uuid() });
const SilicaBody = z.object({ root: z.unknown() });

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

  /**
   * The ACTIVE layout's silica chrome, alone — the layout builder's load.
   *
   * `GET /v1/builder/site` answers this too, but only alongside every page body and
   * the whole symbol library. This reads one row, so opening the layout builder costs
   * the same on a three-page site and a three-hundred-page one.
   *
   * The module flags shape the STARTER chrome a property that has never been authored
   * falls back to — a content-only tenant must not open onto a Shop link.
   */
  app.get('/v1/builder/layouts/silica', async (request) => {
    requireRole(request, 'viewer');
    await requireBuilderModule(request);
    const ctx = await toBuilderContext(request);
    const frame = await siteService.loadFrame(ctx, await siteChromeOptions(ctx.tenantId));
    return ok(frame);
  });

  /**
   * Replace the ACTIVE layout's silica chrome — the layout builder's Save.
   *
   * Registered before `:id` so the static path is not swallowed by the param.
   * Site-scoped rather than layout-scoped because Piggles gives a site exactly one
   * layout; when that stops being true this takes an id like its neighbours.
   */
  app.put('/v1/builder/layouts/silica', async (request) => {
    requireRole(request, 'editor');
    await requireBuilderModule(request);
    const body = SilicaBody.parse(request.body);
    const ctx = await toBuilderContext(request);
    const change = await siteService.setFrame(ctx, { root: body.root as never });
    return ok({ written: change !== null, reloadHints: change?.reloadHints ?? [] });
  });

  /**
   * Put the chrome live on its own.
   *
   * A typo in the header should not oblige an author to ship every half-built page
   * with the fix, which is what the whole-site publish makes them do. The release it
   * seals carries the previous release's manifest forward with this layout swapped
   * in, so rollback still restores a complete site.
   */
  app.post('/v1/builder/layouts/silica/publish', async (request) => {
    requireRole(request, 'editor');
    await requireBuilderModule(request);
    const published = await siteService.publishFrame(await toBuilderContext(request));
    return ok(published);
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
