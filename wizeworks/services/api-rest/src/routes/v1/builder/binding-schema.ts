// Builder — the binding schema (docs/43, the keystone).
//
//   GET /v1/builder/binding-schema       → what a PAGE can bind to (the tenant's
//                                           real CMS content types + code-defined
//                                           Commerce/CRM domain sources)
//   GET /v1/builder/email-binding-schema → what an EMAIL can bind to (docs/52 §7):
//                                           the EMAIL_SOURCES + CMS collections
//
// Read-only; the editor's binding picker + preview consume it (Phase 1b).

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { bindingService } from '@wizeworks/builder';
import { ok } from '@wizeworks/api-core/envelope';
import { requireRole } from '@wizeworks/api-core/auth';
import { requireBuilderModule, toBuilderTenantContext } from '../../../lib/builder-context.js';

// `productTypeKey` (docs/143 Option B) scopes the catalog to a product page's target
// product type, so the picker offers that type's `attributes.<key>` fields.
const BindingSchemaQuery = z.object({
  productTypeKey: z.string().min(1).max(63).optional(),
});

const builderBindingRoutes: FastifyPluginAsync = (app) => {
  app.get('/v1/builder/binding-schema', async (request) => {
    requireRole(request, 'viewer');
    await requireBuilderModule(request);
    const q = BindingSchemaQuery.parse(request.query);
    const schema = await bindingService.getSchema(toBuilderTenantContext(request), {
      productTypeKey: q.productTypeKey,
    });
    return ok(schema);
  });

  app.get('/v1/builder/email-binding-schema', async (request) => {
    requireRole(request, 'viewer');
    await requireBuilderModule(request);
    const schema = await bindingService.getEmailSchema(toBuilderTenantContext(request));
    return ok(schema);
  });

  return Promise.resolve();
};

export default builderBindingRoutes;
