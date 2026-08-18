// GET    /v1/content/types          → list every content type the tenant can use
// GET    /v1/content/types/:key     → fetch one
// POST   /v1/content/types          → create a tenant-custom type
// PATCH  /v1/content/types/:key     → update a tenant-custom type (built-ins are read-only)
// PUT    /v1/content/types/:key/schema → author the field schema (FORKS a built-in)
// DELETE /v1/content/types/:key     → remove a tenant-custom type (built-ins are read-only)
//
// Custom-type schemas are validated against the FieldDef union from
// @wizeworks/cms-schemas — the same validator that's used at entry write
// time, so a schema can never persist in a shape the body validator
// won't accept.
//
// PUT :key/schema is the docs/51 keystone: the schema is OWNED by the
// content type but AUTHORED from the builder. Editing a platform built-in's
// fields transparently FORKS it into a tenant-owned copy (same key,
// is_built_in=false) that shadows the platform row — read paths dedupe by
// key with the tenant copy winning (see content-types.ts `resolveType`,
// bindingService.getSchema, and the GET list below).

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { ok, paged } from '@wizeworks/api-core/envelope';
import { withRequestTenant } from '@wizeworks/api-core/db';
import { requireAuth, requireRole } from '@wizeworks/api-core/auth';
import { notFound } from '@wizeworks/api-core/errors';
import { ContentTypeSchema } from '@wizeworks/cms-schemas';
import {
  createContentTypeTx,
  updateContentTypeTx,
  replaceSchemaTx,
  deleteContentTypeTx,
  serializeContentType,
} from '@wizeworks/cms';
import { writeAudit } from '@wizeworks/api-core/audit';
import { publish } from '@wizeworks/api-core/pubsub';

const KeyParams = z.object({ key: z.string().min(1).max(63) });

const ListQuery = z.object({
  q: z.string().trim().min(1).max(200).optional(),
  kind: z.enum(['built_in', 'custom']).optional(),
  take: z.coerce.number().int().min(1).max(250).optional(),
  skip: z.coerce.number().int().min(0).optional(),
});

const KeySchema = z
  .string()
  .min(1)
  .max(63)
  .regex(/^[a-z][a-z0-9_]*$/, 'Key must be lowercase letters, numbers, and underscores.');

const CreateBody = z.object({
  key: KeySchema,
  name: z.string().min(1).max(120),
  plural_name: z.string().min(1).max(120),
  description: z.string().max(2048).optional(),
  icon: z.string().max(60).optional(),
  url_pattern: z.string().max(255).optional(),
  is_singleton: z.boolean().optional(),
  schema: ContentTypeSchema,
});

const UpdateBody = z.object({
  name: z.string().min(1).max(120).optional(),
  plural_name: z.string().min(1).max(120).optional(),
  description: z.string().max(2048).nullable().optional(),
  icon: z.string().max(60).nullable().optional(),
  url_pattern: z.string().max(255).nullable().optional(),
  is_singleton: z.boolean().optional(),
  schema: ContentTypeSchema.optional(),
});

const SchemaBody = z.object({ schema: ContentTypeSchema });

// Read-path dedup: keep the first row per key. The query orders built-ins
// last (isBuiltIn ASC, key ASC), so a tenant-owned fork of a built-in
// shadows the platform row of the same key — never both.
function dedupeByKey<T extends { key: string }>(rows: T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const row of rows) {
    if (seen.has(row.key)) continue;
    seen.add(row.key);
    out.push(row);
  }
  return out;
}

const contentTypeRoutes: FastifyPluginAsync = (app) => {
  app.get('/v1/content/types', async (request) => {
    requireAuth(request);
    const q = ListQuery.parse(request.query);
    const rows = await withRequestTenant(request, (tx) =>
      tx.contentType.findMany({
        orderBy: [{ isBuiltIn: 'asc' }, { key: 'asc' }],
      })
    );
    // A tenant fork (is_built_in=false) shadows the platform built-in of the
    // same key — list the fork, drop the shadowed built-in. Dedup runs BEFORE
    // filtering/paging so `total` and the window both reflect the post-dedup
    // set (a shadowed built-in must not inflate the count or consume a page
    // slot). The type catalog is a small, bounded set, so in-memory
    // filter/paging is correct — there's no Prisma `where` to push this into.
    const deduped = dedupeByKey(rows);
    const needle = q.q?.toLowerCase();
    const filtered = deduped.filter((r) => {
      if (q.kind === 'built_in' && !r.isBuiltIn) return false;
      if (q.kind === 'custom' && r.isBuiltIn) return false;
      if (needle) {
        const haystack = `${r.name} ${r.pluralName} ${r.description ?? ''}`.toLowerCase();
        if (!haystack.includes(needle)) return false;
      }
      return true;
    });
    const total = filtered.length;
    const skip = q.skip ?? 0;
    const take = Math.min(q.take ?? 50, 250);
    const window = filtered.slice(skip, skip + take);
    return paged(window.map(serializeContentType), { total, per_page: q.take ?? 50 });
  });

  app.get('/v1/content/types/:key', async (request) => {
    requireAuth(request);
    const { key } = KeyParams.parse(request.params);
    const row = await withRequestTenant(request, (tx) =>
      tx.contentType.findFirst({
        where: { key },
        orderBy: [{ isBuiltIn: 'asc' }, { updatedAt: 'desc' }],
      })
    );
    if (!row) throw notFound('Content type', key);
    return ok(serializeContentType(row));
  });

  app.post('/v1/content/types', async (request, reply) => {
    const auth = requireRole(request, 'editor');
    const input = CreateBody.parse(request.body);

    const { contentType: created, events } = await withRequestTenant(request, async (tx) => {
      const result = await createContentTypeTx(
        tx,
        { tenantId: auth.tenantId, actorId: auth.actorId },
        {
          key: input.key,
          name: input.name,
          pluralName: input.plural_name,
          description: input.description,
          icon: input.icon,
          urlPattern: input.url_pattern,
          isSingleton: input.is_singleton,
          schema: input.schema,
        }
      );
      await writeAudit(tx, request, auth, {
        action: 'content_type.upserted',
        entityType: 'content_type',
        entityId: result.contentType.id,
        after: { key: result.contentType.key, name: result.contentType.name },
      });
      return result;
    });
    for (const ev of events) {
      await publish(request.log, ev.type, auth.tenantId, auth.actorId, ev.data);
    }
    reply.code(201);
    return ok(serializeContentType(created));
  });

  app.patch('/v1/content/types/:key', async (request) => {
    const auth = requireRole(request, 'editor');
    const { key } = KeyParams.parse(request.params);
    const input = UpdateBody.parse(request.body);

    const { contentType: updated, events } = await withRequestTenant(request, async (tx) => {
      const existing = await tx.contentType.findFirst({ where: { key, isBuiltIn: false } });
      if (!existing) throw notFound('Custom content type', key);
      const result = await updateContentTypeTx(
        tx,
        { tenantId: auth.tenantId, actorId: auth.actorId },
        key,
        {
          name: input.name,
          pluralName: input.plural_name,
          description: input.description,
          icon: input.icon,
          urlPattern: input.url_pattern,
          isSingleton: input.is_singleton,
          schema: input.schema,
        }
      );
      await writeAudit(tx, request, auth, {
        action: 'content_type.upserted',
        entityType: 'content_type',
        entityId: result.contentType.id,
        before: { name: existing.name },
        after: { name: result.contentType.name },
      });
      return result;
    });
    for (const ev of events) {
      await publish(request.log, ev.type, auth.tenantId, auth.actorId, ev.data);
    }
    return ok(serializeContentType(updated));
  });

  // ──────────────────────────────────────────────────────────────────────
  // AUTHOR SCHEMA (fork-on-edit) — the docs/51 keystone.
  //
  // Editing a tenant-owned type updates its schemaJson in place. Editing a
  // platform built-in FORKS it: a tenant-owned copy of the same key is
  // created with the new schema and shadows the platform row everywhere
  // (read paths dedupe by key, tenant copy wins). Either way the response
  // carries `forked` so the client can surface "this is now your copy".
  // ──────────────────────────────────────────────────────────────────────

  app.put('/v1/content/types/:key/schema', async (request) => {
    const auth = requireRole(request, 'editor');
    const { key } = KeyParams.parse(request.params);
    const { schema } = SchemaBody.parse(request.body);

    const { contentType, forked, events } = await withRequestTenant(request, async (tx) => {
      const result = await replaceSchemaTx(
        tx,
        { tenantId: auth.tenantId, actorId: auth.actorId },
        key,
        schema
      );
      await writeAudit(tx, request, auth, {
        action: 'content_type.upserted',
        entityType: 'content_type',
        entityId: result.contentType.id,
        before: { key: result.contentType.key, forkedFromBuiltIn: result.forked },
        after: { key: result.contentType.key, fields: schema.fields.length },
      });
      return result;
    });

    for (const ev of events) {
      await publish(request.log, ev.type, auth.tenantId, auth.actorId, ev.data);
    }
    return ok({ ...serializeContentType(contentType), forked });
  });

  app.delete('/v1/content/types/:key', async (request, reply) => {
    const auth = requireRole(request, 'editor');
    const { key } = KeyParams.parse(request.params);
    await withRequestTenant(request, async (tx) => {
      const { contentType } = await deleteContentTypeTx(
        tx,
        { tenantId: auth.tenantId, actorId: auth.actorId },
        key
      );
      await writeAudit(tx, request, auth, {
        action: 'content_type.deleted',
        entityType: 'content_type',
        entityId: contentType.id,
        before: { key: contentType.key, name: contentType.name },
      });
    });
    reply.code(204);
    return;
  });

  return Promise.resolve();
};

export default contentTypeRoutes;
