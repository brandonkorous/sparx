// Industry starters — the cross-module provisioning tier (Wave 3). A starter
// composes module presets for a vertical (apparel, salon, wholesale, …); installing
// one stamps every preset whose module is enabled and records the tenant's chosen
// industry. Like /v1/presets these endpoints aren't gated to a single module — the
// install seam self-skips disabled-module slices — so they ride on requireAuth +
// role only.

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { ok } from '@wizeworks/api-core/envelope';
import { requireAuth, requireRole } from '@wizeworks/api-core/auth';

import { installIndustryStarter, listIndustryStarters } from '../../lib/industry-starters.js';

const InstallParams = z.object({
  slug: z.string().min(1).max(63),
});

// eslint-disable-next-line @typescript-eslint/require-await -- FastifyPluginAsync demands async; route registration is sync.
const industryStarterRoutes: FastifyPluginAsync = async (app) => {
  // Browse the industry starters, each resolved against the tenant's enabled
  // modules + currently-selected industry.
  app.get('/v1/industry-starters', async (request) => {
    requireRole(request, 'viewer');
    const auth = requireAuth(request);
    return ok(await listIndustryStarters({ tenantId: auth.tenantId, userId: auth.actorId }));
  });

  // Install an industry's starter config: stamp its presets into the enabled
  // modules and record `settings.industry`. Purely additive (each preset's marker
  // guards a re-stamp) — it fills empty slots, never removes a tenant's own data —
  // but it provisions across modules, so it's admin-only (mirrors blueprint install
  // and the Modules toggle). 404 if the starter is unknown.
  app.post('/v1/industry-starters/:slug/install', async (request, reply) => {
    requireRole(request, 'admin');
    const auth = requireAuth(request);
    const { slug } = InstallParams.parse(request.params);
    const result = await installIndustryStarter(
      { tenantId: auth.tenantId, userId: auth.actorId },
      slug
    );
    reply.code(201);
    return ok(result);
  });
};

export default industryStarterRoutes;
