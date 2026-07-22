// Content entries CRUD + list.
//
//   GET    /v1/content/entries                 → list (filterable, offset-paged)
//   POST   /v1/content/entries                 → create draft
//   GET    /v1/content/entries/:id             → fetch one
//   PATCH  /v1/content/entries/:id             → update; creates autosave revision
//   DELETE /v1/content/entries/:id             → soft delete
//
// Create/update delegate to the @sparx/cms service layer (createEntryTx /
// updateEntryTx) — the same mutation path the MCP tools drive. Route-only
// concerns (role, header-based site defaulting, If-Match ETag, audit) stay here.
// Publish / preview-token / revisions routes live alongside this file.

import type { FastifyPluginAsync } from 'fastify';
import type { Prisma } from '@sparx/db';
import { z } from 'zod';
import { withRequestTenant } from '@sparx/api-core/db';
import { ok, paged } from '@sparx/api-core/envelope';
import { requireRole } from '@sparx/api-core/auth';
import { createEntryTx, updateEntryTx, serializeEntry } from '@sparx/cms';
import { writeAudit } from '@sparx/api-core/audit';
import { publish } from '@sparx/api-core/pubsub';
import { notFound } from '@sparx/api-core/errors';
import { assertIfMatch, computeEntryEtag } from '@sparx/api-core/etag';
import {
  contentSiteVisibilityWhere,
  resolveListScope,
  resolvePropertyId,
} from '../../../lib/property.js';

const SeoSchema = z
  .object({
    title: z.string().max(255).optional(),
    description: z.string().max(500).optional(),
    // Canonical accepts any absolute or relative URL up to 2048 chars.
    // Strict `.url()` would reject `/foo/bar` (relative), which is a
    // legitimate canonical for same-origin de-duplication.
    canonical: z.string().max(2048).optional(),
    robots: z.string().max(120).optional(),
    // OG image lives as a MediaAsset UUID *or* an absolute URL (in case
    // the tenant pastes a CDN URL from outside the media library).
    ogImage: z.string().max(2048).optional(),
    jsonLdOverride: z.unknown().optional(),
  })
  .strict()
  .partial();

const CreateBody = z.object({
  type_key: z.string().min(1).max(63),
  slug: z.string().min(1).max(255).optional(),
  status: z.enum(['draft', 'scheduled', 'published', 'archived']).optional(),
  body: z.record(z.string(), z.unknown()).optional(),
  seo: SeoSchema.optional(),
  author_id: z.string().uuid().optional(),
  locale_code: z.string().max(10).optional(),
  // Model B per-site scoping (docs/49 §3): the web PROPERTIES this entry
  // publishes to. Omitted → defaults to the ACTIVE site for multi-site tenants
  // (so a page authored on site B belongs to site B); `[]` = all sites.
  property_ids: z.array(z.string().uuid()).max(50).optional(),
});

const UpdateBody = z.object({
  slug: z.string().min(1).max(255).optional(),
  body: z.record(z.string(), z.unknown()).optional(),
  seo: SeoSchema.optional(),
  author_id: z.string().uuid().nullable().optional(),
  locale_code: z.string().max(10).nullable().optional(),
  // Model B per-site scoping (docs/49 §3): the web PROPERTIES this entry
  // publishes to. EMPTY = all sites (the default). Full-replacement set; omit to
  // leave the scope unchanged.
  property_ids: z.array(z.string().uuid()).max(50).optional(),
});

const ListQuery = z.object({
  type: z.string().max(63).optional(),
  status: z.enum(['draft', 'scheduled', 'published', 'archived']).optional(),
  slug: z.string().max(255).optional(),
  q: z.string().max(255).optional(),
  author: z.string().uuid().optional(),
  locale: z.string().max(10).optional(),
  updated_after: z.string().datetime().optional(),
  // Model B (docs/49 §3): scope the back-office list to one site — entries
  // VISIBLE on it (global + scoped-here), matching that site's storefront.
  // Omitted → the site the caller is working in; `all` → every site.
  property: z.string().min(1).optional(),
  take: z.coerce.number().int().min(1).max(250).optional(),
  skip: z.coerce.number().int().min(0).optional(),
});

const PathId = z.object({ id: z.string().uuid() });

const entryRoutes: FastifyPluginAsync = (app) => {
  // ──────────────────────────────────────────────────────────────────────
  // LIST
  // ──────────────────────────────────────────────────────────────────────

  app.get('/v1/content/entries', async (request) => {
    const auth = requireRole(request, 'viewer');
    const q = ListQuery.parse(request.query);
    const propertyId = await resolveListScope(
      auth,
      q.property,
      request.headers['x-sparx-property-id']
    );

    const where: Prisma.ContentEntryWhereInput = {
      deletedAt: null,
      ...(q.type ? { typeKey: q.type } : {}),
      ...(q.status ? { status: q.status } : {}),
      ...(q.slug ? { slug: q.slug } : {}),
      ...(q.author ? { authorId: q.author } : {}),
      ...(q.locale ? { localeCode: q.locale } : {}),
      ...(q.updated_after ? { updatedAt: { gt: new Date(q.updated_after) } } : {}),
      ...(q.q
        ? {
            OR: [
              { slug: { contains: q.q, mode: 'insensitive' } },
              // Body title search via JSONB ->>'title'. Postgres can index
              // this with a GIN expression index — added when search load
              // demands it (Phase 4 puts the full-text path on Typesense).
              { body: { path: ['title'], string_contains: q.q } },
            ],
          }
        : {}),
      // Site scope composes as its own `AND` fragment so it never collides with
      // the search `OR` above (a foreign/stale id just yields global-only rows;
      // tenant_id RLS is the real boundary, not property_id).
      ...(propertyId ? contentSiteVisibilityWhere(propertyId) : {}),
    };

    const take = Math.min(q.take ?? 50, 250);
    const [rows, total] = await withRequestTenant(request, (tx) =>
      Promise.all([
        tx.contentEntry.findMany({
          where,
          orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
          take,
          skip: q.skip ?? 0,
        }),
        tx.contentEntry.count({ where }),
      ])
    );

    return paged(rows.map(serializeEntry), { total, per_page: q.take ?? 50 });
  });

  // ──────────────────────────────────────────────────────────────────────
  // GET ONE
  // ──────────────────────────────────────────────────────────────────────

  app.get('/v1/content/entries/:id', async (request, reply) => {
    requireRole(request, 'viewer');
    const { id } = PathId.parse(request.params);
    const row = await withRequestTenant(request, (tx) =>
      tx.contentEntry.findFirst({
        where: { id, deletedAt: null },
        // Model B (docs/49 §3): the editor needs the current site scope to
        // pre-fill its "Visible on sites" control. Empty = all sites.
        include: { propertyLinks: { select: { propertyId: true } } },
      })
    );
    if (!row) throw notFound('Entry', id);
    void reply.header('ETag', computeEntryEtag(row));
    return ok({
      ...serializeEntry(row),
      propertyIds: row.propertyLinks.map((l) => l.propertyId),
    });
  });

  // ──────────────────────────────────────────────────────────────────────
  // CREATE
  // ──────────────────────────────────────────────────────────────────────

  app.post('/v1/content/entries', async (request, reply) => {
    const auth = requireRole(request, 'editor');
    const input = CreateBody.parse(request.body);

    // Model B (docs/49 §3): default a new entry's site scope to the ACTIVE site
    // for multi-site tenants (so "New page" authored on site B belongs to site
    // B, not every site). An explicit `property_ids` (including `[]` = all
    // sites) is honored; single-site tenants get no scope rows. Mirrors the
    // products POST default — the load-bearing default for every create path.
    let scopePropertyIds = input.property_ids;
    if (scopePropertyIds === undefined) {
      const siteCount = await withRequestTenant(request, (tx) => tx.property.count());
      if (siteCount > 1) {
        const header = request.headers['x-sparx-property-id'];
        const activePropertyId = await resolvePropertyId(
          auth,
          typeof header === 'string' ? header : null
        );
        scopePropertyIds = [activePropertyId];
      }
    }

    const { entry: created, events } = await withRequestTenant(request, async (tx) => {
      const result = await createEntryTx(
        tx,
        { tenantId: auth.tenantId, actorId: auth.actorId },
        {
          typeKey: input.type_key,
          slug: input.slug,
          status: input.status,
          body: input.body,
          seo: input.seo,
          authorId: input.author_id,
          localeCode: input.locale_code,
          propertyIds: scopePropertyIds,
        }
      );
      await writeAudit(tx, request, auth, {
        action: 'content.entry.created',
        entityType: 'content_entry',
        entityId: result.entry.id,
        after: {
          typeKey: result.entry.typeKey,
          slug: result.entry.slug,
          status: result.entry.status,
        },
      });
      return result;
    });

    for (const ev of events) {
      await publish(request.log, ev.type, auth.tenantId, auth.actorId, ev.data);
    }

    reply.code(201);
    void reply.header('ETag', computeEntryEtag(created));
    return ok(serializeEntry(created));
  });

  // ──────────────────────────────────────────────────────────────────────
  // UPDATE
  // ──────────────────────────────────────────────────────────────────────

  app.patch('/v1/content/entries/:id', async (request, reply) => {
    const auth = requireRole(request, 'editor');
    const { id } = PathId.parse(request.params);
    const input = UpdateBody.parse(request.body);
    const ifMatch = request.headers['if-match'];

    const { entry: updated, events } = await withRequestTenant(request, async (tx) => {
      // Optimistic-concurrency guard stays a route concern (it reads the
      // request's If-Match header). The dashboard form sends the etag it
      // received on GET; a mismatch throws 412 so the form can offer "reload".
      const existing = await tx.contentEntry.findFirst({ where: { id, deletedAt: null } });
      if (!existing) throw notFound('Entry', id);
      assertIfMatch(typeof ifMatch === 'string' ? ifMatch : undefined, computeEntryEtag(existing));

      const result = await updateEntryTx(
        tx,
        { tenantId: auth.tenantId, actorId: auth.actorId },
        id,
        {
          slug: input.slug,
          body: input.body,
          seo: input.seo,
          authorId: input.author_id,
          localeCode: input.locale_code,
          propertyIds: input.property_ids,
        }
      );
      await writeAudit(tx, request, auth, {
        action: 'content.entry.updated',
        entityType: 'content_entry',
        entityId: result.entry.id,
        before: { slug: existing.slug, status: existing.status },
        after: { slug: result.entry.slug, status: result.entry.status },
      });
      return result;
    });

    for (const ev of events) {
      await publish(request.log, ev.type, auth.tenantId, auth.actorId, ev.data);
    }

    void reply.header('ETag', computeEntryEtag(updated));
    return ok(serializeEntry(updated));
  });

  // ──────────────────────────────────────────────────────────────────────
  // DELETE (soft)
  // ──────────────────────────────────────────────────────────────────────

  app.delete('/v1/content/entries/:id', async (request, reply) => {
    const auth = requireRole(request, 'editor');
    const { id } = PathId.parse(request.params);

    await withRequestTenant(request, async (tx) => {
      const existing = await tx.contentEntry.findFirst({ where: { id, deletedAt: null } });
      if (!existing) throw notFound('Entry', id);

      await tx.contentEntry.update({
        where: { id },
        data: { deletedAt: new Date() },
      });
      await writeAudit(tx, request, auth, {
        action: 'content.entry.deleted',
        entityType: 'content_entry',
        entityId: id,
        before: { slug: existing.slug, status: existing.status },
      });
    });

    await publish(request.log, 'content.entry.deleted', auth.tenantId, auth.actorId, {
      entryId: id,
    });

    reply.code(204);
  });
  return Promise.resolve();
};

export default entryRoutes;
