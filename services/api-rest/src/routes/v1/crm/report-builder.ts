// The report builder + dashboards (docs/144 §8).
//
//   GET    /v1/crm/reports                  → saved definitions
//   POST   /v1/crm/reports                  → save one
//   GET    /v1/crm/reports/fields           → what can be reported on
//   POST   /v1/crm/reports/preview          → run an UNSAVED definition
//   GET    /v1/crm/reports/:id              → one definition
//   PATCH  /v1/crm/reports/:id              → edit it
//   POST   /v1/crm/reports/:id/duplicate    → copy it (the only way to change a built-in)
//   POST   /v1/crm/reports/:id/run          → the numbers, now
//   DELETE /v1/crm/reports/:id              → archive
//
//   GET    /v1/crm/dashboards               → boards
//   GET    /v1/crm/dashboards/landing       → the one to open on
//   POST   /v1/crm/dashboards               → new board
//   GET/PATCH/DELETE /v1/crm/dashboards/:id
//   PUT    /v1/crm/dashboards/:id/widgets   → the whole layout in one write
//
// `run` and `preview` are POST despite reading nothing: a definition is far too
// big for a query string, and preview carries a whole unsaved report body.
//
// ROLES. Reading a report is `viewer` — the numbers are the point, and a
// business where only admins can see how it is doing is not measuring itself.
// SAVING is `editor`. `/fields` is `viewer` too: it exposes only the reportable
// spine's labels, which anyone who can read a record already sees.

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { dashboardService, reportCompiler, reportService } from '@sparx/crm';
import { ok, paged } from '@sparx/api-core/envelope';
import { requireAuth, requireRole } from '@sparx/api-core/auth';

import { requireCrmModule, toCrmContext } from '../../../lib/crm-context.js';
import { reachableSiteIds } from '../../../lib/property.js';

const IdPath = z.object({ id: z.string().uuid() });
const ObjectQuery = z.object({ object_key: z.string().min(2).max(63).optional() });
const DuplicateBody = z.object({ name: z.string().trim().min(1).max(160).optional() });

// Separate from `reports.ts`, which serves the seven hand-written metrics
// (`/snapshot`, `/pipeline-funnel`, …). Those are static paths and take
// precedence over this file's `/:id` in Fastify's router regardless of
// registration order, so the two coexist on the same prefix. They are kept apart
// because they are different things: those are answers sparx computed, these are
// answers a tenant defined.
const reportBuilderRoutes: FastifyPluginAsync = (app) => {
  /* ── Reports ──────────────────────────────────────────────────────────── */

  app.get('/v1/crm/reports', async (request) => {
    requireRole(request, 'viewer');
    await requireCrmModule(request);
    const q = ObjectQuery.parse(request.query);
    const items = await reportService.list(toCrmContext(request), {
      propertyIds: reachableSiteIds(requireAuth(request)),
      ...(q.object_key ? { objectKey: q.object_key } : {}),
    });
    return paged(items, { total: items.length, per_page: items.length });
  });

  /**
   * What a report can be built FROM.
   *
   * Static — it is the compiler's own allowlist, which is the point: the builder
   * offers exactly what the compiler will accept, so a person cannot assemble a
   * definition that fails on run. Declared before `/:id` so "fields" is never
   * parsed as a uuid.
   */
  app.get('/v1/crm/reports/fields', async (request) => {
    requireRole(request, 'viewer');
    await requireCrmModule(request);
    return ok({
      objects: reportCompiler.reportableObjects().map((object) => ({
        ...object,
        fields: reportCompiler.reportableFields(object.objectKey),
      })),
    });
  });

  app.post('/v1/crm/reports/preview', async (request) => {
    requireRole(request, 'viewer');
    await requireCrmModule(request);
    return ok(await reportService.preview(toCrmContext(request), request.body));
  });

  app.post('/v1/crm/reports', async (request, reply) => {
    requireRole(request, 'editor');
    await requireCrmModule(request);
    const created = await reportService.create(toCrmContext(request), request.body);
    return reply.code(201).send(ok(created));
  });

  app.get('/v1/crm/reports/:id', async (request) => {
    requireRole(request, 'viewer');
    await requireCrmModule(request);
    const { id } = IdPath.parse(request.params);
    return ok(await reportService.get(toCrmContext(request), id));
  });

  app.patch('/v1/crm/reports/:id', async (request) => {
    requireRole(request, 'editor');
    await requireCrmModule(request);
    const { id } = IdPath.parse(request.params);
    return ok(await reportService.update(toCrmContext(request), id, request.body));
  });

  app.post('/v1/crm/reports/:id/duplicate', async (request, reply) => {
    requireRole(request, 'editor');
    await requireCrmModule(request);
    const { id } = IdPath.parse(request.params);
    const body = DuplicateBody.parse(request.body ?? {});
    const copy = await reportService.duplicate(toCrmContext(request), id, body.name);
    return reply.code(201).send(ok(copy));
  });

  app.post('/v1/crm/reports/:id/run', async (request) => {
    requireRole(request, 'viewer');
    await requireCrmModule(request);
    const { id } = IdPath.parse(request.params);
    return ok(await reportService.run(toCrmContext(request), id, request.body ?? {}));
  });

  app.delete('/v1/crm/reports/:id', async (request) => {
    requireRole(request, 'editor');
    await requireCrmModule(request);
    const { id } = IdPath.parse(request.params);
    await reportService.archive(toCrmContext(request), id);
    return ok({ archived: true });
  });

  /* ── Dashboards ───────────────────────────────────────────────────────── */

  app.get('/v1/crm/dashboards', async (request) => {
    requireRole(request, 'viewer');
    await requireCrmModule(request);
    const items = await dashboardService.list(toCrmContext(request), {
      propertyIds: reachableSiteIds(requireAuth(request)),
    });
    return paged(items, { total: items.length, per_page: items.length });
  });

  /** The board to open on. Null when a tenant has never made one — the surface
   *  offers to build one rather than inventing a board nobody asked for. */
  app.get('/v1/crm/dashboards/landing', async (request) => {
    requireRole(request, 'viewer');
    await requireCrmModule(request);
    return ok(
      await dashboardService.landing(toCrmContext(request), {
        propertyIds: reachableSiteIds(requireAuth(request)),
      })
    );
  });

  app.post('/v1/crm/dashboards', async (request, reply) => {
    requireRole(request, 'editor');
    await requireCrmModule(request);
    const created = await dashboardService.create(toCrmContext(request), request.body);
    return reply.code(201).send(ok(created));
  });

  app.get('/v1/crm/dashboards/:id', async (request) => {
    requireRole(request, 'viewer');
    await requireCrmModule(request);
    const { id } = IdPath.parse(request.params);
    return ok(await dashboardService.get(toCrmContext(request), id));
  });

  app.patch('/v1/crm/dashboards/:id', async (request) => {
    requireRole(request, 'editor');
    await requireCrmModule(request);
    const { id } = IdPath.parse(request.params);
    return ok(await dashboardService.update(toCrmContext(request), id, request.body));
  });

  /** PUT, not PATCH: the body IS the layout. A board is only ever valid as a
   *  whole set — see `setWidgets`. */
  app.put('/v1/crm/dashboards/:id/widgets', async (request) => {
    requireRole(request, 'editor');
    await requireCrmModule(request);
    const { id } = IdPath.parse(request.params);
    return ok(await dashboardService.setWidgets(toCrmContext(request), id, request.body));
  });

  app.delete('/v1/crm/dashboards/:id', async (request) => {
    requireRole(request, 'editor');
    await requireCrmModule(request);
    const { id } = IdPath.parse(request.params);
    await dashboardService.archive(toCrmContext(request), id);
    return ok({ archived: true });
  });

  return Promise.resolve();
};

export default reportBuilderRoutes;
