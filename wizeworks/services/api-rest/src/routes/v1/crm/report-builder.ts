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
// SAVING is `editor`. `/fields` is `viewer` too: it exposes field NAMES — the
// reportable spine's, plus the tenant's own declared properties — and never a
// value, so it says nothing anyone who can read a record cannot already see.

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import {
  asPropertySchema,
  dashboardService,
  objectDefService,
  reportCompiler,
  reportService,
  seedBuiltinReports,
} from '@wizeworks/crm';
import { ok, paged } from '@wizeworks/api-core/envelope';
import { requireAuth, requireRole } from '@wizeworks/api-core/auth';

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
    // Self-heal the worked examples before listing them.
    //
    // The library's whole premise is "open one of ours, see how it is built,
    // copy it and change one thing" — an empty list teaches nobody, and it is
    // what a tenant sees whenever the seed never ran. Which is most of them:
    // `seedBuiltinReports` was only ever wired to the `module.activated`
    // consumer, so every tenant that enabled CRM before the built-ins shipped
    // has none, and there is no re-activation event coming to fix that.
    //
    // Create-only and keyed on (tenant, property, builtinSlug), so this is a
    // single indexed read that returns 0 on every call after the first — and a
    // tenant who deleted one they did not want does not get it back. It runs on
    // a `viewer` route deliberately: these rows are owned by nobody and shared
    // with everyone, and the person who opens the library is exactly the person
    // who needs them to be there.
    await seedBuiltinReports(toCrmContext(request));
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
   * The built-in half is the compiler's own allowlist, which is the point: the
   * builder offers exactly what the compiler will accept, so a person cannot
   * assemble a definition that fails on run. Declared before `/:id` so "fields"
   * is never parsed as a uuid.
   *
   * The other half is the objects the TENANT invented, merged in here because
   * this is the layer that can read the registry. Without them a business that
   * added "Courses" got a list, a detail pane, saved views, associations and
   * search for them — and then could not count them, which is the one thing an
   * owner asks a new record type for first.
   */
  app.get('/v1/crm/reports/fields', async (request) => {
    requireRole(request, 'viewer');
    await requireCrmModule(request);
    const ctx = toCrmContext(request);

    // One registry read serves both halves: the built-ins need their DECLARED
    // properties (a customer's "renewal month" is reportable and was never
    // offered), and the tenant's own objects are entirely declared properties.
    const defs = await objectDefService.list(ctx);
    const byKey = new Map(defs.map((def) => [def.key, def]));

    /** A declared property is a `custom.<key>` path — the same on a contact as
     *  on a course, which is why one helper types both. */
    const declared = (def: (typeof defs)[number] | undefined) =>
      Object.entries(
        reportCompiler.reportableProperties(asPropertySchema(def?.propertySchema))
      ).map(([key, field]) => ({ path: `custom.${key}`, label: field.label, kind: field.kind }));

    const builtin = reportCompiler.reportableObjects().map((object) => ({
      ...object,
      fields: [
        ...reportCompiler.reportableFields(object.objectKey),
        ...declared(byKey.get(object.objectKey)),
      ],
    }));

    const custom = defs
      .filter((def) => def.kind === 'custom' && !def.archivedAt)
      .map((def) => ({
        objectKey: def.key,
        label: def.label,
        labelPlural: def.labelPlural,
        fields: [...reportCompiler.customSpineFields(), ...declared(def)],
      }));

    return ok({ objects: [...builtin, ...custom] });
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
