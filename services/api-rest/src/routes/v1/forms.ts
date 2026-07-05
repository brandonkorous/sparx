// Site forms — the authenticated submissions inbox (docs/115).
//
//   GET    /v1/forms/submissions        → list (tenant-wide, newest first) + counts
//   GET    /v1/forms/submissions/:id    → one submission
//   PATCH  /v1/forms/submissions/:id    → set status (read | spam | archived | new)
//   DELETE /v1/forms/submissions/:id    → remove
//
// Gated on the `builder` module (forms are a site-builder feature). The public
// SUBMIT endpoint lives at routes/v1/public/forms.ts and is unauthenticated.

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { formService } from '@sparx/builder';
import { ok } from '@sparx/api-core/envelope';
import { badRequest } from '@sparx/api-core/errors';
import { requireRole } from '@sparx/api-core/auth';
import { requireBuilderModule, toBuilderContext } from '../../lib/builder-context.js';

const IdParam = z.object({ id: z.string().uuid() });
const ListQuery = z.object({
  status: z.string().max(20).optional(),
  formNodeId: z.string().max(255).optional(),
  cursor: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
});
const StatusBody = z.object({ status: z.string().max(20) });

const formsRoutes: FastifyPluginAsync = (app) => {
  app.get('/v1/forms/submissions', async (request) => {
    requireRole(request, 'viewer');
    await requireBuilderModule(request);
    const q = ListQuery.parse(request.query);
    const ctx = await toBuilderContext(request);
    const [submissions, counts] = await Promise.all([
      formService.listSubmissions(ctx, q),
      formService.submissionCounts(ctx),
    ]);
    return ok({ submissions, counts });
  });

  app.get('/v1/forms/submissions/:id', async (request) => {
    requireRole(request, 'viewer');
    await requireBuilderModule(request);
    const { id } = IdParam.parse(request.params);
    const submission = await formService.getSubmission(await toBuilderContext(request), id);
    return ok(submission);
  });

  app.patch('/v1/forms/submissions/:id', async (request) => {
    requireRole(request, 'editor');
    await requireBuilderModule(request);
    const { id } = IdParam.parse(request.params);
    const { status } = StatusBody.parse(request.body);
    if (!formService.isSubmissionStatus(status)) throw badRequest('Invalid status.');
    const submission = await formService.setSubmissionStatus(
      await toBuilderContext(request),
      id,
      status
    );
    return ok(submission);
  });

  app.delete('/v1/forms/submissions/:id', async (request) => {
    requireRole(request, 'editor');
    await requireBuilderModule(request);
    const { id } = IdParam.parse(request.params);
    await formService.deleteSubmission(await toBuilderContext(request), id);
    return ok({ id });
  });

  return Promise.resolve();
};

export default formsRoutes;
