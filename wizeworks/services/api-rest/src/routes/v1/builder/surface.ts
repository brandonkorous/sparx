// Builder — Surface CSS compile (docs/47 §5), the editor's live-preview path.
//
//   POST /v1/builder/surface/compile  → compile the editor's authored class set
//                                        into CSS for the canvas (the `temp.css`)
//   GET  /v1/builder/surface/blocked  → author classes the allowlist drops (advisory)
//
// Auth'd + module-gated like the rest of /v1/builder. The compile is tenant-scoped
// so the tenant's utility allowlist (docs/61 §8 Phase 6b) applies in the canvas
// exactly as it will at publish — a blocked class silently no-ops, matching
// production (the `--st-*` tokens still resolve in the browser). The request body
// is validated by the service-layer Zod schema (the established route ↔ service
// boundary), so api-rest keeps no @wizeworks/builder-schemas dep.

import type { FastifyPluginAsync } from 'fastify';
import { surfaceCssService } from '@wizeworks/builder';
import { ok } from '@wizeworks/api-core/envelope';
import { requireRole } from '@wizeworks/api-core/auth';
import {
  requireBuilderModule,
  toBuilderTenantContext,
  toBuilderContext,
} from '../../../lib/builder-context.js';

const builderSurfaceRoutes: FastifyPluginAsync = (app) => {
  app.post('/v1/builder/surface/compile', async (request) => {
    requireRole(request, 'editor');
    await requireBuilderModule(request);
    // Tenant-scoped: the allowlist is tenant-wide, so the tenant ctx (no property
    // lookup) is enough to honor it in the live canvas.
    const ctx = toBuilderTenantContext(request);
    return ok(await surfaceCssService.compilePreview(ctx, request.body));
  });

  // A non-fatal advisory: which authored classes the allowlist (base + tenant
  // additions) currently drops, so the governance surface can tell the author WHY
  // a class they typed didn't render. Per-property — reads this site's draft trees.
  app.get('/v1/builder/surface/blocked', async (request) => {
    requireRole(request, 'editor');
    await requireBuilderModule(request);
    const ctx = await toBuilderContext(request);
    return ok({ blocked: await surfaceCssService.getDraftBlocked(ctx) });
  });

  return Promise.resolve();
};

export default builderSurfaceRoutes;
