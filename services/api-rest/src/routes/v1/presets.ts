// Module presets — the cross-module install seam (the reusable generalization of
// the fitment dictionary library). A *module preset* is one installable,
// data-as-code config pack scoped to a single module (a fitment dictionary, a
// tax-zone set, a CRM pipeline, …). The à-la-carte picker and (later) industry
// starters both install through here.
//
// These endpoints are NOT gated to a single module — the registry self-filters
// the listing to the caller's enabled modules, and the install seam refuses a
// preset whose module is disabled. So they ride on requireAuth + role only; the
// per-preset module gate lives in installPreset (lib/preset-registry.ts).

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { ok } from '@sparx/api-core/envelope';
import { requireAuth, requireRole } from '@sparx/api-core/auth';
import type { ModulePresetKind, ModuleSlug } from '@sparx/auth';

import { installPreset, listInstallablePresets } from '../../lib/preset-registry.js';

const ListQuery = z.object({
  module: z.string().min(1).max(32).optional(),
  kind: z.string().min(1).max(32).optional(),
});

const InstallParams = z.object({
  module: z.string().min(1).max(32),
  slug: z.string().min(1).max(63),
});

// eslint-disable-next-line @typescript-eslint/require-await -- FastifyPluginAsync demands async; route registration is sync.
const presetRoutes: FastifyPluginAsync = async (app) => {
  // Browse the presets installable for the caller's tenant. Self-filters to the
  // tenant's enabled modules; `?module=&kind=` narrow it further (the fitment
  // page asks for module=commerce&kind=fitment).
  app.get('/v1/presets', async (request) => {
    requireRole(request, 'viewer');
    const auth = requireAuth(request);
    const q = ListQuery.parse(request.query);
    return ok(
      await listInstallablePresets(
        { tenantId: auth.tenantId, userId: auth.actorId },
        {
          ...(q.module ? { module: q.module as ModuleSlug } : {}),
          ...(q.kind ? { kind: q.kind as ModulePresetKind } : {}),
        }
      )
    );
  });

  // Install one preset. 404 if unknown; MODULE_DISABLED (→ 404 envelope) if the
  // owning module isn't active; 409 if the preset is already installed.
  app.post('/v1/presets/:module/:slug/install', async (request, reply) => {
    requireRole(request, 'editor');
    const auth = requireAuth(request);
    const { module, slug } = InstallParams.parse(request.params);
    const created = await installPreset(
      { tenantId: auth.tenantId, userId: auth.actorId },
      module as ModuleSlug,
      slug
    );
    reply.code(201);
    return ok(created);
  });
};

export default presetRoutes;
