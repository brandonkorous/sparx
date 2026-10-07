// Media assets — read, edit metadata, soft-delete.
//
//   GET    /v1/media/assets                 → list (offset-paged)
//   GET    /v1/media/assets/:id             → detail with variants
//   PATCH  /v1/media/assets/:id             → alt text, caption, focal point
//   DELETE /v1/media/assets/:id             → soft delete (rejects when in use)
//
// Variant URLs come straight off the storage backend's `publicUrl(key)`.
// In prod that's the Cloudflare CDN; in dev it's the api-rest origin
// serving from disk. Either way the dashboard can `<img src=url>` it.

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import type { Prisma } from '@wizeworks/db';
import { withRequestTenant } from '@wizeworks/api-core/db';
import { ok, paged } from '@wizeworks/api-core/envelope';
import { requireRole } from '@wizeworks/api-core/auth';
import { writeAudit } from '@wizeworks/api-core/audit';
import { publish } from '@wizeworks/api-core/pubsub';
import { indexEntity } from '@wizeworks/events';
import { getStorage } from '../../../lib/storage.js';
import { mediaSiteVisibilityWhere, resolveListScope } from '../../../lib/property.js';
import { conflict, notFound } from '@wizeworks/api-core/errors';
import {
  countAssetUsage,
  placesUsingAsset,
  countOneAssetUsage,
  describeUsage,
  type AssetUsage,
} from '@wizeworks/media';

const ListQuery = z.object({
  q: z.string().max(255).optional(),
  // Resolve a KNOWN set of assets in one request — comma-separated ids.
  //
  // Added for the workbench product Media tab: `GET /commerce/products/:id/images`
  // hands back `media_asset_id` and nothing renderable, so every gallery needed a
  // second read to turn ids into thumbnail URLs. The alternative is one
  // `/media/assets/:id` per image, which on a twelve-photo product is twelve
  // round trips for one panel — the exact N+1 the workbench data layer exists to
  // avoid. Ignores `q`/`status`/`type` ordering concerns: an explicit id set is
  // already the filter.
  ids: z
    .string()
    .max(9_000)
    .optional()
    .transform((value) =>
      value
        ? value
            .split(',')
            .map((id) => id.trim())
            .filter((id) => id !== '')
        : undefined
    )
    .pipe(z.array(z.string().uuid()).min(1).max(250).optional()),
  status: z.enum(['uploading', 'ready', 'failed']).optional(),
  // Filter to assets whose mime_type starts with this string ("image",
  // "video", "audio") so the dashboard's asset picker can scope to type
  // without doing the substring match client-side.
  type: z.string().max(63).optional(),
  // Site scope (docs/49). Absent → the active site (`x-sparx-property-id`), which is
  // the picker's default so it only shows this site's media + shared. `all` reads
  // across every site the actor may see. An explicit id targets one site.
  property: z.string().max(64).optional(),
  // Auto-group filter (docs/49) — 'brand' | 'product' | 'marketing' | 'content'. The
  // picker's group tabs pass this; absent = every group.
  source: z.string().max(32).optional(),
  // Manual-collection filter (docs/49) — only assets pinned to this collection.
  collection: z.string().uuid().optional(),
  // Only files nothing uses (`unused`), or only ones something does (`used`).
  // Usage is COUNTED, not stored, so this cannot be a WHERE clause: the
  // matching set is counted whole and paged afterwards (issue 932). A library
  // runs to thousands of files at most, and the count is grouped queries.
  usage: z.enum(['used', 'unused']).optional(),
  // The library's order. Absent is recently changed, as it always was; the rest
  // answer "what did I add first", "where is the one called…" and "what is
  // taking the room" (issue 932).
  sort: z.enum(['recent', 'oldest', 'name', 'largest']).optional(),
  // `limit` is a legacy alias for `take`, still used by the asset-picker
  // modal's single bulk fetch — offset pagination (`take`/`skip` + `total`)
  // is what the media library list page uses, matching every other list.
  limit: z.coerce.number().int().min(1).max(250).optional(),
  take: z.coerce.number().int().min(1).max(250).optional(),
  skip: z.coerce.number().int().min(0).optional(),
});

const PathId = z.object({ id: z.string().uuid() });

/** `countAssetUsage` answers every id it was asked about, so this only covers
 *  the type: an asset missing from the map is one nothing counted as used. */
const EMPTY_USAGE: AssetUsage = {
  content: 0,
  products: 0,
  customers: 0,
  authors: 0,
  staffDocuments: 0,
  expenses: 0,
  sitePages: 0,
  siteLayouts: 0,
  branding: 0,
  catalog: 0,
  reviews: 0,
  socialPosts: 0,
  otherRecords: 0,
  total: 0,
};

const PatchBody = z
  .object({
    alt_text: z.string().max(500).nullable().optional(),
    caption: z.string().max(2000).nullable().optional(),
    focal_point_x: z.number().min(0).max(1).optional(),
    focal_point_y: z.number().min(0).max(1).optional(),
  })
  .strict();

interface AssetRow {
  id: string;
  key: string;
  originalFilename: string;
  mimeType: string;
  byteSize: bigint;
  width: number | null;
  height: number | null;
  durationSec: number | null;
  dominantColor: string | null;
  blurhash: string | null;
  focalPointX: number;
  focalPointY: number;
  altText: string | null;
  caption: string | null;
  status: string;
  source: string | null;
  processingError: string | null;
  createdAt: Date;
  updatedAt: Date;
}

interface VariantRow {
  id: string;
  format: string;
  width: number;
  height: number;
  byteSize: bigint;
  key: string;
  // Set on a social aspect crop (docs/133 §8) — '1:1' | '4:5' | '9:16' | '16:9';
  // null for the ordinary scale-to-width variant. Lets the composer pick the crop
  // matching each platform's aspect for its live preview.
  aspect: string | null;
}

function serializeAsset(row: AssetRow, variants: VariantRow[], usage: AssetUsage) {
  const storage = getStorage();
  return {
    id: row.id,
    key: row.key,
    original_filename: row.originalFilename,
    mime_type: row.mimeType,
    byte_size: row.byteSize.toString(),
    width: row.width,
    height: row.height,
    duration_sec: row.durationSec,
    dominant_color: row.dominantColor,
    blurhash: row.blurhash,
    focal_point: { x: row.focalPointX, y: row.focalPointY },
    alt_text: row.altText,
    caption: row.caption,
    status: row.status,
    source: row.source,
    processing_error: row.processingError,
    // COUNTED, never read off `media_assets.usage_count`: that column has never
    // been written by anything, so it reported "not used anywhere" about 2,406
    // pictures that were on live product pages (issue 381). Every path counts,
    // the PATCH response included, so the column feeds nothing on the wire.
    usage_count: usage.total,
    usage_breakdown: {
      products: usage.products,
      content: usage.content,
      customers: usage.customers,
      authors: usage.authors,
      staff_documents: usage.staffDocuments,
      expenses: usage.expenses,
      // Site pages and layouts, the brand, catalog pictures, reviews, social
      // posts and evidence records (issue 932).
      site_pages: usage.sitePages,
      site_layouts: usage.siteLayouts,
      branding: usage.branding,
      catalog: usage.catalog,
      reviews: usage.reviews,
      social_posts: usage.socialPosts,
      other_records: usage.otherRecords,
    },
    // Originals are private — the dashboard fetches them via a separate
    // signed-GET flow once we add it (Phase 3.7). Variants are public.
    //
    // A key that IS ALREADY A URL is surfaced verbatim; only a real STORAGE key gets
    // resolved through `storage.publicUrl`. Two kinds qualify: an absolute http(s)
    // ref (a hot-linked blueprint asset) and an inline `data:` URI (an SVG brand mark
    // — stored inline, no transcoded variants since the worker skips SVG). Matching
    // http(s) alone sent `data:` down the storage branch, which CONCATENATED the
    // public base onto the URI ("…/v1/public/media/file/data:image/svg+xml,…") and
    // yielded a 404. The dashboard trusts original_url over the raw key, so a set
    // logo previewed as an empty tile (docs/122).
    //
    // In local mode the original bytes are served by api-rest; in GCS mode the private
    // original has no public URL (null) — there the dashboard falls back to the key.
    original_url: /^(?:https?:|data:)/i.test(row.key)
      ? row.key
      : storage.mode === 'local'
        ? storage.publicUrl(row.key)
        : null,
    variants: variants.map((v) => ({
      id: v.id,
      format: v.format,
      width: v.width,
      height: v.height,
      aspect: v.aspect,
      byte_size: v.byteSize.toString(),
      url: storage.publicUrl(v.key),
    })),
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
  };
}

const mediaAssetRoutes: FastifyPluginAsync = (app) => {
  // ──────────────────────────────────────────────────────────────────────
  // LIST
  // ──────────────────────────────────────────────────────────────────────

  app.get('/v1/media/assets', async (request) => {
    const auth = requireRole(request, 'viewer');
    const q = ListQuery.parse(request.query);
    const take = Math.min(q.take ?? q.limit ?? 50, 250);
    const skip = q.skip ?? 0;

    // Site scope (docs/49) — this site's media + shared (property_id NULL). SKIPPED
    // when resolving an explicit id set: those resolve by id regardless of the active
    // site, so an asset referenced by a product/page never vanishes just because a
    // different site is in focus (the same N+1-avoiding path the composer galleries use).
    const scope = q.ids
      ? undefined
      : await resolveListScope(auth, q.property, request.headers['x-sparx-property-id']);

    const where: Prisma.MediaAssetWhereInput = {
      deletedAt: null,
      ...(q.ids ? { id: { in: q.ids } } : {}),
      ...(q.status ? { status: q.status } : {}),
      ...(q.type ? { mimeType: { startsWith: q.type } } : {}),
      // 'none' is the "Uploaded" group — assets with no source label (source IS NULL).
      ...(q.source ? (q.source === 'none' ? { source: null } : { source: q.source }) : {}),
      ...(q.collection ? { collections: { some: { collectionId: q.collection } } } : {}),
      ...(q.q
        ? {
            OR: [
              { originalFilename: { contains: q.q, mode: 'insensitive' } },
              { altText: { contains: q.q, mode: 'insensitive' } },
              { caption: { contains: q.q, mode: 'insensitive' } },
            ],
          }
        : {}),
      ...(scope ? mediaSiteVisibilityWhere(scope) : {}),
    };

    const orderBy: Prisma.MediaAssetOrderByWithRelationInput[] =
      q.sort === 'oldest'
        ? [{ createdAt: 'asc' }, { id: 'asc' }]
        : q.sort === 'name'
          ? [{ originalFilename: 'asc' }, { id: 'asc' }]
          : q.sort === 'largest'
            ? [{ byteSize: 'desc' }, { id: 'desc' }]
            : [{ updatedAt: 'desc' }, { id: 'desc' }];

    const [page, total] = await withRequestTenant(request, async (tx) => {
      if (q.usage) {
        // Every match, in the list's own order, then narrowed by its count.
        const all = await tx.mediaAsset.findMany({
          where,
          orderBy,
          select: { id: true },
        });
        const counts = await countAssetUsage(
          tx,
          all.map((r) => r.id)
        );
        const wanted = all
          .map((r) => r.id)
          .filter((id) => (counts.get(id)?.total ?? 0) > 0 === (q.usage === 'used'));
        const pageIds = wanted.slice(skip, skip + take);
        const rows = await tx.mediaAsset.findMany({ where: { id: { in: pageIds } } });
        const byId = new Map(rows.map((r) => [r.id, r]));
        return [pageIds.flatMap((id) => byId.get(id) ?? []), wanted.length] as const;
      }
      return Promise.all([
        tx.mediaAsset.findMany({
          where,
          orderBy,
          take,
          skip,
        }),
        tx.mediaAsset.count({ where }),
      ]);
    });

    // Variants for the whole page in one query (not per-row), so the asset
    // picker + media library can render real thumbnails. Without this the list
    // returned `variants: []` for every asset and every thumbnail fell back to
    // the (prod-private, so null) original — i.e. no thumbnails in prod at all.
    const variantsByAsset = new Map<string, VariantRow[]>();
    if (page.length > 0) {
      const variants = await withRequestTenant(request, (tx) =>
        tx.mediaVariant.findMany({
          where: { assetId: { in: page.map((r) => r.id) } },
          orderBy: [{ format: 'asc' }, { width: 'asc' }],
        })
      );
      for (const v of variants) {
        const list = variantsByAsset.get(v.assetId) ?? [];
        list.push(v);
        variantsByAsset.set(v.assetId, list);
      }
    }

    // One grouped count for the whole page, beside the variants query above and
    // for the same reason: the alternative is a query per row.
    const usageByAsset = await withRequestTenant(request, (tx) =>
      countAssetUsage(
        tx,
        page.map((r) => r.id)
      )
    );

    return paged(
      page.map((row) =>
        serializeAsset(
          row,
          variantsByAsset.get(row.id) ?? [],
          usageByAsset.get(row.id) ?? EMPTY_USAGE
        )
      ),
      { total, per_page: take }
    );
  });

  // ──────────────────────────────────────────────────────────────────────
  // GET ONE — with variants
  // ──────────────────────────────────────────────────────────────────────

  app.get('/v1/media/assets/:id', async (request) => {
    requireRole(request, 'viewer');
    const { id } = PathId.parse(request.params);

    const { asset, variants, usage, places } = await withRequestTenant(request, async (tx) => {
      const row = await tx.mediaAsset.findFirst({ where: { id, deletedAt: null } });
      if (!row) throw notFound('MediaAsset', id);
      const vs = await tx.mediaVariant.findMany({
        where: { assetId: id },
        orderBy: [{ format: 'asc' }, { width: 'asc' }],
      });
      return {
        asset: row,
        variants: vs,
        usage: await countOneAssetUsage(tx, id),
        places: await placesUsingAsset(tx, id),
      };
    });

    // Which products, articles and pages, by name, on the single read only: the
    // list counts, and a person about to delete a file opens it first (issue 932).
    return ok({ ...serializeAsset(asset, variants, usage), used_by: places });
  });

  // ──────────────────────────────────────────────────────────────────────
  // PATCH — metadata only
  // ──────────────────────────────────────────────────────────────────────

  app.patch('/v1/media/assets/:id', async (request) => {
    const auth = requireRole(request, 'editor');
    const { id } = PathId.parse(request.params);
    const input = PatchBody.parse(request.body);

    const updated = await withRequestTenant(request, async (tx) => {
      const existing = await tx.mediaAsset.findFirst({ where: { id, deletedAt: null } });
      if (!existing) throw notFound('MediaAsset', id);

      const after = await tx.mediaAsset.update({
        where: { id },
        data: {
          ...(input.alt_text !== undefined ? { altText: input.alt_text } : {}),
          ...(input.caption !== undefined ? { caption: input.caption } : {}),
          ...(input.focal_point_x !== undefined ? { focalPointX: input.focal_point_x } : {}),
          ...(input.focal_point_y !== undefined ? { focalPointY: input.focal_point_y } : {}),
        },
      });

      // The focal point drives the social aspect crops (docs/133 §8) — a real move on
      // a ready image means the baked crops are stale and must be regenerated.
      const focalMoved =
        after.focalPointX !== existing.focalPointX || after.focalPointY !== existing.focalPointY;
      const recrop = focalMoved && after.status === 'ready' && after.mimeType.startsWith('image/');

      await writeAudit(tx, request, auth, {
        action: 'media.asset.updated',
        entityType: 'media_asset',
        entityId: id,
        before: {
          altText: existing.altText,
          focalPoint: { x: existing.focalPointX, y: existing.focalPointY },
        },
        after: {
          altText: after.altText,
          focalPoint: { x: after.focalPointX, y: after.focalPointY },
        },
      });

      const vs = await tx.mediaVariant.findMany({
        where: { assetId: id },
        orderBy: [{ format: 'asc' }, { width: 'asc' }],
      });
      return { asset: after, variants: vs, recrop, usage: await countOneAssetUsage(tx, id) };
    });

    // Regenerate the social crops off the request path (docs/133 §8) — the media
    // worker consumes this on its existing media.uploaded subscription and, seeing
    // `reason: 'recrop'`, refreshes ONLY the aspect crops from the new focal point.
    if (updated.recrop) {
      await publish(request.log, 'media.uploaded', auth.tenantId, auth.actorId, {
        assetId: updated.asset.id,
        key: updated.asset.key,
        mimeType: updated.asset.mimeType,
        byteSize: updated.asset.byteSize.toString(),
        reason: 'recrop',
      });
    }

    // Alt text and the caption are both keywords on the indexed document, and
    // alt text is the words a person is most likely to search a photograph by.
    await indexEntity({
      tenantId: auth.tenantId,
      actorId: auth.actorId,
      entityType: 'media',
      recordId: id,
    });

    return ok(serializeAsset(updated.asset, updated.variants, updated.usage));
  });

  // ──────────────────────────────────────────────────────────────────────
  // DELETE — soft delete, refuses when referenced
  // ──────────────────────────────────────────────────────────────────────

  app.delete('/v1/media/assets/:id', async (request, reply) => {
    const auth = requireRole(request, 'editor');
    const { id } = PathId.parse(request.params);

    await withRequestTenant(request, async (tx) => {
      const existing = await tx.mediaAsset.findFirst({ where: { id, deletedAt: null } });
      if (!existing) throw notFound('MediaAsset', id);

      // Refuse delete-while-referenced — entries that still link to this
      // asset would 404 their images. Caller has to detach first.
      //
      // COUNTED. This read `existing.usageCount`, a column nothing has ever
      // written, so the guard could not fire and the console would let an owner
      // delete a photograph that is on a live product page (issue 381). The
      // refusal now names the KINDS, because "still referenced by 4 entries"
      // tells somebody nothing about which screen to go and fix.
      const usage = await countOneAssetUsage(tx, id);
      if (usage.total > 0) {
        throw conflict(`This file is still used by ${describeUsage(usage)}. Detach it first.`, {
          usage_count: usage.total,
        });
      }

      await tx.mediaAsset.update({
        where: { id },
        data: { deletedAt: new Date() },
      });
      await writeAudit(tx, request, auth, {
        action: 'media.asset.deleted',
        entityType: 'media_asset',
        entityId: id,
        before: { status: existing.status, key: existing.key },
      });
    });

    await publish(request.log, 'media.deleted', auth.tenantId, auth.actorId, { assetId: id });

    reply.code(204);
  });
  return Promise.resolve();
};

export default mediaAssetRoutes;
