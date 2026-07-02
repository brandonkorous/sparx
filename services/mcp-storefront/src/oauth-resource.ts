// Resource-server OAuth surface for the storefront MCP customer tier (docs/113
// §5, RFC 9728). mcp-storefront is the OAuth *resource* server: it advertises the
// authorization server (the store's own origin — where the shopper signs in and
// the customer Better Auth AS lives) via Protected Resource Metadata + a
// `WWW-Authenticate` challenge on an unauthenticated customer-tool call. Token
// issuance + verification live elsewhere (the AS mints; api-rest verifies the
// bearer on each customer public-route call) — this service holds no DB.

import type { FastifyRequest } from 'fastify';

// The shopper OAuth scope vocabulary. SOURCE OF TRUTH is @sparx/customer-auth
// (CUSTOMER_MCP_SCOPES); duplicated here as a plain list because mcp-storefront is
// deliberately DB-less (docs/113 §3.2) and must not import that package. Advertised
// for discovery only — api-rest enforces the real gate. Keep in sync.
const CUSTOMER_MCP_SCOPES = [
  'account:read',
  'account:write',
  'orders:read',
  'bookings:read',
  'bookings:write',
  'b2b:read',
] as const;

/** The `Authorization: Bearer <token>` credential on the incoming MCP request. */
export function bearerToken(request: FastifyRequest): string | null {
  const header = request.headers.authorization;
  if (!header || typeof header !== 'string' || !header.startsWith('Bearer ')) return null;
  const token = header.slice('Bearer '.length).trim();
  return token.length > 0 ? token : null;
}

/** First value of a (possibly comma-joined, possibly repeated) proxy header,
 *  trimmed — or `undefined` when absent or empty, so callers can `??`-chain it
 *  and still fall through on an empty `X-Forwarded-*`. */
function firstForwarded(value: string | string[] | undefined): string | undefined {
  const raw = Array.isArray(value) ? value[0] : value;
  const first = raw?.split(',')[0]?.trim();
  return first === '' ? undefined : first;
}

/** This server's public origin for the current request (honours the Caddy proxy
 *  chain; `host` keeps a non-standard port, which matters in local dev). */
export function requestOrigin(request: FastifyRequest): string {
  const proto = firstForwarded(request.headers['x-forwarded-proto']) ?? request.protocol;
  const host =
    firstForwarded(request.headers['x-forwarded-host']) ??
    firstForwarded(request.headers.host) ??
    request.host;
  return `${proto}://${host}`;
}

/** The path portion of the request URL (query stripped). */
export function pathOnly(url: string): string {
  return url.split('?')[0] ?? url;
}

/** The MCP resource identifier for a request — the store-facing MCP endpoint URL
 *  (`<origin>/mcp` or `<origin>/s/<tenant>[/<property>]/mcp`). */
export function resourceUrl(request: FastifyRequest): string {
  return `${requestOrigin(request)}${pathOnly(request.url)}`;
}

/** The absolute Protected Resource Metadata URL to advertise in WWW-Authenticate —
 *  the MCP endpoint path + the well-known suffix (reachable via the same store
 *  `/mcp*` route). */
export function resourceMetadataUrl(request: FastifyRequest): string {
  return `${resourceUrl(request)}/.well-known/oauth-protected-resource`;
}

/** RFC 9728 challenge value pointing a client at the metadata document. */
export function wwwAuthenticate(request: FastifyRequest): string {
  return `Bearer resource_metadata="${resourceMetadataUrl(request)}"`;
}

/** RFC 9728 Protected Resource Metadata: this resource + the store's AS. `resource`
 *  is the MCP endpoint (strip the well-known suffix from the metadata request URL);
 *  `authServer` is the store's canonical origin (from storefront-info). */
export function protectedResourceMetadata(
  request: FastifyRequest,
  authServer: string | null
): Record<string, unknown> {
  const resource = resourceUrl(request).replace(/\/\.well-known\/oauth-protected-resource$/, '');
  return {
    resource,
    ...(authServer ? { authorization_servers: [authServer] } : {}),
    scopes_supported: [...CUSTOMER_MCP_SCOPES],
    bearer_methods_supported: ['header'],
  };
}
