// Single-use, short-TTL upload token for PUBLIC site-form file attachments
// (docs/115 Part D). The forms analogue of @wizeworks/media's upload-token — a distinct
// token TYPE so a form-upload URL can never be replayed as a media upload (or a
// session JWT), even though all three share the signing secret.
//
// Why a token at all: the "get an upload URL" step is PUBLIC (an anonymous visitor
// on a tenant site). The token is what lets the PUT endpoint trust the upload
// WITHOUT a session — it binds the exact storage {key}, the allowed {mime}, the
// {max} bytes, the owning {tid}, and a short {exp}, all HMAC-signed. Nothing the
// browser sends at PUT time is trusted beyond the bytes themselves (which are
// magic-sniffed against `mime`).
//
// Why not a GCS presigned-PUT URL (the textbook answer): the app SA has no
// serviceAccountTokenCreator on itself, so V4 signing throws under Workload
// Identity (see routes/v1/public/media.ts). So api-rest proxies the write, exactly
// like the media path.
//
// FORMAT (stable contract — verified by this same module):
//   token   = base64url(payloadJson) + "." + base64url(hmacSha256(secret, body))
//   payload = { typ:'form-upload', tid, uid, key, mime, max, name, exp }
// Signed with SPARX_INTERNAL_JWT_SECRET — the SAME secret api-mcp/api-rest/@wizeworks/media
// already share for internal-trust tokens (no new secret, no key distribution).

import { createHmac, timingSafeEqual } from 'node:crypto';

export interface FormUploadTokenClaims {
  /** Tenant id — the upload endpoint writes under this RLS/scoping context. */
  tid: string;
  /** Random upload id — the discriminator in both the staging and attached keys. */
  uid: string;
  /** Exact STAGING storage key the bytes land at (server-minted). */
  key: string;
  /** Declared mime the PUT body must match + be sniff-validated against. */
  mime: string;
  /** Max bytes the endpoint will accept for this upload. */
  max: number;
  /** Original filename (sanitized) — carried for display in the inbox/email. */
  name: string;
  /** Expiry, epoch seconds. */
  exp: number;
}

const TYP = 'form-upload';

function resolveSecret(secret?: string): string {
  const s = secret ?? process.env.SPARX_INTERNAL_JWT_SECRET;
  if (!s || s.length < 32) {
    throw new Error(
      'SPARX_INTERNAL_JWT_SECRET (>=32 chars) is required to sign/verify form-upload tokens.'
    );
  }
  return s;
}

function sign(body: string, secret: string): string {
  return createHmac('sha256', secret).update(body).digest().toString('base64url');
}

/** Mint a signed form-upload token. `secret` override is for tests. */
export function mintFormUploadToken(claims: FormUploadTokenClaims, secret?: string): string {
  const s = resolveSecret(secret);
  const body = Buffer.from(JSON.stringify({ typ: TYP, ...claims }), 'utf8').toString('base64url');
  return `${body}.${sign(body, s)}`;
}

export type FormUploadTokenResult =
  | { ok: true; claims: FormUploadTokenClaims }
  | { ok: false; reason: 'malformed' | 'bad-signature' | 'wrong-type' | 'expired' };

/**
 * Verify a token: signature (constant-time) → shape → `typ` → expiry. Returns a
 * discriminated result rather than throwing so the caller maps a failure to a
 * 401/403 without a try/catch. `now`/`secret` overrides are for tests.
 */
export function verifyFormUploadToken(
  token: string,
  opts?: { secret?: string; now?: number }
): FormUploadTokenResult {
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
    typeof p.tid !== 'string' ||
    typeof p.uid !== 'string' ||
    typeof p.key !== 'string' ||
    typeof p.mime !== 'string' ||
    typeof p.max !== 'number' ||
    typeof p.name !== 'string' ||
    typeof p.exp !== 'number'
  ) {
    return { ok: false, reason: 'malformed' };
  }

  const now = opts?.now ?? Math.floor(Date.now() / 1000);
  if (p.exp < now) return { ok: false, reason: 'expired' };

  return {
    ok: true,
    claims: {
      tid: p.tid,
      uid: p.uid,
      key: p.key,
      mime: p.mime,
      max: p.max,
      name: p.name,
      exp: p.exp,
    },
  };
}
