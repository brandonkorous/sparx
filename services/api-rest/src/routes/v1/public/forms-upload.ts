// Public site-form file uploads (docs/115 Part D) — the two-phase, proxied upload
// that lets an anonymous visitor attach a file (resume / RFQ / spec sheet) to a
// Builder Form. Mirrors the media upload path (routes/v1/public/media-upload.ts):
//
//   POST /v1/public/forms/upload-url ?tenant=<slug>[&property=<slug>]
//     Gate: a live Form must exist at (page, formNodeId) — same check the submit
//     endpoint uses, so you can't mint upload URLs against a tenant with no form.
//     Validates the declared mime (allowlist) + size (cap), mints a signed token
//     bound to a server-minted STAGING key, and returns it. Rate-limited.
//
//   PUT  /v1/public/forms/upload/:id ?token=<t>   (the token IS the auth)
//     Verifies the token (constant-time), the id, the size, and MAGIC-SNIFFS the
//     actual bytes against the token's declared mime (a spoofed content-type or a
//     non-allowed payload is rejected). Single-use. Writes to the PRIVATE bucket.
//
// SECURITY — both endpoints are public, so every guard lives here:
//   · form-must-exist — an upload URL can't be minted for a non-existent form.
//   · allowlist + cap — declared mime ∈ FORM_ATTACHMENT_MIME, size ≤ cap.
//   · token — HMAC-signed, typ-scoped, short-TTL, bound to {tid,uid,key,mime,max}.
//   · sniff — the first bytes must match the DECLARED type (never the request
//     content-type, which a client controls).
//   · single-use — refused once the staging object already exists.
//   · private — the object lands in the private bucket; there is NO public URL.
//     Staff download it later through an authenticated, RLS-scoped route.
//   · orphan GC — an uploaded-but-never-submitted object sits in the lifecycle-
//     GC'd `form-uploads/staging/` prefix and is auto-deleted (bucket lifecycle).

import type { FastifyPluginAsync, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import { prisma, withTenant } from '@sparx/db';
import { ok } from '@sparx/api-core/envelope';
import { badRequest, conflict, forbidden, notFound, unauthorized } from '@sparx/api-core/errors';
import { formService } from '@sparx/builder';
import {
  FORM_ATTACHMENT_MIME,
  MAX_FORM_ATTACHMENT_BYTES,
  isAllowedAttachmentMime,
} from '@sparx/builder-schemas';
import { getStorage, formUploadStagingKey, sanitizeFilename } from '../../../lib/storage.js';
import { mintFormUploadToken, verifyFormUploadToken } from '../../../lib/form-upload-token.js';

// Token lifetime — long enough to cover upload + filling out the rest of the form +
// submit (the submit endpoint re-verifies the same token to trust the key/name/mime),
// short enough that a leaked URL is useless within the hour.
const UPLOAD_TOKEN_TTL_SEC = 60 * 60;

// Hard parser ceiling — the token's own `max` (≤ the cap) is the real per-upload
// bound; this is the backstop so a missing/oversized token can't buffer unbounded.
const HARD_MAX_BYTES = MAX_FORM_ATTACHMENT_BYTES;

const UrlQuery = z.object({
  tenant: z.string().min(1).max(63),
  property: z.string().min(1).max(63).optional(),
});

const UrlBody = z.object({
  formNodeId: z.string().min(1).max(255),
  pageSlug: z.string().max(255).nullish(),
  filename: z.string().min(1).max(255),
  mimeType: z.string().min(1).max(255),
  byteSize: z.number().int().positive().max(MAX_FORM_ATTACHMENT_BYTES),
});

const PutParams = z.object({ id: z.string().uuid() });
const PutQuery = z.object({ token: z.string().min(1).max(4096) });

// ── Magic-byte sniff — do the actual bytes look like the DECLARED type? ────────
// The signed token carries the mime (from our allowlist); we validate against that,
// not the request content-type.

/** ZIP local-file-header magic (OOXML docs are ZIP containers). */
function looksLikeZip(b: Buffer): boolean {
  return (
    b.length >= 4 &&
    b[0] === 0x50 &&
    b[1] === 0x4b &&
    ((b[2] === 0x03 && b[3] === 0x04) ||
      (b[2] === 0x05 && b[3] === 0x06) ||
      (b[2] === 0x07 && b[3] === 0x08))
  );
}

/** The buffer contains a ZIP entry name marker (filenames sit in the local headers
 *  + central directory as raw bytes). Bounded scan — the body is ≤ 10 MB. */
function hasZipMarker(b: Buffer, marker: string): boolean {
  return b.includes(Buffer.from(marker, 'latin1'));
}

function bytesMatchMime(b: Buffer, mime: string): boolean {
  switch (mime) {
    case 'application/pdf':
      return b.length >= 5 && b.toString('latin1', 0, 5) === '%PDF-';
    case 'image/png':
      return (
        b.length >= 8 &&
        b[0] === 0x89 &&
        b[1] === 0x50 &&
        b[2] === 0x4e &&
        b[3] === 0x47 &&
        b[4] === 0x0d &&
        b[5] === 0x0a &&
        b[6] === 0x1a &&
        b[7] === 0x0a
      );
    case 'image/jpeg':
      return b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;
    case 'image/gif':
      return b.length >= 6 && /^GIF8[79]a$/.test(b.toString('latin1', 0, 6));
    case 'image/webp':
      return (
        b.length >= 12 &&
        b.toString('latin1', 0, 4) === 'RIFF' &&
        b.toString('latin1', 8, 12) === 'WEBP'
      );
    // OOXML: a ZIP whose entries include the OOXML content-types part plus the
    // format-specific folder (`word/` for .docx, `xl/` for .xlsx). This rejects a
    // plain ZIP or a renamed archive while accepting a genuine Office document.
    case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
      return looksLikeZip(b) && hasZipMarker(b, '[Content_Types].xml') && hasZipMarker(b, 'word/');
    case 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':
      return looksLikeZip(b) && hasZipMarker(b, '[Content_Types].xml') && hasZipMarker(b, 'xl/');
    default:
      return false;
  }
}

/** Resolve tenant (slug → id, non-RLS dispatch) + the target site (named or primary,
 *  under RLS) + confirm a live Form exists at (page, formNodeId). Throws notFound
 *  on any miss — an upload URL is never minted for a form that isn't there. */
async function resolveForm(
  request: FastifyRequest,
  q: z.infer<typeof UrlQuery>,
  formNodeId: string,
  pageSlugRaw: string | null | undefined
): Promise<{ tenantId: string }> {
  const tenant = await prisma.tenant.findUnique({
    where: { slug: q.tenant },
    select: { id: true },
  });
  if (!tenant) throw notFound('Tenant', q.tenant);
  const tenantId = tenant.id;

  const property = await withTenant({ tenantId }, (tx) =>
    q.property
      ? tx.property.findFirst({ where: { tenantId, slug: q.property }, select: { id: true } })
      : tx.property.findFirst({ where: { tenantId, isPrimary: true }, select: { id: true } })
  );
  if (!property) throw notFound('Site', q.property ?? 'primary');

  const pageSlug = pageSlugRaw && pageSlugRaw !== '' ? pageSlugRaw : null;
  const form = await formService.resolveContactForm(
    { tenantId, propertyId: property.id },
    { pageSlug, formNodeId }
  );
  if (!form) throw notFound('Form', formNodeId);
  return { tenantId };
}

const publicFormsUploadRoutes: FastifyPluginAsync = async (app) => {
  // ── Phase 1: mint an upload URL ────────────────────────────────────────────
  app.post(
    '/v1/public/forms/upload-url',
    { config: { rateLimit: { max: 20, timeWindow: '1 minute' } } },
    async (request) => {
      const q = UrlQuery.parse(request.query);
      const body = UrlBody.parse(request.body);

      if (!isAllowedAttachmentMime(body.mimeType)) {
        throw badRequest(
          `Files of type "${body.mimeType}" aren't allowed. Accepted: ${Object.keys(
            FORM_ATTACHMENT_MIME
          )
            .map((m) => FORM_ATTACHMENT_MIME[m])
            .join(', ')}.`
        );
      }

      const { tenantId } = await resolveForm(request, q, body.formNodeId, body.pageSlug);

      const uploadId = randomUUID();
      const name = sanitizeFilename(body.filename);
      const key = formUploadStagingKey(tenantId, uploadId, name);
      const exp = Math.floor(Date.now() / 1000) + UPLOAD_TOKEN_TTL_SEC;
      const token = mintFormUploadToken({
        tid: tenantId,
        uid: uploadId,
        key,
        mime: body.mimeType,
        max: body.byteSize,
        name,
        exp,
      });

      // The client PUTs the bytes to the same-origin proxy path and keeps the token
      // to hand back at submit. No absolute URL — the storefront composes the
      // proxied path off its own API base (mirrors the submit call).
      return ok({
        uploadId,
        token,
        maxBytes: body.byteSize,
        expiresAt: new Date(exp * 1000).toISOString(),
      });
    }
  );

  // ── Phase 2: receive the bytes ─────────────────────────────────────────────
  // Encapsulated child register so the raw-body `*` parser applies ONLY to the PUT
  // and never touches the JSON POST above.
  // eslint-disable-next-line @typescript-eslint/require-await -- Fastify encapsulated plugin; registration is synchronous
  await app.register(async (raw) => {
    raw.addContentTypeParser(
      '*',
      { parseAs: 'buffer', bodyLimit: HARD_MAX_BYTES },
      (_req, body, done) => done(null, body)
    );

    raw.put(
      '/v1/public/forms/upload/:id',
      { config: { rateLimit: { max: 20, timeWindow: '1 minute' } } },
      async (request, reply) => {
        const { id } = PutParams.parse(request.params);
        const { token } = PutQuery.parse(request.query);

        const verified = verifyFormUploadToken(token);
        if (!verified.ok) {
          request.log.warn({ id, reason: verified.reason }, 'form upload: token rejected');
          throw unauthorized('Invalid or expired upload token.');
        }
        const claims = verified.claims;
        if (claims.uid !== id) throw forbidden('Upload token does not match this upload.');

        const bodyBuf = request.body;
        if (!Buffer.isBuffer(bodyBuf) || bodyBuf.length === 0) {
          throw badRequest('Empty upload body.');
        }
        if (bodyBuf.length > claims.max) {
          throw badRequest(
            `File is ${bodyBuf.length} bytes; this upload was authorised for ${claims.max}.`
          );
        }
        if (!bytesMatchMime(bodyBuf, claims.mime)) {
          throw badRequest(`Uploaded bytes are not a valid ${claims.mime}.`);
        }

        const storage = getStorage();
        // Single-use: refuse if the staging object already landed (a leaked URL
        // can't overwrite it within the token window). readObject throws when
        // absent; if it resolves, drain + reject.
        const existing = await storage.readObject(claims.key).catch(() => null);
        if (existing) {
          existing.body.destroy();
          throw conflict('This upload URL has already been used.');
        }

        await storage.writeObject(claims.key, claims.mime, bodyBuf);

        return reply.send(ok({ uploadId: claims.uid, bytes: bodyBuf.length }));
      }
    );
  });
};

export default publicFormsUploadRoutes;
