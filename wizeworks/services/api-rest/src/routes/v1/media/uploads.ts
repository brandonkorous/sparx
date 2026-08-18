// Media upload — presigned-URL flow.
//
//   POST   /v1/media/uploads                  → create asset row + presign PUT
//   POST   /v1/media/uploads/:id/complete     → confirm upload, emit media.uploaded
//   PUT    /v1/media/_local/:encodedKey       → dev-only: receive bytes when
//                                                MediaStorage is the local backend
//
// Two-phase flow exists so we can budget against the tenant's plan
// allowance BEFORE the bytes hit the network, and so the GCS bucket
// stays write-only from a browser's perspective (no listing). The asset
// row is created with `status='uploading'`; the transcoder worker (or, in
// dev with no worker, the /complete endpoint itself) flips it to 'ready'
// once variants exist.

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { withRequestTenant } from '@wizeworks/api-core/db';
import { ok } from '@wizeworks/api-core/envelope';
import { requireRole } from '@wizeworks/api-core/auth';
import { writeAudit } from '@wizeworks/api-core/audit';
import { publish } from '@wizeworks/api-core/pubsub';
import { getStorage, originalKey } from '../../../lib/storage.js';
import { resolvePropertyId } from '../../../lib/property.js';
import { badRequest, conflict, notFound } from '@wizeworks/api-core/errors';
import { env } from '../../../env.js';

// Conservative ceiling — anything bigger than 200 MB the tenant can
// upload via the desktop CLI tool (when that exists) or escalate to
// support. The bucket has a 50 GB / object hard limit but we'd rather
// not let a typo cost $5 in egress.
const MAX_UPLOAD_BYTES = 200 * 1024 * 1024;

// Allowlist by category — we don't accept executables or office docs in
// the media library. Anything outside the list returns 400 with the list
// embedded so the dashboard can render a useful error.
const ALLOWED_MIME = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/avif',
  'image/gif',
  'image/svg+xml',
  'video/mp4',
  'video/webm',
  'video/quicktime',
  'audio/mpeg',
  'audio/mp4',
  'audio/wav',
  'application/pdf',
]);

// The surface an upload came from, for the picker's automatic groups (docs/49). A
// soft grouping label, never a permission boundary — an unknown/absent value just
// reads as "Uploaded". Kept in sync with the workbench MEDIA_SOURCE labels.
const MEDIA_SOURCES = ['brand', 'product', 'marketing', 'content'] as const;

const CreateUploadBody = z.object({
  filename: z.string().min(1).max(255),
  mime_type: z.string().min(1).max(127),
  byte_size: z.coerce.number().int().positive().max(MAX_UPLOAD_BYTES),
  source: z.enum(MEDIA_SOURCES).optional(),
});

// Content-type from a storage key's file extension — used by the local-mode
// file route, whose backend (LocalStorage) does not persist the content-type.
// Mirrors the allowlist of accepted upload types; defaults to octet-stream for
// anything unrecognised (never an image type, so ORB still guards non-media).
const CONTENT_TYPE_BY_EXT: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  avif: 'image/avif',
  gif: 'image/gif',
  svg: 'image/svg+xml',
  mp4: 'video/mp4',
  webm: 'video/webm',
  mov: 'video/quicktime',
  mp3: 'audio/mpeg',
  m4a: 'audio/mp4',
  wav: 'audio/wav',
  pdf: 'application/pdf',
};
function contentTypeForKey(key: string): string {
  const ext = key.split('.').pop()?.toLowerCase() ?? '';
  return CONTENT_TYPE_BY_EXT[ext] ?? 'application/octet-stream';
}

const PathId = z.object({ id: z.string().uuid() });

const uploadRoutes: FastifyPluginAsync = (app) => {
  // ──────────────────────────────────────────────────────────────────────
  // CREATE — reserve an asset row + presign the PUT URL
  // ──────────────────────────────────────────────────────────────────────

  app.post('/v1/media/uploads', async (request, reply) => {
    const auth = requireRole(request, 'editor');
    const input = CreateUploadBody.parse(request.body);

    if (!ALLOWED_MIME.has(input.mime_type)) {
      throw badRequest(`Unsupported mime type "${input.mime_type}".`, {
        allowed: [...ALLOWED_MIME].sort(),
      });
    }

    const storage = getStorage();

    // Stamp the site this upload belongs to (docs/49) so it stays out of OTHER sites'
    // pickers. Resolves the active site from `x-sparx-property-id`, failing closed to
    // the tenant's primary — a new asset always belongs to exactly one site (a tenant
    // can later mark it shared). Existing assets predate this and are NULL = shared.
    const activeHeader = request.headers['x-sparx-property-id'];
    const propertyId = await resolvePropertyId(
      auth,
      Array.isArray(activeHeader) ? activeHeader[0] : activeHeader
    );

    const { asset, presigned } = await withRequestTenant(request, async (tx) => {
      const created = await tx.mediaAsset.create({
        data: {
          tenantId: auth.tenantId,
          propertyId,
          // The picker-group label the calling surface passed (docs/49) — 'brand' /
          // 'product' / 'marketing' / 'content', else NULL = "Uploaded".
          source: input.source ?? null,
          // Key is finalised after we know the asset id (so it can include
          // /originals/<assetId>/<filename>).
          key: '',
          originalFilename: input.filename,
          mimeType: input.mime_type,
          byteSize: BigInt(input.byte_size),
          status: 'uploading',
        },
      });
      const key = originalKey(auth.tenantId, created.id, input.filename);
      const url = await storage.presignPut(key, input.mime_type, input.byte_size);

      const updated = await tx.mediaAsset.update({
        where: { id: created.id },
        data: { key },
      });

      await writeAudit(tx, request, auth, {
        action: 'media.upload.requested',
        entityType: 'media_asset',
        entityId: created.id,
        after: { filename: input.filename, mimeType: input.mime_type },
      });

      return { asset: updated, presigned: url };
    });

    reply.code(201);
    return ok({
      asset: serializeUploadAsset(asset),
      upload: {
        url: presigned.url,
        method: 'PUT',
        headers: presigned.headers,
        expires_at: presigned.expiresAt,
      },
    });
  });

  // ──────────────────────────────────────────────────────────────────────
  // COMPLETE — confirm GCS PUT, fan out media.uploaded
  // ──────────────────────────────────────────────────────────────────────

  app.post('/v1/media/uploads/:id/complete', async (request) => {
    const auth = requireRole(request, 'editor');
    const { id } = PathId.parse(request.params);
    const storage = getStorage();

    const result = await withRequestTenant(request, async (tx) => {
      const existing = await tx.mediaAsset.findFirst({
        where: { id, deletedAt: null },
      });
      if (!existing) throw notFound('MediaAsset', id);
      if (existing.status !== 'uploading') {
        throw conflict(`Asset ${id} is already ${existing.status}.`);
      }

      // Optional: confirm the object exists at the expected key. In local
      // mode we trust the dashboard; in GCS mode we can do a HEAD to make
      // sure no one called /complete before the PUT actually finished.
      // (Skipping HEAD here keeps tests deterministic; the worker will
      // detect a missing object and flip status='failed' anyway.)

      // Ask whether a worker will TRANSCODE this, not which vendor is behind it.
      // This read `storage.mode === 'gcs'`, which quietly inverted the moment production
      // moved off GCS: every upload was marked `ready` with no variants, and since
      // `resolvePostAssets` requires a ready asset WITH variants, the image was there in
      // the composer and gone from the published post.
      const nextStatus = storage.transcodes ? 'uploading' : 'ready';
      const updated = await tx.mediaAsset.update({
        where: { id },
        data: {
          // Stay 'uploading' on a transcoding backend — media-worker flips it to 'ready'
          // once the variants exist. On local disk nothing else will ever touch it, so
          // mark it ready now or it stays invisible forever.
          status: nextStatus,
        },
      });

      await writeAudit(tx, request, auth, {
        action: 'media.upload.completed',
        entityType: 'media_asset',
        entityId: id,
        before: { status: existing.status },
        after: { status: updated.status },
      });

      return updated;
    });

    await publish(request.log, 'media.uploaded', auth.tenantId, auth.actorId, {
      assetId: result.id,
      key: result.key,
      mimeType: result.mimeType,
      byteSize: result.byteSize.toString(),
    });

    return ok(serializeUploadAsset(result));
  });

  // ──────────────────────────────────────────────────────────────────────
  // LOCAL — dev-mode upload receiver
  // ──────────────────────────────────────────────────────────────────────

  // Dev/test only. Bypasses auth because the URL was issued by `presignPut`
  // moments before — the contract is the same as a GCS signed URL: anyone
  // who holds it can upload to that exact key, and only that key. We do
  // re-check the key shape so a stray request can't write to a path that
  // looks like another tenant's prefix.
  if (env.GCS_MEDIA_BUCKET === undefined) {
    app.put<{ Params: { '*': string } }>(
      // Wildcard so the key travels as real path segments
      // (`<tenantId>/originals/<assetId>/<filename>`), matching the relative
      // URL `presignPut` returns. The dashboard proxies this path to api-rest
      // in dev (next.config rewrite); prod uploads go straight to GCS.
      '/v1/media/_local/*',
      {
        // Bigger than the JSON body limit because this carries real media.
        bodyLimit: MAX_UPLOAD_BYTES,
      },
      async (request, reply) => {
        const key = request.params['*'];
        const contentType = request.headers['content-type'] ?? 'application/octet-stream';
        const body = request.body;
        if (!Buffer.isBuffer(body)) {
          throw badRequest('Local upload expects a raw octet-stream body.');
        }
        await getStorage().writeObject(key, contentType, body);
        reply.code(204);
      }
    );

    // Public read for local-mode variants + originals — match the GCS
    // public layout so the dashboard can `<img src=publicUrl(key)>` in
    // both modes without branching.
    app.get<{ Params: { '*': string } }>(
      // Wildcard so the multi-segment key survives real-HTTP routing (find-my-way
      // decodes `%2F`, which breaks a single `:param`). Matches the real-slash
      // URL `LocalStorage.publicUrl` emits.
      '/v1/public/media/file/*',
      async (request, reply) => {
        const key = request.params['*'];
        try {
          const obj = await getStorage().readObject(key);
          // LocalStorage doesn't persist content-type, so derive it from the
          // file extension. A correct image/* type is REQUIRED: the dashboard
          // loads these cross-origin (3001 → 3100) in an <img>, and a missing/
          // octet-stream type trips the browser's Opaque Response Blocking
          // (ERR_BLOCKED_BY_ORB) — the asset uploads fine but never renders.
          reply.header('content-type', obj.contentType ?? contentTypeForKey(key));
          if (obj.size) reply.header('content-length', String(obj.size));
          reply.header('cache-control', 'public, max-age=3600');
          return reply.send(obj.body);
        } catch {
          throw notFound('Media file');
        }
      }
    );
  }
  return Promise.resolve();
};

// Wire shape — kept minimal because the asset detail endpoint
// (routes/v1/media/assets.ts) returns the full payload including
// variants + focal point.
function serializeUploadAsset(row: {
  id: string;
  key: string;
  originalFilename: string;
  mimeType: string;
  byteSize: bigint;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: row.id,
    key: row.key,
    original_filename: row.originalFilename,
    mime_type: row.mimeType,
    byte_size: row.byteSize.toString(),
    status: row.status,
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
  };
}

export default uploadRoutes;

// Re-export for ../assets.ts which uses the same shape on read.
export { serializeUploadAsset };
