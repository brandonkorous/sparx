// Media collections (docs/49) — the manual "boards" a tenant builds by hand, on top
// of the automatic source groups. CRUD over media_collections + the asset↔collection
// join. Site-scoped like assets: a collection is created on the active site (or is
// shared, property_id NULL) and the list shows "this site ∪ shared".
//
//   GET    /v1/media/collections                 → list (site-scoped) + item counts
//   POST   /v1/media/collections                 → create { name }
//   PATCH  /v1/media/collections/:id             → rename { name }
//   DELETE /v1/media/collections/:id             → soft delete (memberships cascade)
//   POST   /v1/media/collections/:id/assets      → add { asset_ids }
//   DELETE /v1/media/collections/:id/assets/:assetId → remove one

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { withRequestTenant } from '@wizeworks/api-core/db';
import { ok } from '@wizeworks/api-core/envelope';
import { requireRole } from '@wizeworks/api-core/auth';
import { writeAudit } from '@wizeworks/api-core/audit';
import { badRequest, notFound } from '@wizeworks/api-core/errors';
import { resolveListScope, resolvePropertyId } from '../../../lib/property.js';

const CreateBody = z.object({ name: z.string().trim().min(1).max(120) });
const RenameBody = z.object({ name: z.string().trim().min(1).max(120) });
const AddAssetsBody = z.object({
  asset_ids: z.array(z.string().uuid()).min(1).max(250),
});
const PathId = z.object({ id: z.string().uuid() });
const AssetPath = z.object({ id: z.string().uuid(), assetId: z.string().uuid() });
const ListQuery = z.object({ property: z.string().max(64).optional() });

interface CollectionRow {
  id: string;
  name: string;
  propertyId: string | null;
  createdAt: Date;
  updatedAt: Date;
  _count?: { items: number };
}

function serialize(row: CollectionRow) {
  return {
    id: row.id,
    name: row.name,
    property_id: row.propertyId,
    item_count: row._count?.items ?? 0,
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
  };
}

const activeHeader = (h: string | string[] | undefined): string | undefined =>
  Array.isArray(h) ? h[0] : h;

const mediaCollectionRoutes: FastifyPluginAsync = (app) => {
  // LIST — this site's collections + shared, newest use first.
  app.get('/v1/media/collections', async (request) => {
    const auth = requireRole(request, 'viewer');
    const q = ListQuery.parse(request.query);
    const scope = await resolveListScope(auth, q.property, request.headers['x-sparx-property-id']);

    const rows = await withRequestTenant(request, (tx) =>
      tx.mediaCollection.findMany({
        // Site scope = this site ∪ shared (property_id NULL). A plain top-level `OR`
        // is safe here — unlike the asset list, this where has no search `OR` to
        // collide with (Prisma ANDs top-level keys).
        where: {
          deletedAt: null,
          ...(scope ? { OR: [{ propertyId: scope }, { propertyId: null }] } : {}),
        },
        orderBy: [{ updatedAt: 'desc' }, { name: 'asc' }],
        include: { _count: { select: { items: true } } },
        take: 200,
      })
    );

    return ok(rows.map(serialize));
  });

  // CREATE — stamped with the active site (a collection belongs to the site it was
  // made on; fails closed to primary, exactly like an upload).
  app.post('/v1/media/collections', async (request, reply) => {
    const auth = requireRole(request, 'editor');
    const { name } = CreateBody.parse(request.body);
    const propertyId = await resolvePropertyId(
      auth,
      activeHeader(request.headers['x-sparx-property-id'])
    );

    const created = await withRequestTenant(request, async (tx) => {
      const row = await tx.mediaCollection.create({
        data: { tenantId: auth.tenantId, propertyId, name },
        include: { _count: { select: { items: true } } },
      });
      await writeAudit(tx, request, auth, {
        action: 'media.collection.created',
        entityType: 'media_collection',
        entityId: row.id,
        after: { name },
      });
      return row;
    });

    reply.code(201);
    return ok(serialize(created));
  });

  // RENAME
  app.patch('/v1/media/collections/:id', async (request) => {
    const auth = requireRole(request, 'editor');
    const { id } = PathId.parse(request.params);
    const { name } = RenameBody.parse(request.body);

    const updated = await withRequestTenant(request, async (tx) => {
      const existing = await tx.mediaCollection.findFirst({ where: { id, deletedAt: null } });
      if (!existing) throw notFound('MediaCollection', id);
      const row = await tx.mediaCollection.update({
        where: { id },
        data: { name },
        include: { _count: { select: { items: true } } },
      });
      await writeAudit(tx, request, auth, {
        action: 'media.collection.renamed',
        entityType: 'media_collection',
        entityId: id,
        before: { name: existing.name },
        after: { name },
      });
      return row;
    });

    return ok(serialize(updated));
  });

  // DELETE — soft delete; the membership rows drop with the FK cascade when the row
  // is later hard-purged, but soft-delete alone hides it everywhere immediately.
  app.delete('/v1/media/collections/:id', async (request, reply) => {
    const auth = requireRole(request, 'editor');
    const { id } = PathId.parse(request.params);

    await withRequestTenant(request, async (tx) => {
      const existing = await tx.mediaCollection.findFirst({ where: { id, deletedAt: null } });
      if (!existing) throw notFound('MediaCollection', id);
      await tx.mediaCollection.update({ where: { id }, data: { deletedAt: new Date() } });
      // The memberships are meaningless without the collection — clear them so a
      // re-created collection never inherits stale rows and counts stay honest.
      await tx.mediaAssetCollection.deleteMany({ where: { collectionId: id } });
      await writeAudit(tx, request, auth, {
        action: 'media.collection.deleted',
        entityType: 'media_collection',
        entityId: id,
        before: { name: existing.name },
      });
    });

    reply.code(204);
  });

  // ADD ASSETS — only the caller's OWN, existing assets (RLS-scoped lookup), so a
  // forged id can never pin another tenant's asset into a collection.
  app.post('/v1/media/collections/:id/assets', async (request) => {
    const auth = requireRole(request, 'editor');
    const { id } = PathId.parse(request.params);
    const { asset_ids: assetIds } = AddAssetsBody.parse(request.body);

    const count = await withRequestTenant(request, async (tx) => {
      const collection = await tx.mediaCollection.findFirst({ where: { id, deletedAt: null } });
      if (!collection) throw notFound('MediaCollection', id);

      const owned = await tx.mediaAsset.findMany({
        where: { id: { in: assetIds }, deletedAt: null },
        select: { id: true },
      });
      if (owned.length === 0) throw badRequest('None of those pictures are in your library.');

      const result = await tx.mediaAssetCollection.createMany({
        data: owned.map((a) => ({ tenantId: auth.tenantId, collectionId: id, assetId: a.id })),
        skipDuplicates: true,
      });
      // Touch the collection so it sorts to the top of the "recently used" list.
      await tx.mediaCollection.update({ where: { id }, data: { updatedAt: new Date() } });
      return result.count;
    });

    return ok({ added: count });
  });

  // REMOVE ONE
  app.delete('/v1/media/collections/:id/assets/:assetId', async (request, reply) => {
    requireRole(request, 'editor');
    const { id, assetId } = AssetPath.parse(request.params);

    await withRequestTenant(request, (tx) =>
      tx.mediaAssetCollection.deleteMany({ where: { collectionId: id, assetId } })
    );

    reply.code(204);
  });

  return Promise.resolve();
};

export default mediaCollectionRoutes;
