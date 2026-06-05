// Builder — tenant-authored components (docs/53, P-A).
//
//   GET    /v1/builder/components                       → list the tenant's components (no tree)
//   GET    /v1/builder/components?include=tree          → list WITH each latest version tree (editor)
//   POST   /v1/builder/components                       → create a component (+ version 1)
//   GET    /v1/builder/components/:key                  → one component (latest version content)
//   PATCH  /v1/builder/components/:key                  → update identity; tree/propSpec → new version
//   DELETE /v1/builder/components/:key                  → remove (and all versions)
//   GET    /v1/builder/components/:key/usages           → where-used (pages + layouts)
//   POST   /v1/builder/components/:key/upgrade-placements → re-pin all placements to a version
//   GET    /v1/builder/components/:key/versions         → version history (newest first)
//   GET    /v1/builder/components/:key/versions/:version → one pinned version
//
// Bodies are validated by the service-layer Zod schemas (the established route ↔
// service boundary), so api-rest keeps no @sparx/builder-schemas dependency.

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { componentService } from '@sparx/builder';
import { ok } from '@sparx/api-core/envelope';
import { requireRole } from '@sparx/api-core/auth';
import { requireBuilderModule, toBuilderTenantContext } from '../../../lib/builder-context.js';

const KeyParam = z.object({ key: z.string().min(1).max(56) });
const VersionParam = z.object({
  key: z.string().min(1).max(56),
  version: z.coerce.number().int().min(1),
});
const ListQuery = z.object({ include: z.enum(['tree']).optional() });
const UpgradeBody = z.object({ version: z.coerce.number().int().min(1).optional() });

const builderComponentRoutes: FastifyPluginAsync = (app) => {
  app.get('/v1/builder/components', async (request) => {
    requireRole(request, 'viewer');
    await requireBuilderModule(request);
    const { include } = ListQuery.parse(request.query);
    // `?include=tree` returns each component WITH its latest version tree — what
    // the Builder editor needs to expand placements live (docs/53 P-B). The
    // catalog list omits trees (summaries only).
    const ctx = toBuilderTenantContext(request);
    const components =
      include === 'tree' ? await componentService.listFull(ctx) : await componentService.list(ctx);
    return ok({ components });
  });

  app.post('/v1/builder/components', async (request) => {
    requireRole(request, 'editor');
    await requireBuilderModule(request);
    const component = await componentService.create(toBuilderTenantContext(request), request.body);
    return ok(component);
  });

  app.get('/v1/builder/components/:key', async (request) => {
    requireRole(request, 'viewer');
    await requireBuilderModule(request);
    const { key } = KeyParam.parse(request.params);
    const component = await componentService.get(toBuilderTenantContext(request), key);
    return ok(component);
  });

  app.patch('/v1/builder/components/:key', async (request) => {
    requireRole(request, 'editor');
    await requireBuilderModule(request);
    const { key } = KeyParam.parse(request.params);
    const component = await componentService.update(
      toBuilderTenantContext(request),
      key,
      request.body
    );
    return ok(component);
  });

  app.delete('/v1/builder/components/:key', async (request) => {
    requireRole(request, 'editor');
    await requireBuilderModule(request);
    const { key } = KeyParam.parse(request.params);
    await componentService.remove(toBuilderTenantContext(request), key);
    return ok({ key });
  });

  app.get('/v1/builder/components/:key/usages', async (request) => {
    requireRole(request, 'viewer');
    await requireBuilderModule(request);
    const { key } = KeyParam.parse(request.params);
    const usages = await componentService.usages(toBuilderTenantContext(request), key);
    return ok(usages);
  });

  app.post('/v1/builder/components/:key/upgrade-placements', async (request) => {
    requireRole(request, 'editor');
    await requireBuilderModule(request);
    const { key } = KeyParam.parse(request.params);
    const { version } = UpgradeBody.parse(request.body ?? {});
    const result = await componentService.upgradeAllPlacements(
      toBuilderTenantContext(request),
      key,
      version
    );
    return ok(result);
  });

  app.get('/v1/builder/components/:key/versions', async (request) => {
    requireRole(request, 'viewer');
    await requireBuilderModule(request);
    const { key } = KeyParam.parse(request.params);
    const versions = await componentService.listVersions(toBuilderTenantContext(request), key);
    return ok({ versions });
  });

  app.get('/v1/builder/components/:key/versions/:version', async (request) => {
    requireRole(request, 'viewer');
    await requireBuilderModule(request);
    const { key, version } = VersionParam.parse(request.params);
    const result = await componentService.getVersion(toBuilderTenantContext(request), key, version);
    return ok(result);
  });

  return Promise.resolve();
};

export default builderComponentRoutes;
