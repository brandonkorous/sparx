// Signed, expiring DOWNLOAD token for gated content (docs/151 §7, docs/152 C4).
//
// The mirror image of `form-upload-token`: that one lets an anonymous visitor
// PUT bytes we have not seen yet, this one lets a named visitor GET bytes we
// already hold. Same secret, same format, and a DISTINCT `typ` so a delivery
// link can never be replayed as an upload URL (or the reverse) even though both
// are signed with `SPARX_INTERNAL_JWT_SECRET`.
//
// ── WHY A TOKEN RATHER THAN A PUBLIC URL ─────────────────────────────────────
//
// "Give us your email and we will send you the guide" is only an exchange if the
// guide is actually behind the email. A public bucket URL is one forward of a
// link away from being on a forum, at which point every future visitor has the
// thing without ever becoming a lead, and the tenant is paying to host it for
// them. The asset stays in the PRIVATE bucket and api-rest streams it, exactly
// as it already does for form attachments.
//
// ── AND WHY IT EXPIRES ───────────────────────────────────────────────────────
//
// A link that never expires is a public URL that takes one extra step to
// discover. Seven days is long enough that somebody who saves the email for the
// weekend still gets their download, and short enough that a link pasted into a
// public channel stops working before it can circulate. Asking again is cheap —
// the form is still on the site.
//
// FORMAT (stable contract — verified by this same module):
//   token   = base64url(payloadJson) + "." + base64url(hmacSha256(secret, body))
//   payload = { typ:'gated-delivery', tid, key, name, mime, sub, exp }

import { createHmac, timingSafeEqual } from 'node:crypto';

export interface GatedDeliveryClaims {
  /** Tenant id — the download is served under this scoping context. */
  tid: string;
  /** Exact storage key of the asset. Server-minted; never from a request. */
  key: string;
  /** Filename the browser saves it as. */
  name: string;
  /** Content type to serve it with. */
  mime: string;
  /**
   * Who it was issued to, lowercased.
   *
   * Carried so a tenant can answer "who did we send this to" from the link
   * itself, and so a forwarded link is at least attributable. It is deliberately
   * NOT checked at download time: the person who asked may open it on a phone
   * that is not signed in to anything, and refusing them their own download to
   * stop a hypothetical forward would break the common case to slightly
   * inconvenience the rare one.
   */
  sub: string;
  /** Expiry, epoch seconds. */
  exp: number;
}

const TYP = 'gated-delivery';

/** How long a delivery link lives. See the note at the top of this file. */
export const GATED_DELIVERY_TTL_SECONDS = 7 * 24 * 60 * 60;

function resolveSecret(secret?: string): string {
  const s = secret ?? process.env.SPARX_INTERNAL_JWT_SECRET;
  if (!s || s.length < 32) {
    throw new Error(
      'SPARX_INTERNAL_JWT_SECRET (>=32 chars) is required to sign/verify gated-delivery tokens.'
    );
  }
  return s;
}

function sign(body: string, secret: string): string {
  return createHmac('sha256', secret).update(body).digest().toString('base64url');
}

/** Mint a signed delivery token. `secret` override is for tests. */
export function mintGatedDeliveryToken(claims: GatedDeliveryClaims, secret?: string): string {
  const s = resolveSecret(secret);
  const body = Buffer.from(JSON.stringify({ typ: TYP, ...claims }), 'utf8').toString('base64url');
  return `${body}.${sign(body, s)}`;
}

export type GatedDeliveryResult =
  | { ok: true; claims: GatedDeliveryClaims }
  | { ok: false; reason: 'malformed' | 'bad-signature' | 'wrong-type' | 'expired' };

/**
 * Verify a token: signature (constant-time) → shape → `typ` → expiry.
 *
 * Returns a discriminated result rather than throwing, so the caller maps a
 * failure to the right status without a try/catch — and so `expired` can be told
 * apart from `bad-signature`, which matters: one deserves "that link has run
 * out, here is the form again" and the other deserves nothing at all.
 */
export function verifyGatedDeliveryToken(
  token: string,
  opts?: { secret?: string; now?: number }
): GatedDeliveryResult {
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
    typeof p.key !== 'string' ||
    typeof p.name !== 'string' ||
    typeof p.mime !== 'string' ||
    typeof p.sub !== 'string' ||
    typeof p.exp !== 'number'
  ) {
    return { ok: false, reason: 'malformed' };
  }

  const now = opts?.now ?? Math.floor(Date.now() / 1000);
  if (p.exp < now) return { ok: false, reason: 'expired' };

  return {
    ok: true,
    claims: { tid: p.tid, key: p.key, name: p.name, mime: p.mime, sub: p.sub, exp: p.exp },
  };
}
