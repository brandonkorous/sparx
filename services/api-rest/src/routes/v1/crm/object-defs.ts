// CRM object definitions + the records of tenant-invented objects (docs/144 §3).
//
//   GET    /v1/crm/objects                     → every object, built-in + custom
//   POST   /v1/crm/objects                     → invent one
//   GET    /v1/crm/objects/:key                → one, with its property schema
//   PATCH  /v1/crm/objects/:key                → rename it / change its properties
//   DELETE /v1/crm/objects/:key                → archive a custom object
//
//   GET    /v1/crm/objects/:key/records        → list its rows
//   POST   /v1/crm/objects/:key/records        → add one
//   GET    /v1/crm/records/:id                 → fetch one
//   PATCH  /v1/crm/records/:id                 → change one
//   DELETE /v1/crm/records/:id                 → soft-delete one
//
// API-first, per the root CLAUDE.md: these ship before the surfaces that use
// them, and the MCP tools in @sparx/crm/mcp wrap the same services — so an AI
// client can define a business's record types and fill them in without a browser.
//
// Records live under `/v1/crm/objects/:key/records` for the collection (the
// object is what scopes a list) and at a flat `/v1/crm/records/:id` for a single
// row (an id is already unique, and requiring the key would let a caller pass a
// mismatched pair).

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { crmRecordService, objectDefService } from '@sparx/crm';
import { ok, paged } from '@sparx/api-core/envelope';
import { requireRole } from '@sparx/api-core/auth';

import { requireCrmModule, toCrmContext } from '../../../lib/crm-context.js';
import { resolvePropertyId, reachableSiteIds } from '../../../lib/property.js';

const ObjectKeyPath = z.object({ key: z.string().min(2).max(63) });
const RecordIdPath = z.object({ id: z.string().uuid() });

const ListObjectsQuery = z.object({
  kind: z.enum(['builtin', 'custom']).optional(),
  include_archived: z.coerce.boolean().optional(),
});

const ListRecordsQuery = z.object({
  q: z.string().trim().min(1).max(200).optional(),
  owner_id: z.string().uuid().optional(),
  take: z.coerce.number().int().min(1).max(250).optional(),
  skip: z.coerce.number().int().min(0).optional(),
});

const objectDefRoutes: FastifyPluginAsync = (app) => {
  /* ── Definitions ──────────────────────────────────────────────────────── */

  app.get('/v1/crm/objects', async (request) => {
    requireRole(request, 'viewer');
    await requireCrmModule(request);
    const q = ListObjectsQuery.parse(request.query);
    const items = await objectDefService.list(toCrmContext(request), {
      kind: q.kind,
      includeArchived: q.include_archived,
    });
    return paged(items, { total: items.length, per_page: items.length });
  });

  app.get('/v1/crm/objects/:key', async (request) => {
    requireRole(request, 'viewer');
    await requireCrmModule(request);
    const { key } = ObjectKeyPath.parse(request.params);
    return ok(await objectDefService.get(toCrmContext(request), key));
  });

  // Admin, not editor: adding a record type reshapes what the whole business
  // tracks, and every downstream list, form, segment and report changes with it.
  app.post('/v1/crm/objects', async (request, reply) => {
    requireRole(request, 'admin');
    await requireCrmModule(request);
    const created = await objectDefService.create(toCrmContext(request), request.body);
    return reply.code(201).send(ok(created));
  });

  app.patch('/v1/crm/objects/:key', async (request) => {
    requireRole(request, 'admin');
    await requireCrmModule(request);
    const { key } = ObjectKeyPath.parse(request.params);
    return ok(await objectDefService.update(toCrmContext(request), key, request.body));
  });

  app.delete('/v1/crm/objects/:key', async (request) => {
    requireRole(request, 'admin');
    await requireCrmModule(request);
    const { key } = ObjectKeyPath.parse(request.params);
    return ok(await objectDefService.archive(toCrmContext(request), key));
  });

  /* ── Records of a custom object ───────────────────────────────────────── */

  app.get('/v1/crm/objects/:key/records', async (request) => {
    const auth = requireRole(request, 'viewer');
    await requireCrmModule(request);
    const { key } = ObjectKeyPath.parse(request.params);
    const q = ListRecordsQuery.parse(request.query);

    const { items, total } = await crmRecordService.list(toCrmContext(request), {
      objectKey: key,
      q: q.q,
      ownerId: q.owner_id,
      // Restricted members see only their businesses' records (docs/131 §3.3).
      propertyIds: reachableSiteIds(auth),
      take: q.take,
      skip: q.skip,
    });
    return paged(items, { total, per_page: q.take ?? 50 });
  });

  app.post('/v1/crm/objects/:key/records', async (request, reply) => {
    const auth = requireRole(request, 'editor');
    await requireCrmModule(request);
    const { key } = ObjectKeyPath.parse(request.params);
    const body = (request.body ?? {}) as Record<string, unknown>;

    // Default the record to the site being worked in (docs/131 §5), exactly as a
    // segment does; an explicit null in the body still authors a tenant-wide
    // record. Defaulting the other way would put one business's records into
    // another's lists.
    const propertyId =
      body.propertyId === undefined
        ? await resolvePropertyId(
            auth,
            request.headers['x-sparx-property-id'] as string | undefined
          )
        : (body.propertyId as string | null);

    const created = await crmRecordService.create(toCrmContext(request), {
      ...body,
      objectKey: key,
      propertyId,
    });
    return reply.code(201).send(ok(created));
  });

  app.get('/v1/crm/records/:id', async (request) => {
    requireRole(request, 'viewer');
    await requireCrmModule(request);
    const { id } = RecordIdPath.parse(request.params);
    return ok(await crmRecordService.get(toCrmContext(request), id));
  });

  app.patch('/v1/crm/records/:id', async (request) => {
    requireRole(request, 'editor');
    await requireCrmModule(request);
    const { id } = RecordIdPath.parse(request.params);
    return ok(await crmRecordService.update(toCrmContext(request), id, request.body));
  });

  app.delete('/v1/crm/records/:id', async (request) => {
    requireRole(request, 'editor');
    await requireCrmModule(request);
    const { id } = RecordIdPath.parse(request.params);
    await crmRecordService.remove(toCrmContext(request), id);
    return ok({ deleted: true });
  });

  // No top-level await in this plugin, but the FastifyPluginAsync contract wants
  // a promise — the same explicit resolve every sibling route file ends with.
  return Promise.resolve();
};

export default objectDefRoutes;
