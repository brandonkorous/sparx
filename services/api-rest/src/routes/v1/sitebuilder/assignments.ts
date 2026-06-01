// Site Builder — layout assignment (docs/36 §6, docs/handoffs/sitebuilder-pc-spec.md).
//
//   GET    /v1/sitebuilder/assignments/resolution?target_id=&item_ref=
//                                                  → { assignedLayoutId, defaultLayoutId } (picker state)
//   GET    /v1/sitebuilder/assignments/defaults    → every per-target default (Layouts surface badges)
//   GET    /v1/sitebuilder/assignments?target_id=  → the per-item overrides for a target
//   POST   /v1/sitebuilder/assignments             → pin an item to a layout ({ targetId, itemRef, pageLayoutId })
//   DELETE /v1/sitebuilder/assignments?target_id=&item_ref=  → clear a per-item override
//   POST   /v1/sitebuilder/assignments/default     → set the target default ({ targetId, pageLayoutId })
//   DELETE /v1/sitebuilder/assignments/default?target_id=    → clear the target default
//
// SB OWNS the assignment; the Commerce/CMS item editors call these (the record's
// stable id is `item_ref`). Bodies are validated by the service-layer Zod schemas
// (the route ↔ service boundary), so api-rest keeps no @sparx/sitebuilder-schemas dep.

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { assignmentService } from '@sparx/sitebuilder';
import { ok } from '@sparx/api-core/envelope';
import { requireRole } from '@sparx/api-core/auth';
import {
  requireSitebuilderModule,
  toSitebuilderContext,
} from '../../../lib/sitebuilder-context.js';

const TargetItemQuery = z.object({
  target_id: z.string().min(1).max(63),
  item_ref: z.string().min(1).max(255),
});
const TargetQuery = z.object({ target_id: z.string().min(1).max(63) });

const assignmentRoutes: FastifyPluginAsync = (app) => {
  app.get('/v1/sitebuilder/assignments/resolution', async (request) => {
    requireRole(request, 'viewer');
    await requireSitebuilderModule(request);
    const q = TargetItemQuery.parse(request.query);
    const resolution = await assignmentService.getResolution(
      toSitebuilderContext(request),
      q.target_id,
      q.item_ref
    );
    return ok(resolution);
  });

  app.get('/v1/sitebuilder/assignments/defaults', async (request) => {
    requireRole(request, 'viewer');
    await requireSitebuilderModule(request);
    const defaults = await assignmentService.listDefaults(toSitebuilderContext(request));
    return ok({ defaults });
  });

  app.get('/v1/sitebuilder/assignments', async (request) => {
    requireRole(request, 'viewer');
    await requireSitebuilderModule(request);
    const q = TargetQuery.parse(request.query);
    const assignments = await assignmentService.listForTarget(
      toSitebuilderContext(request),
      q.target_id
    );
    return ok({ assignments });
  });

  app.post('/v1/sitebuilder/assignments', async (request) => {
    requireRole(request, 'editor');
    await requireSitebuilderModule(request);
    const assignment = await assignmentService.assign(toSitebuilderContext(request), request.body);
    return ok(assignment);
  });

  app.delete('/v1/sitebuilder/assignments', async (request) => {
    requireRole(request, 'editor');
    await requireSitebuilderModule(request);
    const q = TargetItemQuery.parse(request.query);
    await assignmentService.unassign(toSitebuilderContext(request), q.target_id, q.item_ref);
    return ok({ deleted: true });
  });

  app.post('/v1/sitebuilder/assignments/default', async (request) => {
    requireRole(request, 'editor');
    await requireSitebuilderModule(request);
    const result = await assignmentService.setDefault(toSitebuilderContext(request), request.body);
    return ok(result);
  });

  app.delete('/v1/sitebuilder/assignments/default', async (request) => {
    requireRole(request, 'editor');
    await requireSitebuilderModule(request);
    const q = TargetQuery.parse(request.query);
    await assignmentService.clearDefault(toSitebuilderContext(request), q.target_id);
    return ok({ deleted: true });
  });

  return Promise.resolve();
};

export default assignmentRoutes;
