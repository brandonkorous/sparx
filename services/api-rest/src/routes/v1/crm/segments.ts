// CRM segments — CRUD + membership + preview + recompute.
//
//   GET    /v1/crm/segments                       → list (optionally archived)
//   POST   /v1/crm/segments                       → create
//   GET    /v1/crm/segments/:id                   → fetch one
//   PATCH  /v1/crm/segments/:id                   → update (rules trigger evaluator)
//   DELETE /v1/crm/segments/:id                   → archive
//   GET    /v1/crm/segments/:id/members           → materialized membership
//   GET    /v1/crm/segments/:id/member-count      → count of members
//   POST   /v1/crm/segments/preview-count         → match-count for a draft rule
//   POST   /v1/crm/segments/:id/recompute         → full re-evaluation
//   POST   /v1/crm/segments/:id/members           → add to a hand-picked list (§10)
//   POST   /v1/crm/segments/:id/members/remove    → take off a hand-picked list
//   GET    /v1/crm/segments/:id/history           → who joined / left, and when

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { segmentService } from '@sparx/crm';
import { ok, paged } from '@sparx/api-core/envelope';
import { requireRole } from '@sparx/api-core/auth';
import { requireCrmModule, toCrmContext } from '../../../lib/crm-context.js';
import { resolvePropertyId, reachableSiteIds } from '../../../lib/property.js';

const PathId = z.object({ id: z.string().uuid() });
const ListQuery = z.object({
  q: z.string().trim().min(1).max(200).optional(),
  include_archived: z.coerce.boolean().optional(),
  take: z.coerce.number().int().min(1).max(250).optional(),
  skip: z.coerce.number().int().min(0).optional(),
});
const MembersQuery = z.object({
  limit: z.coerce.number().int().min(1).max(1000).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});
const HistoryQuery = z.object({
  kind: z.enum(['entered', 'exited']).optional(),
  since: z.string().datetime().optional(),
  limit: z.coerce.number().int().min(1).max(500).optional(),
});

const segmentRoutes: FastifyPluginAsync = (app) => {
  app.get('/v1/crm/segments', async (request) => {
    const auth = requireRole(request, 'viewer');
    await requireCrmModule(request);
    const q = ListQuery.parse(request.query);
    const { items, total } = await segmentService.list(toCrmContext(request), {
      q: q.q,
      includeArchived: q.include_archived,
      // Restricted members see only their businesses' audiences (docs/131 §3.3).
      propertyIds: reachableSiteIds(auth),
      take: q.take,
      skip: q.skip,
    });
    return paged(items, { total, per_page: q.take ?? 50 });
  });

  app.get('/v1/crm/segments/:id', async (request) => {
    requireRole(request, 'viewer');
    await requireCrmModule(request);
    const { id } = PathId.parse(request.params);
    const segment = await segmentService.get(toCrmContext(request), id);
    return ok(segment);
  });

  app.post('/v1/crm/segments', async (request, reply) => {
    const auth = requireRole(request, 'editor');
    await requireCrmModule(request);
    const body = (request.body ?? {}) as Record<string, unknown>;
    // Default the audience to the site being worked in (docs/131 §5); an explicit
    // null in the body still authors a tenant-wide segment. Defaulting the other
    // way would let a segment silently draw from every business's customers.
    const propertyId =
      body.propertyId === undefined
        ? await resolvePropertyId(
            auth,
            request.headers['x-sparx-property-id'] as string | undefined
          )
        : (body.propertyId as string | null);
    const segment = await segmentService.create(toCrmContext(request), { ...body, propertyId });
    reply.code(201);
    return ok(segment);
  });

  app.patch('/v1/crm/segments/:id', async (request) => {
    requireRole(request, 'editor');
    await requireCrmModule(request);
    const { id } = PathId.parse(request.params);
    const segment = await segmentService.update(toCrmContext(request), id, request.body);
    return ok(segment);
  });

  app.delete('/v1/crm/segments/:id', async (request, reply) => {
    requireRole(request, 'editor');
    await requireCrmModule(request);
    const { id } = PathId.parse(request.params);
    await segmentService.archive(toCrmContext(request), id);
    reply.code(204);
  });

  app.get('/v1/crm/segments/:id/members', async (request) => {
    requireRole(request, 'viewer');
    await requireCrmModule(request);
    const { id } = PathId.parse(request.params);
    const q = MembersQuery.parse(request.query);
    const [items, total] = await Promise.all([
      segmentService.members(toCrmContext(request), id, q),
      segmentService.memberCount(toCrmContext(request), id),
    ]);
    return paged(items, { total, per_page: q.limit ?? 100 });
  });

  app.get('/v1/crm/segments/:id/member-count', async (request) => {
    requireRole(request, 'viewer');
    await requireCrmModule(request);
    const { id } = PathId.parse(request.params);
    const total = await segmentService.memberCount(toCrmContext(request), id);
    return ok({ total });
  });

  app.post('/v1/crm/segments/preview-count', async (request) => {
    const auth = requireRole(request, 'viewer');
    await requireCrmModule(request);
    const body = (request.body ?? {}) as Record<string, unknown>;
    // Scoped exactly like `create` above, and for the same reason: the count has
    // to describe the people the segment could actually contain. Unscoped, the
    // builder said "24 of 24 match" and the saved segment held 22 — the other
    // two belonging to a different business under the same tenant.
    const propertyId =
      body.propertyId === undefined
        ? await resolvePropertyId(
            auth,
            request.headers['x-sparx-property-id'] as string | undefined
          )
        : (body.propertyId as string | null);
    const result = await segmentService.previewCount(toCrmContext(request), {
      ...body,
      propertyId,
    } as never);
    return ok(result);
  });

  app.post('/v1/crm/segments/:id/recompute', async (request) => {
    requireRole(request, 'admin');
    await requireCrmModule(request);
    const { id } = PathId.parse(request.params);
    const result = await segmentService.recomputeFull(toCrmContext(request), { segmentId: id });
    return ok(result);
  });

  // ── hand-picked lists (docs/144 §10) ──
  //
  // These refuse on a rule-driven list at the SERVICE, not here: the check needs
  // the segment's own kind, and duplicating it in the route is how the two come
  // to disagree.

  app.post('/v1/crm/segments/:id/members', async (request) => {
    requireRole(request, 'editor');
    await requireCrmModule(request);
    const { id } = PathId.parse(request.params);
    const result = await segmentService.addMembers(toCrmContext(request), id, request.body);
    return ok(result);
  });

  // DELETE with a body is awkward for a lot of HTTP clients, so removal is a
  // POST to a named sub-resource. The alternative — one id per DELETE — would
  // turn "take these 200 people off" into 200 round trips.
  app.post('/v1/crm/segments/:id/members/remove', async (request) => {
    requireRole(request, 'editor');
    await requireCrmModule(request);
    const { id } = PathId.parse(request.params);
    const result = await segmentService.removeMembers(toCrmContext(request), id, request.body);
    return ok(result);
  });

  app.get('/v1/crm/segments/:id/history', async (request) => {
    requireRole(request, 'viewer');
    await requireCrmModule(request);
    const { id } = PathId.parse(request.params);
    const q = HistoryQuery.parse(request.query);
    const items = await segmentService.membershipHistory(toCrmContext(request), id, {
      ...(q.kind ? { kind: q.kind } : {}),
      ...(q.since ? { since: new Date(q.since) } : {}),
      ...(q.limit === undefined ? {} : { limit: q.limit }),
    });
    return ok(items);
  });

  return Promise.resolve();
};

export default segmentRoutes;
