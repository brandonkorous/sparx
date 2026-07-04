// Proxied media upload — the "PUT the bytes" half of the two-phase MCP upload.
//
//   PUT /v1/public/media/upload/:id?token=<t>   (public; the token IS the auth)
//
// packages/media `create_image_upload` mints a signed token + this uploadUrl;
// the caller PUTs the raw image bytes here (curl/fetch/browser) out of band, so
// the bytes never ride the MCP JSON-RPC envelope (an LLM can't re-emit a large
// base64 blob losslessly — it corrupts). api-rest receives the bytes and writes
// them to GCS with its objectAdmin grant, then fans out `media.uploaded` so the
// worker transcodes — exactly the create_image_asset_from_bytes contract, but
// with the bytes arriving over HTTP instead of inside a tool call.
//
// Why not a GCS presigned-PUT URL (the textbook answer)? The app SA has no
// serviceAccountTokenCreator on itself, so V4 signing throws under Workload
// Identity (see public/media.ts). So api-rest proxies the write.
//
// SECURITY — the endpoint is public, so every guard lives here:
//   · token — HMAC-signed (SPARX_INTERNAL_JWT_SECRET), typ-scoped, short-TTL,
//     bound to {assetId, tenantId, key, mime, maxBytes}. Verified constant-time.
//   · id match — the URL :id must equal the token's asset id.
//   · size — body capped at the token's max (and a hard parser ceiling).
//   · content — the actual first bytes are magic-sniffed against the declared
//     mime; a spoofed content-type or a non-image payload is rejected. (This is
//     validation NEITHER the dashboard presign flow nor the inline upload does.)
//   · single-use — refused once the asset has left 'uploading' OR the original
//     object already exists; a leaked URL can't overwrite a live image.
//   · no signing, no SSRF — the client pushes bytes; the server never fetches.

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { withTenant } from '@sparx/db';
import { verifyUploadToken } from '@sparx/media/upload-token';
import { ok } from '@sparx/api-core/envelope';
import { publish } from '@sparx/api-core/pubsub';
import { badRequest, conflict, forbidden, notFound, unauthorized } from '@sparx/api-core/errors';
import { getStorage } from '../../../lib/storage.js';

// Hard parser ceiling — mirrors @sparx/media MAX_PROXIED_UPLOAD_BYTES. The
// token's own `max` (the caller's declared size) is the real per-upload bound;
// this is just a backstop so a missing/oversized token can't buffer unbounded.
const HARD_MAX_BYTES = 20 * 1024 * 1024;

const Params = z.object({ id: z.string().uuid() });
const Query = z.object({ token: z.string().min(1).max(4096) });

// Magic-byte check: do the actual bytes look like the DECLARED image type? The
// signed token carries the mime (from our allowlist), so we validate against
// that, not the request content-type (which a client controls).
function bytesMatchImageMime(b: Buffer, mime: string): boolean {
  switch (mime) {
    case 'image/jpeg':
      return b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;
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
    case 'image/gif':
      return b.length >= 6 && /^GIF8[79]a$/.test(b.toString('latin1', 0, 6));
    case 'image/webp':
      return (
        b.length >= 12 &&
        b.toString('latin1', 0, 4) === 'RIFF' &&
        b.toString('latin1', 8, 12) === 'WEBP'
      );
    case 'image/avif': {
      // ISO-BMFF: a 'ftyp' box near the head whose brands include an AVIF brand.
      if (b.length < 12 || b.toString('latin1', 4, 8) !== 'ftyp') return false;
      return /avif|avis|mif1|msf1/.test(b.toString('latin1', 8, Math.min(b.length, 64)));
    }
    case 'image/svg+xml': {
      // Text/XML — no binary magic. Accept only if the head parses as an XML/SVG
      // document opener (a binary or HTML payload effectively never leads with
      // these). It is served cross-origin via <img> (inert), but still sniffed so
      // a non-image can't masquerade as one.
      const head = b.toString('utf8', 0, Math.min(b.length, 512)).trimStart();
      return /^<\?xml[\s>]/i.test(head) || /^<svg[\s>]/i.test(head);
    }
    default:
      return false;
  }
}

const publicMediaUploadRoutes: FastifyPluginAsync = async (app) => {
  // Accept a raw binary body of ANY content-type (encapsulated to this plugin),
  // buffered with the hard ceiling. We validate the true type by sniffing bytes,
  // so we don't trust — or require a specific — request content-type here.
  app.addContentTypeParser(
    '*',
    { parseAs: 'buffer', bodyLimit: HARD_MAX_BYTES },
    (_req, body, done) => done(null, body)
  );

  app.put('/v1/public/media/upload/:id', async (request, reply) => {
    const { id } = Params.parse(request.params);
    const { token } = Query.parse(request.query);

    const verified = verifyUploadToken(token);
    if (!verified.ok) {
      request.log.warn({ id, reason: verified.reason }, 'media upload: token rejected');
      throw unauthorized('Invalid or expired upload token.');
    }
    const claims = verified.claims;
    if (claims.aid !== id) throw forbidden('Upload token does not match this asset.');

    const body = request.body;
    if (!Buffer.isBuffer(body) || body.length === 0) throw badRequest('Empty upload body.');
    if (body.length > claims.max) {
      throw badRequest(
        `Body is ${body.length} bytes; this upload was authorised for ${claims.max}.`
      );
    }
    if (!bytesMatchImageMime(body, claims.mime)) {
      throw badRequest(`Uploaded bytes are not a valid ${claims.mime}.`);
    }

    const storage = getStorage();

    // Load under the token's tenant (RLS) to confirm the asset still exists, is
    // still awaiting bytes, and its key matches the signed key (defence in depth).
    const asset = await withTenant({ tenantId: claims.tid }, (tx) =>
      tx.mediaAsset.findFirst({
        where: { id: claims.aid, deletedAt: null },
        select: { key: true, status: true },
      })
    );
    if (!asset) throw notFound('MediaAsset', claims.aid);
    if (asset.key !== claims.key) throw forbidden('Upload token key mismatch.');
    if (asset.status !== 'uploading')
      throw conflict(`Asset ${claims.aid} is already ${asset.status}.`);

    // Single-use: refuse if the original already landed (a leaked URL can't
    // overwrite a live image within the token window). readObject throws when the
    // object is absent; if it resolves, the object exists — drain + reject.
    const existing = await storage.readObject(claims.key).catch(() => null);
    if (existing) {
      existing.body.destroy();
      throw conflict('This upload URL has already been used.');
    }

    await storage.writeObject(claims.key, claims.mime, body);

    // Fan out media.uploaded so the worker transcodes. Actor is null — the write
    // is authorised by the signed token, not a staff session.
    await publish(request.log, 'media.uploaded', claims.tid, null, {
      assetId: claims.aid,
      key: claims.key,
      mimeType: claims.mime,
      byteSize: String(body.length),
    });

    return reply.send(ok({ assetId: claims.aid, status: 'uploading', bytes: body.length }));
  });
};

export default publicMediaUploadRoutes;
