// Builder — brand-governed section archetypes (docs/61 §6 Phase 6b).
//
//   GET    /v1/builder/archetypes              → the catalog (summaries, no tree)
//   GET    /v1/builder/archetypes?include=tree → ENABLED archetypes WITH trees (palette)
//   POST   /v1/builder/archetypes              → create a tenant archetype
//   GET    /v1/builder/archetypes/:key         → one archetype (with tree)
//   PATCH  /v1/builder/archetypes/:key         → update identity / tree / enabled / order
//   DELETE /v1/builder/archetypes/:key         → remove (hard delete; nothing references it)
//
// Reads are viewer (the palette fetches the enabled set); writes are admin (owner
// satisfies it via the role hierarchy) — governance shapes what every author can
// stamp. Bodies are validated by the service-layer Zod schemas (the established
// route ↔ service boundary), so api-rest keeps no @wizeworks/builder-schemas dep.

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { archetypeService } from '@wizeworks/builder';
import { ok } from '@wizeworks/api-core/envelope';
import { requireRole } from '@wizeworks/api-core/auth';
import { requireBuilderModule, toBuilderTenantContext } from '../../../lib/builder-context.js';

const KeyParam = z.object({ key: z.string().min(1).max(64) });
const ListQuery = z.object({ include: z.enum(['tree']).optional() });

const builderArchetypeRoutes: FastifyPluginAsync = (app) => {
  app.get('/v1/builder/archetypes', async (request) => {
    requireRole(request, 'viewer');
    await requireBuilderModule(request);
    const { include } = ListQuery.parse(request.query);
    const ctx = toBuilderTenantContext(request);
    // `?include=tree` returns the ENABLED archetypes WITH their trees — what the
    // Add palette stamps. The catalog list omits trees (summaries only).
    const archetypes =
      include === 'tree'
        ? await archetypeService.listForPalette(ctx)
        : await archetypeService.listOrSeed(ctx);
    return ok({ archetypes });
  });

  app.post('/v1/builder/archetypes', async (request) => {
    requireRole(request, 'admin');
    await requireBuilderModule(request);
    const archetype = await archetypeService.create(toBuilderTenantContext(request), request.body);
    return ok(archetype);
  });

  app.get('/v1/builder/archetypes/:key', async (request) => {
    requireRole(request, 'viewer');
    await requireBuilderModule(request);
    const { key } = KeyParam.parse(request.params);
    return ok(await archetypeService.get(toBuilderTenantContext(request), key));
  });

  app.patch('/v1/builder/archetypes/:key', async (request) => {
    requireRole(request, 'admin');
    await requireBuilderModule(request);
    const { key } = KeyParam.parse(request.params);
    const archetype = await archetypeService.update(
      toBuilderTenantContext(request),
      key,
      request.body
    );
    return ok(archetype);
  });

  app.delete('/v1/builder/archetypes/:key', async (request) => {
    requireRole(request, 'admin');
    await requireBuilderModule(request);
    const { key } = KeyParam.parse(request.params);
    await archetypeService.remove(toBuilderTenantContext(request), key);
    return ok({ key });
  });

  return Promise.resolve();
};

export default builderArchetypeRoutes;
