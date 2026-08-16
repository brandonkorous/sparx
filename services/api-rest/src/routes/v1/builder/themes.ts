// Builder — a tenant's LOOKS, as documents with their own lifecycle.
//
//   GET    /v1/builder/themes                  → the tenant's own looks
//   POST   /v1/builder/themes                  → create one (or install a copy)
//   GET    /v1/builder/themes/presets          → the platform's ready-made looks,
//                                                 shelved. Code, not rows — using
//                                                 one COPIES it into a row
//   GET    /v1/builder/themes/selection        → what THIS site wears, draft + live
//   PUT    /v1/builder/themes/selection        → point this site at a look (DRAFT
//                                                 only; visitors see it when the
//                                                 site publishes)
//   GET    /v1/builder/themes/:id              → one look
//   PATCH  /v1/builder/themes/:id              → rename / save the draft tokens
//   DELETE /v1/builder/themes/:id              → remove (refused while a site wears it)
//   POST   /v1/builder/themes/:id/publish      → snapshot draft → published
//   POST   /v1/builder/themes/:id/duplicate    → copy it
//   GET    /v1/builder/themes/:id/usages       → which sites wear it
//
// A theme is TENANT-wide — a business with a shop and a blog wants one look on
// both — so the collection routes take the tenant context and only `selection`
// takes the property. That asymmetry is the whole point of the tier.
//
// Bodies are validated by the service-layer Zod schemas, so api-rest keeps no
// @sparx/builder-schemas dependency.

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { themeService } from '@sparx/builder';
import { SPARX_THEME_GROUPS } from '@sparx/silica-catalog';
import { ok } from '@sparx/api-core/envelope';
import { requireRole } from '@sparx/api-core/auth';
import {
  requireBuilderModule,
  toBuilderContext,
  toBuilderTenantContext,
} from '../../../lib/builder-context.js';

const IdParam = z.object({ id: z.string().uuid() });
const SelectionBody = z.object({ themeId: z.string().uuid().nullable() });
const DuplicateBody = z.object({ name: z.string().min(1).max(160).optional() }).optional();

const builderThemeRoutes: FastifyPluginAsync = (app) => {
  app.get('/v1/builder/themes', async (request) => {
    requireRole(request, 'viewer');
    await requireBuilderModule(request);
    const themes = await themeService.list(toBuilderTenantContext(request));
    return ok({ themes });
  });

  app.post('/v1/builder/themes', async (request) => {
    requireRole(request, 'editor');
    await requireBuilderModule(request);
    const theme = await themeService.create(toBuilderTenantContext(request), request.body);
    return ok(theme);
  });

  // Static routes before `:id`, or the param swallows them.
  app.get('/v1/builder/themes/presets', async (request) => {
    requireRole(request, 'viewer');
    await requireBuilderModule(request);
    // Shipped in code, shelved by kind of business. Served rather than duplicated
    // in the console so one catalog answers for every brand and every surface.
    return ok({ groups: SPARX_THEME_GROUPS });
  });

  app.get('/v1/builder/themes/selection', async (request) => {
    requireRole(request, 'viewer');
    await requireBuilderModule(request);
    return ok(await themeService.selection(await toBuilderContext(request)));
  });

  app.put('/v1/builder/themes/selection', async (request) => {
    requireRole(request, 'editor');
    await requireBuilderModule(request);
    const body = SelectionBody.parse(request.body);
    return ok(await themeService.apply(await toBuilderContext(request), body.themeId));
  });

  app.get('/v1/builder/themes/:id', async (request) => {
    requireRole(request, 'viewer');
    await requireBuilderModule(request);
    const { id } = IdParam.parse(request.params);
    return ok(await themeService.get(toBuilderTenantContext(request), id));
  });

  app.patch('/v1/builder/themes/:id', async (request) => {
    requireRole(request, 'editor');
    await requireBuilderModule(request);
    const { id } = IdParam.parse(request.params);
    return ok(await themeService.update(toBuilderTenantContext(request), id, request.body));
  });

  app.delete('/v1/builder/themes/:id', async (request, reply) => {
    requireRole(request, 'editor');
    await requireBuilderModule(request);
    const { id } = IdParam.parse(request.params);
    await themeService.remove(toBuilderTenantContext(request), id);
    return reply.code(204).send();
  });

  app.post('/v1/builder/themes/:id/publish', async (request) => {
    requireRole(request, 'editor');
    await requireBuilderModule(request);
    const { id } = IdParam.parse(request.params);
    return ok(await themeService.publish(toBuilderTenantContext(request), id));
  });

  app.post('/v1/builder/themes/:id/duplicate', async (request) => {
    requireRole(request, 'editor');
    await requireBuilderModule(request);
    const { id } = IdParam.parse(request.params);
    const body = DuplicateBody.parse(request.body);
    return ok(await themeService.duplicate(toBuilderTenantContext(request), id, body?.name));
  });

  app.get('/v1/builder/themes/:id/usages', async (request) => {
    requireRole(request, 'viewer');
    await requireBuilderModule(request);
    const { id } = IdParam.parse(request.params);
    // Deleting or changing a look repaints every site wearing it, so this is what
    // makes either an informed decision rather than a surprise.
    return ok({ sites: await themeService.usages(toBuilderTenantContext(request), id) });
  });

  return Promise.resolve();
};

export default builderThemeRoutes;
