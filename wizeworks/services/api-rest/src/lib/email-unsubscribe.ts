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

/**
 * `base64url(tenantId:email)[~base64url(broadcastId)].hmac`: opaque, tamper-evident,
 * self-describing.
 *
 * The campaign rides in the signed part when the link is in a campaign, so an
 * unsubscribe can be counted against the campaign it came from: our own link wrote
 * the do-not-email row and nothing else, and every campaign's "Unsubscribed" read 0
 * however many readers left (piggles persona issue 985). Signed, so nobody can pin
 * their unsubscribe on a campaign they never got. `~` is not a base64url character,
 * and a token without it is the older form, which still verifies.
 */
export function signUnsubscribeToken(
  tenantId: string,
  email: string,
  broadcastId?: string | null
): string {
  const who = Buffer.from(`${tenantId}:${email.toLowerCase()}`).toString('base64url');
  const data = broadcastId ? `${who}~${Buffer.from(broadcastId).toString('base64url')}` : who;
  return `${data}.${hmac(data)}`;
}

/** Verify + decode a token. Null on any tampering / malformed input. */
export function verifyUnsubscribeToken(
  token: string
): { tenantId: string; email: string; broadcastId: string | null } | null {
  const dot = token.lastIndexOf('.');
  if (dot <= 0) return null;
  const data = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = hmac(data);
  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) return null;
  const [who = '', campaign] = data.split('~');
  const payload = Buffer.from(who, 'base64url').toString('utf8');
  const idx = payload.indexOf(':');
  if (idx === -1) return null;
  const tenantId = payload.slice(0, idx);
  const email = payload.slice(idx + 1);
  if (!tenantId || !email) return null;
  const broadcastId = campaign ? Buffer.from(campaign, 'base64url').toString('utf8') : '';
  return { tenantId, email, broadcastId: broadcastId || null };
}

/** The absolute one-click unsubscribe URL the renderer + header use. */
export function unsubscribeUrl(
  tenantId: string,
  email: string,
  broadcastId?: string | null
): string {
  const token = signUnsubscribeToken(tenantId, email, broadcastId);
  return `${API_BASE}/v1/public/email/unsubscribe?token=${encodeURIComponent(token)}`;
}

/** The headers that put a mail app's own Unsubscribe button beside the sender
 *  (RFC 2369 + RFC 8058 one-click). */
export function unsubscribeHeaders(url: string): Record<string, string> {
  return {
    'List-Unsubscribe': `<${url}>`,
    'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
  };
}

/**
 * A campaign drawn once for every reader, given THIS reader's unsubscribe link: the
 * placeholder swapped in the HTML and the text, and the headers to send with it.
 * Unchanged, with no headers, when the body carries no placeholder.
 */
export function personalizeUnsubscribe(
  body: { html: string; text: string },
  placeholder: string,
  url: string
): { html: string; text: string; headers?: Record<string, string> } {
  if (!body.html.includes(placeholder) && !body.text.includes(placeholder)) return body;
  return {
    html: body.html.split(placeholder).join(url),
    text: body.text.split(placeholder).join(url),
    headers: unsubscribeHeaders(url),
  };
}
