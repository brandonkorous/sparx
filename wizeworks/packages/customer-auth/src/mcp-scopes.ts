// Shopper MCP OAuth scope vocabulary (docs/113 §5, docs/27 §6).
//
// The SINGLE source of truth for the scopes a returning-customer MCP connection
// can carry. The OIDC framing scopes (openid, offline_access) ride alongside;
// these are the sparx-specific *capability* scopes a shopper grants their own
// LLM client. The customer instance's OAuth provider advertises exactly these
// (server.ts), the store-branded consent page renders them as the scope picker,
// and api-rest gates each customer-tier public route on them
// (lib/customer-session.ts).
//
// Mirrors the operator vocabulary (@wizeworks/auth/mcp-scopes) but for the customer
// tier: no bulk/destructive scopes, no role capping (a shopper is the sole
// principal — they grant their own account's scopes), a much smaller surface.
//
// Pure (no Better Auth / DB imports), so server.ts can use it without an import
// cycle. The consent proof that used to live here (the `sparx_grant` HMAC) is
// gone: on Better Auth 1.7 the provider itself refuses to mint a code until the
// shopper has approved on /oauth2/consent.

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
 *  consent screen (wizeworks/apps/site) with a checkbox per entry. */
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
