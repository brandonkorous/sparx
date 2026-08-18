// Lead + deal scoring (docs/144 §10) — the model, the number, and why.
//
//   GET    /v1/crm/scoring/fields             → what a rule can ask about
//   GET    /v1/crm/scoring/models             → the tenant's models
//   POST   /v1/crm/scoring/models             → create one
//   GET    /v1/crm/scoring/models/:id         → one
//   PATCH  /v1/crm/scoring/models/:id         → edit
//   DELETE /v1/crm/scoring/models/:id         → archive
//   POST   /v1/crm/scoring/recompute          → re-score a page of records
//   POST   /v1/crm/scoring/adjust             → move one score by hand
//   POST   /v1/crm/scoring/preview            → what a rule set WOULD score
//   GET    /v1/crm/scoring/history            → one record's score history
//
// `/fields`, `/recompute`, `/adjust`, `/preview` and `/history` are STATIC
// segments under `/scoring`, and the models live under `/scoring/models` — so
// none of them can be swallowed by the `:id` pattern. Fastify resolves a static
// path ahead of a parametric one regardless of registration order, but keeping
// the ids in their own sub-tree means nobody has to know that.

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { scoringService, scoringFields } from '@wizeworks/crm';
import { ok } from '@wizeworks/api-core/envelope';
import { requireRole } from '@wizeworks/api-core/auth';
import { requireCrmModule, toCrmContext } from '../../../lib/crm-context.js';
import { reachableSiteIds, resolvePropertyId } from '../../../lib/property.js';

const PathId = z.object({ id: z.string().uuid() });

const ListQuery = z.object({
  object_key: z.string().min(2).max(63).optional(),
});

const HistoryQuery = z.object({
  object_key: z.string().min(2).max(63),
  record_id: z.string().uuid(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
});

const PreviewBody = z.object({
  objectKey: z.string().min(2).max(63),
  recordId: z.string().uuid(),
  rules: z.unknown().optional(),
  decayPerDay: z.number().min(0).max(100).nullable().optional(),
  maxScore: z.number().int().min(1).max(1000).optional(),
});

const scoringRoutes: FastifyPluginAsync = (app) => {
  /**
   * What a scoring rule can ask about.
   *
   * Served from the SAME catalog the evaluator reads, so the editor can only
   * offer questions that will actually be answered. A hand-kept second list in
   * the UI is how you end up with a rule referencing a field that silently never
   * matches — and a score of zero nobody can explain.
   */
  app.get('/v1/crm/scoring/fields', async (request) => {
    requireRole(request, 'viewer');
    await requireCrmModule(request);
    return ok({
      objects: [
        {
          objectKey: 'contact',
          label: 'Customer',
          labelPlural: 'Customers',
          fields: scoringFields.CONTACT_SCORING_FIELDS,
        },
        {
          objectKey: 'deal',
          label: 'Sales deal',
          labelPlural: 'Sales deals',
          fields: scoringFields.DEAL_SCORING_FIELDS,
        },
      ],
    });
  });

  app.get('/v1/crm/scoring/models', async (request) => {
    const auth = requireRole(request, 'viewer');
    await requireCrmModule(request);
    const q = ListQuery.parse(request.query);
    return ok(
      await scoringService.listModels(toCrmContext(request), {
        ...(q.object_key ? { objectKey: q.object_key } : {}),
        propertyIds: reachableSiteIds(auth),
      })
    );
  });

  app.post('/v1/crm/scoring/models', async (request, reply) => {
    const auth = requireRole(request, 'editor');
    await requireCrmModule(request);
    const body = (request.body ?? {}) as Record<string, unknown>;
    // Default to the site being worked in. A tenant-wide model is a real thing —
    // it is the fallback for every site without its own — but it is the wider
    // blast radius, so it has to be chosen rather than received by omission.
    const propertyId =
      body.propertyId === undefined
        ? await resolvePropertyId(
            auth,
            request.headers['x-sparx-property-id'] as string | undefined
          )
        : (body.propertyId as string | null);
    const model = await scoringService.createModel(toCrmContext(request), { ...body, propertyId });
    reply.code(201);
    return ok(model);
  });

  app.get('/v1/crm/scoring/models/:id', async (request) => {
    requireRole(request, 'viewer');
    await requireCrmModule(request);
    const { id } = PathId.parse(request.params);
    return ok(await scoringService.getModel(toCrmContext(request), id));
  });

  app.patch('/v1/crm/scoring/models/:id', async (request) => {
    requireRole(request, 'editor');
    await requireCrmModule(request);
    const { id } = PathId.parse(request.params);
    return ok(await scoringService.updateModel(toCrmContext(request), id, request.body));
  });

  app.delete('/v1/crm/scoring/models/:id', async (request) => {
    requireRole(request, 'editor');
    await requireCrmModule(request);
    const { id } = PathId.parse(request.params);
    await scoringService.archiveModel(toCrmContext(request), id);
    return ok({ id, archived: true });
  });

  /**
   * Re-score a page of records.
   *
   * Admin, and paged, because it walks records: an unbounded recompute over a
   * tenant with 200k contacts would hold one transaction open for minutes. The
   * response carries `nextCursor`; the caller loops until it is null.
   */
  app.post('/v1/crm/scoring/recompute', async (request) => {
    requireRole(request, 'admin');
    await requireCrmModule(request);
    return ok(await scoringService.recompute(toCrmContext(request), request.body ?? {}));
  });

  app.post('/v1/crm/scoring/adjust', async (request) => {
    requireRole(request, 'editor');
    await requireCrmModule(request);
    return ok(await scoringService.adjust(toCrmContext(request), request.body));
  });

  /** What an unsaved rule set would score one real record — the editor's live
   *  preview. Runs the same code as the real thing, so what an author sees is
   *  what they will get. */
  app.post('/v1/crm/scoring/preview', async (request) => {
    requireRole(request, 'viewer');
    await requireCrmModule(request);
    const body = PreviewBody.parse(request.body);
    const result = await scoringService.preview(toCrmContext(request), {
      objectKey: body.objectKey,
      recordId: body.recordId,
      ...(body.rules === undefined ? {} : { rules: body.rules }),
      ...(body.decayPerDay === undefined ? {} : { decayPerDay: body.decayPerDay }),
      ...(body.maxScore === undefined ? {} : { maxScore: body.maxScore }),
    });
    return ok(result);
  });

  /** One record's score history — the "why is this 74" panel. */
  app.get('/v1/crm/scoring/history', async (request) => {
    requireRole(request, 'viewer');
    await requireCrmModule(request);
    const q = HistoryQuery.parse(request.query);
    return ok(
      await scoringService.history(toCrmContext(request), {
        objectKey: q.object_key,
        recordId: q.record_id,
        ...(q.limit === undefined ? {} : { limit: q.limit }),
      })
    );
  });

  return Promise.resolve();
};

export default scoringRoutes;
