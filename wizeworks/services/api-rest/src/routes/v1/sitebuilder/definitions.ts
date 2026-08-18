// Site Builder — custom section definitions (docs/38 Phase C). The tenant's own
// section TYPES (field spec + render-template AST), the data-defined analogue of
// a code SECTION_REGISTRY entry. Placed sections reference one by `custom:<slug>`.
//
//   GET    /v1/sitebuilder/definitions        → list the tenant's custom sections
//   POST   /v1/sitebuilder/definitions        → create one
//   GET    /v1/sitebuilder/definitions/:slug   → fetch one
//   PUT    /v1/sitebuilder/definitions/:slug   → replace (bumps version)
//   DELETE /v1/sitebuilder/definitions/:slug   → remove (refused while in use)
//
// Bodies are validated by the service-layer Zod schemas (SectionDefinitionInput),
// so api-rest keeps no @wizeworks/sitebuilder-schemas dependency. The slug is the
// immutable type identity, addressed in the path.

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { definitionService } from '@wizeworks/sitebuilder';
import { ok } from '@wizeworks/api-core/envelope';
import { requireRole } from '@wizeworks/api-core/auth';
import {
  requireSitebuilderModule,
  toSitebuilderContext,
} from '../../../lib/sitebuilder-context.js';

const SlugParam = z.object({ slug: z.string().min(1).max(56) });

const definitionRoutes: FastifyPluginAsync = (app) => {
  app.get('/v1/sitebuilder/definitions', async (request) => {
    requireRole(request, 'viewer');
    await requireSitebuilderModule(request);
    const definitions = await definitionService.list(toSitebuilderContext(request));
    return ok({ definitions });
  });

  app.post('/v1/sitebuilder/definitions', async (request) => {
    requireRole(request, 'editor');
    await requireSitebuilderModule(request);
    const definition = await definitionService.create(toSitebuilderContext(request), request.body);
    return ok(definition);
  });

  app.get('/v1/sitebuilder/definitions/:slug', async (request) => {
    requireRole(request, 'viewer');
    await requireSitebuilderModule(request);
    const { slug } = SlugParam.parse(request.params);
    const definition = await definitionService.get(toSitebuilderContext(request), slug);
    return ok(definition);
  });

  app.put('/v1/sitebuilder/definitions/:slug', async (request) => {
    requireRole(request, 'editor');
    await requireSitebuilderModule(request);
    const { slug } = SlugParam.parse(request.params);
    const definition = await definitionService.update(
      toSitebuilderContext(request),
      slug,
      request.body
    );
    return ok(definition);
  });

  app.delete('/v1/sitebuilder/definitions/:slug', async (request) => {
    requireRole(request, 'editor');
    await requireSitebuilderModule(request);
    const { slug } = SlugParam.parse(request.params);
    const result = await definitionService.remove(toSitebuilderContext(request), slug);
    return ok(result);
  });

  return Promise.resolve();
};

export default definitionRoutes;
