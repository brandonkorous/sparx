// CRM associations — the relationship graph (docs/144 §6).
//
//   GET    /v1/crm/objects/:key/records/:id/associations  → everything related
//   POST   /v1/crm/associations                           → relate two records
//   PATCH  /v1/crm/associations/:id                       → relabel / note
//   POST   /v1/crm/associations/:id/primary               → make it the primary
//   DELETE /v1/crm/associations/:id                       → unlink
//
//   GET    /v1/crm/association-labels                     → the relationship types
//   POST   /v1/crm/association-labels                     → invent one
//   PATCH  /v1/crm/association-labels/:id                 → rename one
//   DELETE /v1/crm/association-labels/:id                 → remove one (links survive)
//
// The read is on the RECORD, not on a flat `/associations?record=…`, because
// "what is related to this thing" is the only question anyone asks — and hanging
// it off the record makes the object key part of the path, so the route cannot
// be called without saying which kind of record it means.
//
// Writes are flat (`/v1/crm/associations/:id`) because an association id is
// already unique and requiring the record too would let a caller pass a
// mismatched pair.
//
// Roles: relating two records is EDITOR work — it is data entry, done all day.
// Changing what the relationships are CALLED is admin: it reshapes every panel
// in the business.

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { associationService } from '@sparx/crm';
import { ok, paged } from '@sparx/api-core/envelope';
import { requireRole } from '@sparx/api-core/auth';

import { requireCrmModule, toCrmContext } from '../../../lib/crm-context.js';

const RecordPath = z.object({
  key: z.string().min(2).max(63),
  id: z.string().uuid(),
});
const IdPath = z.object({ id: z.string().uuid() });

const ListQuery = z.object({
  to_type: z.string().min(2).max(63).optional(),
  label_key: z.string().min(2).max(63).optional(),
  take: z.coerce.number().int().min(1).max(250).optional(),
});

const LabelQuery = z.object({
  from_type: z.string().min(2).max(63).optional(),
  to_type: z.string().min(2).max(63).optional(),
});

const associationRoutes: FastifyPluginAsync = (app) => {
  /* ── A record's relationships ─────────────────────────────────────────── */

  app.get('/v1/crm/objects/:key/records/:id/associations', async (request) => {
    requireRole(request, 'viewer');
    await requireCrmModule(request);
    const { key, id } = RecordPath.parse(request.params);
    const q = ListQuery.parse(request.query);

    const items = await associationService.listFor(toCrmContext(request), {
      objectKey: key,
      recordId: id,
      toType: q.to_type,
      labelKey: q.label_key,
      take: q.take,
    });
    return paged(items, { total: items.length, per_page: items.length });
  });

  app.post('/v1/crm/associations', async (request, reply) => {
    requireRole(request, 'editor');
    await requireCrmModule(request);
    const created = await associationService.create(toCrmContext(request), request.body);
    return reply.code(201).send(ok(created));
  });

  app.patch('/v1/crm/associations/:id', async (request) => {
    requireRole(request, 'editor');
    await requireCrmModule(request);
    const { id } = IdPath.parse(request.params);
    return ok(await associationService.update(toCrmContext(request), id, request.body));
  });

  // Its own endpoint rather than a PATCH field: promoting a relationship
  // REWRITES the legacy foreign-key column the reports read, which is a
  // different kind of act from renaming a link and should not ride along in a
  // body a caller might send by accident.
  app.post('/v1/crm/associations/:id/primary', async (request) => {
    requireRole(request, 'editor');
    await requireCrmModule(request);
    const { id } = IdPath.parse(request.params);
    return ok(await associationService.makePrimary(toCrmContext(request), id));
  });

  app.delete('/v1/crm/associations/:id', async (request) => {
    requireRole(request, 'editor');
    await requireCrmModule(request);
    const { id } = IdPath.parse(request.params);
    await associationService.remove(toCrmContext(request), id);
    return ok({ deleted: true });
  });

  /* ── What the relationships are called ────────────────────────────────── */

  app.get('/v1/crm/association-labels', async (request) => {
    requireRole(request, 'viewer');
    await requireCrmModule(request);
    const q = LabelQuery.parse(request.query);
    const items = await associationService.listLabels(toCrmContext(request), {
      fromType: q.from_type,
      toType: q.to_type,
    });
    return paged(items, { total: items.length, per_page: items.length });
  });

  app.post('/v1/crm/association-labels', async (request, reply) => {
    requireRole(request, 'admin');
    await requireCrmModule(request);
    const created = await associationService.createLabel(toCrmContext(request), request.body);
    return reply.code(201).send(ok(created));
  });

  app.patch('/v1/crm/association-labels/:id', async (request) => {
    requireRole(request, 'admin');
    await requireCrmModule(request);
    const { id } = IdPath.parse(request.params);
    return ok(await associationService.updateLabel(toCrmContext(request), id, request.body));
  });

  // The links themselves SURVIVE, unlabelled — the response says how many, so
  // the confirmation can tell the truth about what just happened.
  app.delete('/v1/crm/association-labels/:id', async (request) => {
    requireRole(request, 'admin');
    await requireCrmModule(request);
    const { id } = IdPath.parse(request.params);
    const unlabelled = await associationService.deleteLabel(toCrmContext(request), id);
    return ok({ deleted: true, unlabelledLinks: unlabelled });
  });

  // No top-level await in this plugin, but the FastifyPluginAsync contract wants
  // a promise — the same explicit resolve every sibling route file ends with.
  return Promise.resolve();
};

export default associationRoutes;
