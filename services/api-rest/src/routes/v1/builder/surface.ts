// Builder — Surface CSS compile (docs/47 §5), the editor's live-preview path.
//
//   POST /v1/builder/surface/compile  → compile the editor's authored class set
//                                        into CSS for the canvas (the `temp.css`)
//
// Auth'd + module-gated like the rest of /v1/builder. Stateless: the compile is a
// pure function of the posted class list (no tenant data — the `--sf-*` tokens
// resolve in the browser), so it needs no tenant context, only the editor role.
// The request body is validated by the service-layer Zod schema (the established
// route ↔ service boundary), so api-rest keeps no @sparx/builder-schemas dep.

import type { FastifyPluginAsync } from 'fastify';
import { surfaceCssService } from '@sparx/builder';
import { ok } from '@sparx/api-core/envelope';
import { requireRole } from '@sparx/api-core/auth';
import { requireBuilderModule } from '../../../lib/builder-context.js';

const builderSurfaceRoutes: FastifyPluginAsync = (app) => {
  app.post('/v1/builder/surface/compile', async (request) => {
    requireRole(request, 'editor');
    await requireBuilderModule(request);
    return ok(await surfaceCssService.compilePreview(request.body));
  });

  return Promise.resolve();
};

export default builderSurfaceRoutes;
