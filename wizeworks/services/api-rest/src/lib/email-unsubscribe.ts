// One-click unsubscribe links for marketing email (docs/91 §8, CAN-SPAM / CASL).
//
// A marketing send's `unsubscribe_link` node + its `List-Unsubscribe` header point
// at GET/POST /v1/public/email/unsubscribe?token=… . The token is an HMAC-signed
// (tenantId, email) pair so the link is unguessable and needs no DB lookup or
// session — clicking it suppresses that address for the `marketing` scope, which is
// exactly what `enqueueSend` checks before every marketing send. Pairs with the
// existing Mailgun `unsubscribed` webhook (both write EmailSuppression).

import crypto from 'node:crypto';

// A dedicated secret; falls back to the shared internal secret, then a dev default
// (links only resolve within one deployment, so a rotated secret simply invalidates
// outstanding links — acceptable for an unsubscribe action).
const SECRET =
  process.env.SPARX_EMAIL_UNSUBSCRIBE_SECRET ??
  process.env.SPARX_INTERNAL_SHARED_SECRET ??
  'dev-unsubscribe-secret';

const API_BASE =
  process.env.SPARX_PUBLIC_API_REST_URL ??
  process.env.SPARX_API_REST_URL ??
  'http://localhost:3100';

function hmac(data: string): string {
  return crypto.createHmac('sha256', SECRET).update(data).digest('base64url');
}

/** `base64url(tenantId:email).hmac` — opaque, tamper-evident, self-describing. */
export function signUnsubscribeToken(tenantId: string, email: string): string {
  const data = Buffer.from(`${tenantId}:${email.toLowerCase()}`).toString('base64url');
  return `${data}.${hmac(data)}`;
}

/** Verify + decode a token. Null on any tampering / malformed input. */
export function verifyUnsubscribeToken(token: string): { tenantId: string; email: string } | null {
  const dot = token.lastIndexOf('.');
  if (dot <= 0) return null;
  const data = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = hmac(data);
  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) return null;
  const payload = Buffer.from(data, 'base64url').toString('utf8');
  const idx = payload.indexOf(':');
  if (idx === -1) return null;
  const tenantId = payload.slice(0, idx);
  const email = payload.slice(idx + 1);
  if (!tenantId || !email) return null;
  return { tenantId, email };
}

/** The absolute one-click unsubscribe URL the renderer + header use. */
export function unsubscribeUrl(tenantId: string, email: string): string {
  const token = signUnsubscribeToken(tenantId, email);
  return `${API_BASE}/v1/public/email/unsubscribe?token=${encodeURIComponent(token)}`;
}
