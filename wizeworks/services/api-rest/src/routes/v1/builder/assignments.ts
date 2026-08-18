// Builder — per-record template overrides + the template option set (docs/51 §6).
//
//   GET /v1/builder/template-options ?recordType=<rt>
//     → the collection templates a record type can resolve to (type default flagged)
//   GET /v1/builder/assignment       ?recordType=<rt>&itemRef=<id>
//     → the record's current override, or null when it uses the type default
//   PUT /v1/builder/assignment       { recordType, itemRef, builderPageId | null }
//     → set the override (or clear it with builderPageId: null)
//
// The dashboard's entry-editor "Page template" picker consumes these. Bodies/
// queries are validated by the service-layer Zod (the established route ↔ service
// boundary), so api-rest keeps no @wizeworks/builder-schemas dependency.

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { assignmentService } from '@wizeworks/builder';
import { ok } from '@wizeworks/api-core/envelope';
import { requireRole } from '@wizeworks/api-core/auth';
import { requireBuilderModule, toBuilderContext } from '../../../lib/builder-context.js';

const OptionsQuery = z.object({ recordType: z.string().min(1).max(63) });
const AssignmentQuery = z.object({
  recordType: z.string().min(1).max(63),
  itemRef: z.string().min(1).max(255),
});

const builderAssignmentRoutes: FastifyPluginAsync = (app) => {
  app.get('/v1/builder/template-options', async (request) => {
    requireRole(request, 'viewer');
    await requireBuilderModule(request);
    const { recordType } = OptionsQuery.parse(request.query);
    const options = await assignmentService.listTemplateOptions(
      await toBuilderContext(request),
      recordType
    );
    return ok({ options });
  });

  app.get('/v1/builder/assignment', async (request) => {
    requireRole(request, 'viewer');
    await requireBuilderModule(request);
    const { recordType, itemRef } = AssignmentQuery.parse(request.query);
    const assignment = await assignmentService.getAssignment(
      await toBuilderContext(request),
      recordType,
      itemRef
    );
    return ok({ assignment });
  });

  app.put('/v1/builder/assignment', async (request) => {
    requireRole(request, 'editor');
    await requireBuilderModule(request);
    const assignment = await assignmentService.setAssignment(
      await toBuilderContext(request),
      request.body
    );
    return ok({ assignment });
  });

  return Promise.resolve();
};

export default builderAssignmentRoutes;
