// Builder — the binding schema (docs/43, the keystone).
//
//   GET /v1/builder/binding-schema → what a page can bind to (the tenant's real
//                                     CMS content types + code-defined
//                                     Commerce/CRM domain sources)
//
// Read-only; the editor's binding picker + preview consume it (Phase 1b).

import type { FastifyPluginAsync } from 'fastify';
import { bindingService } from '@sparx/builder';
import { ok } from '@sparx/api-core/envelope';
import { requireRole } from '@sparx/api-core/auth';
import { requireBuilderModule, toBuilderContext } from '../../../lib/builder-context.js';

const builderBindingRoutes: FastifyPluginAsync = (app) => {
  app.get('/v1/builder/binding-schema', async (request) => {
    requireRole(request, 'viewer');
    await requireBuilderModule(request);
    const schema = await bindingService.getSchema(toBuilderContext(request));
    return ok(schema);
  });

  return Promise.resolve();
};

export default builderBindingRoutes;
