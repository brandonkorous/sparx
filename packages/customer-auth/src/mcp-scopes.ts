// Shopper MCP OAuth scope vocabulary + consent-grant crypto (docs/113 §5, docs/27 §6).
//
// The SINGLE source of truth for the scopes a returning-customer MCP connection
// can carry. Better Auth's mcp() plugin always adds openid/profile/email/
// offline_access framing scopes; these are the sparx-specific *capability*
// scopes a shopper grants their own LLM client. The customer instance's
// oidcConfig advertises exactly these (server.ts), the store-branded consent
// page renders them as the scope picker, and api-rest gates each customer-tier
// public route on them (lib/customer-session.ts).
//
// Mirrors the operator vocabulary (@sparx/auth/mcp-scopes) but for the customer
// tier: no bulk/destructive scopes, no role capping (a shopper is the sole
// principal — they grant their own account's scopes), a much smaller surface.
//
// Two pure concerns live here (no Better Auth / DB imports, so server.ts can use
// them without an import cycle):
//   1. the scope catalog, and
//   2. the signed consent-grant token proving the store-branded consent page
//      approved a specific (client, redirect, scope, user) before Better Auth's
//      /mcp/authorize is allowed to mint a code.

import crypto from 'node:crypto';

/** OIDC framing scopes — always granted, never user-toggled. `offline_access` is
 *  what makes Better Auth return a refresh token. */
export const CUSTOMER_OIDC_BASE_SCOPES = ['openid', 'offline_access'] as const;

/** The shopper capability scopes. Each maps to one or more customer-tier tools
 *  and is enforced on the backing public route. Keep in lockstep with the
 *  site-MCP `customer`-tier tool catalog. */
export const CUSTOMER_MCP_SCOPES = [
  'account:read', // profile, saved addresses, wishlist (read)
  'account:write', // update profile, manage addresses + wishlist
  'orders:read', // order history + order detail
  'bookings:read', // my appointments
  'bookings:write', // book / reschedule / cancel my appointments
  'requests:read', // my support requests + where each one stands
  'requests:write', // raise a request / add to one I already raised
  'b2b:read', // B2B portal: my companies, invoices, quotes, orders
] as const;

export type CustomerMcpScope = (typeof CUSTOMER_MCP_SCOPES)[number];

export interface CustomerScopeMeta {
  scope: CustomerMcpScope;
  kind: 'read' | 'write';
  label: string;
  description: string;
}

/** Consent-page catalog: ordered, human-readable. Rendered by the store-branded
 *  consent screen (apps/site) with a checkbox per entry. */
export const CUSTOMER_MCP_SCOPE_CATALOG: readonly CustomerScopeMeta[] = [
  {
    scope: 'account:read',
    kind: 'read',
    label: 'View your account',
    description: 'See your profile, saved addresses, and wishlist.',
  },
  {
    scope: 'account:write',
    kind: 'write',
    label: 'Manage your account',
    description: 'Update your profile and manage saved addresses + wishlist.',
  },
  {
    scope: 'orders:read',
    kind: 'read',
    label: 'View your orders',
    description: 'See your order history and order details.',
  },
  {
    scope: 'bookings:read',
    kind: 'read',
    label: 'View your appointments',
    description: 'See your upcoming and past bookings.',
  },
  {
    scope: 'bookings:write',
    kind: 'write',
    label: 'Manage your appointments',
    description: 'Book, reschedule, and cancel your appointments.',
  },
  {
    scope: 'requests:read',
    kind: 'read',
    label: 'View your support requests',
    description: 'See the requests you have raised and where each one stands.',
  },
  {
    scope: 'requests:write',
    kind: 'write',
    label: 'Raise support requests',
    description: 'Ask for help and add to a request you have already raised.',
  },
  {
    scope: 'b2b:read',
    kind: 'read',
    label: 'View your business account',
    description: 'See your company invoices, quotes, and order history.',
  },
] as const;

/** Everything the OAuth provider advertises + allows (authorize rejects any
 *  requested scope outside this set). OIDC framing scopes first. */
export const CUSTOMER_ALL_OAUTH_SCOPES: readonly string[] = [
  ...CUSTOMER_OIDC_BASE_SCOPES,
  ...CUSTOMER_MCP_SCOPES,
];

const KNOWN_BUSINESS = new Set<string>(CUSTOMER_MCP_SCOPES);

/** Intersect a requested/selected scope list with the known shopper vocabulary,
 *  dropping unknowns + framing scopes and de-duping. Returns ONLY business scopes
 *  (OIDC framing is added separately at authorize time). Unlike the operator flow
 *  there is no role cap — a shopper is the sole owner of their account, so any
 *  business scope they pick is grantable. */
export function capCustomerScopes(requested: string[]): CustomerMcpScope[] {
  const seen = new Set<string>();
  const out: CustomerMcpScope[] = [];
  for (const s of requested) {
    if (KNOWN_BUSINESS.has(s) && !seen.has(s)) {
      seen.add(s);
      out.push(s as CustomerMcpScope);
    }
  }
  return out;
}

// ─── Consent-grant token ────────────────────────────────────────────────────
//
// A short-lived, session-bound HMAC proving the store-branded consent page
// approved a specific authorization. Passed as the `sparx_grant` query param
// when the approve step redirects the browser to Better Auth's /mcp/authorize;
// the server.ts `before` hook verifies it and refuses to mint a code without it
// — closing the "hit /mcp/authorize directly and skip consent" confused-deputy
// hole on this PUBLIC surface. Ported verbatim from the operator flow
// (@sparx/auth/mcp-scopes), keyed on the customer instance's secret.

export interface CustomerConsentGrantPayload {
  /** OAuth client the grant is bound to. */
  clientId: string;
  /** Exact redirect URI approved. */
  redirectUri: string;
  /** Space-joined FULL scope string approved (OIDC framing + business scopes). */
  scope: string;
  /** Customer Better Auth user who approved — the before hook checks this equals
   *  the session. */
  userId: string;
  /** Epoch seconds the grant expires (short — single authorization hop). */
  exp: number;
}

const b64u = (b: Buffer | string) => Buffer.from(b).toString('base64url');

function grantSignature(encodedPayload: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(encodedPayload).digest('base64url');
}

/** Sign a consent grant. Default TTL 120s — long enough for the redirect hop,
 *  short enough to make replay meaningless. */
export function signCustomerConsentGrant(
  payload: Omit<CustomerConsentGrantPayload, 'exp'>,
  secret: string,
  ttlSeconds = 120,
  nowMs: number = Date.now()
): string {
  const full: CustomerConsentGrantPayload = {
    ...payload,
    exp: Math.floor(nowMs / 1000) + ttlSeconds,
  };
  const encoded = b64u(JSON.stringify(full));
  return `${encoded}.${grantSignature(encoded, secret)}`;
}

/** Verify + parse a consent grant. Returns null on any tamper/expiry/format
 *  failure. Constant-time signature compare. */
export function verifyCustomerConsentGrant(
  token: string | undefined | null,
  secret: string,
  nowMs: number = Date.now()
): CustomerConsentGrantPayload | null {
  if (!token) return null;
  const dot = token.indexOf('.');
  if (dot <= 0) return null;
  const encoded = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = grantSignature(encoded, secret);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
  if (typeof parsed !== 'object' || parsed === null) return null;
  const p = parsed as Record<string, unknown>;
  if (
    typeof p.clientId !== 'string' ||
    typeof p.redirectUri !== 'string' ||
    typeof p.scope !== 'string' ||
    typeof p.userId !== 'string' ||
    typeof p.exp !== 'number'
  ) {
    return null;
  }
  if (p.exp * 1000 < nowMs) return null;
  return {
    clientId: p.clientId,
    redirectUri: p.redirectUri,
    scope: p.scope,
    userId: p.userId,
    exp: p.exp,
  };
}
