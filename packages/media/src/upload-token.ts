// Single-use, short-TTL upload token for the PROXIED media-upload side channel.
//
// Why this exists: a public MCP tool can't carry image BYTES. An LLM re-emitting
// a large base64 blob as tool-call text corrupts it (a single drifted char =
// "bad Huffman code"), and the JSON-RPC envelope is body-capped anyway. So a real
// upload is two-phase: `create_image_upload` (asset-service.ts) mints one of
// these tokens + returns an uploadUrl, and the caller PUTs the raw bytes to
// api-rest's `PUT /v1/public/media/upload/:id` OUT OF BAND (curl, fetch, browser).
// The bytes never pass through the model. This token is what makes that PUBLIC,
// unauthenticated-at-the-transport endpoint safe.
//
// We can't hand out a GCS presigned-PUT URL instead (the "textbook" answer):
// the app SA has no serviceAccountTokenCreator on itself, so V4 signing throws
// under Workload Identity (see services/api-rest/src/routes/v1/public/media.ts).
// api-rest receives the bytes with its objectAdmin grant and writes them.
//
// FORMAT (stable contract — api-rest verifies via this same module):
//   token   = base64url(payloadJson) + "." + base64url(hmacSha256(secret, body))
//   payload = { typ:'media-upload', aid, tid, key, mime, max, exp }
// Signed with SPARX_INTERNAL_JWT_SECRET — the SAME secret api-mcp and api-rest
// already share for internal-trust JWTs (no new secret, no key distribution).
// The mandatory `typ` claim means an upload token can never be replayed as — or
// confused with — a session JWT even though they share a signing key.

import { createHmac, timingSafeEqual } from 'node:crypto';

export interface UploadTokenClaims {
  /** MediaAsset id the bytes are for. */
  aid: string;
  /** Tenant id — the upload endpoint loads the asset under this RLS context. */
  tid: string;
  /** Exact storage key the bytes land at (server-minted `originalKey`). */
  key: string;
  /** Declared image mime the PUT body must match + be sniff-validated against. */
  mime: string;
  /** Max bytes the endpoint will accept for this upload. */
  max: number;
  /** Expiry, epoch seconds. */
  exp: number;
}

const TYP = 'media-upload';

function resolveSecret(secret?: string): string {
  const s = secret ?? process.env.SPARX_INTERNAL_JWT_SECRET;
  if (!s || s.length < 32) {
    throw new Error(
      'SPARX_INTERNAL_JWT_SECRET (>=32 chars) is required to sign/verify media-upload tokens.'
    );
  }
  return s;
}

function sign(body: string, secret: string): string {
  return createHmac('sha256', secret).update(body).digest().toString('base64url');
}

/** Mint a signed upload token. `secret` override is for tests. */
export function mintUploadToken(claims: UploadTokenClaims, secret?: string): string {
  const s = resolveSecret(secret);
  const body = Buffer.from(JSON.stringify({ typ: TYP, ...claims }), 'utf8').toString('base64url');
  return `${body}.${sign(body, s)}`;
}

export type UploadTokenResult =
  | { ok: true; claims: UploadTokenClaims }
  | { ok: false; reason: 'malformed' | 'bad-signature' | 'wrong-type' | 'expired' };

/**
 * Verify a token: signature (constant-time) → shape → `typ` → expiry. Returns a
 * discriminated result rather than throwing so the caller maps a failure to a
 * 401/403 without a try/catch. `now`/`secret` overrides are for tests.
 */
export function verifyUploadToken(
  token: string,
  opts?: { secret?: string; now?: number }
): UploadTokenResult {
  const s = resolveSecret(opts?.secret);
  const dot = token.indexOf('.');
  if (dot <= 0 || dot >= token.length - 1) return { ok: false, reason: 'malformed' };
  const body = token.slice(0, dot);
  const sig = token.slice(dot + 1);

  // Constant-time signature check. Compare as bytes; a length mismatch (or a
  // non-base64url signature) is just a bad signature, never a throw.
  const expected = Buffer.from(sign(body, s));
  const provided = Buffer.from(sig);
  if (expected.length !== provided.length || !timingSafeEqual(expected, provided)) {
    return { ok: false, reason: 'bad-signature' };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
  } catch {
    return { ok: false, reason: 'malformed' };
  }
  const p = parsed as Record<string, unknown>;
  if (p.typ !== TYP) return { ok: false, reason: 'wrong-type' };
  if (
    typeof p.aid !== 'string' ||
    typeof p.tid !== 'string' ||
    typeof p.key !== 'string' ||
    typeof p.mime !== 'string' ||
    typeof p.max !== 'number' ||
    typeof p.exp !== 'number'
  ) {
    return { ok: false, reason: 'malformed' };
  }

  const now = opts?.now ?? Math.floor(Date.now() / 1000);
  if (p.exp < now) return { ok: false, reason: 'expired' };

  return {
    ok: true,
    claims: { aid: p.aid, tid: p.tid, key: p.key, mime: p.mime, max: p.max, exp: p.exp },
  };
}
