// Resource-server OAuth surface for the site MCP customer tier (docs/113
// §5, RFC 9728). mcp-site is the OAuth *resource* server: it advertises the
// authorization server (the site's own origin — where the shopper signs in and
// the customer Better Auth AS lives) via Protected Resource Metadata + a
// `WWW-Authenticate` challenge on an unauthenticated customer-tool call. Token
// issuance + verification live elsewhere (the AS mints; api-rest verifies the
// bearer on each customer public-route call) — this service holds no DB.

import type { FastifyRequest } from 'fastify';

// The shopper OAuth scope vocabulary. SOURCE OF TRUTH is @wizeworks/customer-auth
// (CUSTOMER_MCP_SCOPES); duplicated here as a plain list because mcp-site is
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

/** The MCP resource identifier for a request — the site-facing MCP endpoint URL
 *  (`<origin>/mcp` or `<origin>/s/<tenant>[/<property>]/mcp`). */
export function resourceUrl(request: FastifyRequest): string {
  return `${requestOrigin(request)}${pathOnly(request.url)}`;
}

/** The absolute Protected Resource Metadata URL to advertise in WWW-Authenticate —
 *  the MCP endpoint path + the well-known suffix (reachable via the same site
 *  `/mcp*` route). */
export function resourceMetadataUrl(request: FastifyRequest): string {
  return `${resourceUrl(request)}/.well-known/oauth-protected-resource`;
}

/** RFC 9728 challenge value pointing a client at the metadata document. */
export function wwwAuthenticate(request: FastifyRequest): string {
  return `Bearer resource_metadata="${resourceMetadataUrl(request)}"`;
}

/** The well-known path segment RFC 9728 reserves for Protected Resource Metadata. */
const WELL_KNOWN_PRM = '/.well-known/oauth-protected-resource';

/** The MCP endpoint path a metadata request describes, recovered from the request
 *  URL so ONE handler serves every RFC 9728 §3.1 discovery shape correctly:
 *
 *    • path-suffixed   `<mcp>/.well-known/oauth-protected-resource`  → `<mcp>`
 *    • path-inserted   `/.well-known/oauth-protected-resource/<mcp>` → `/<mcp>`
 *    • bare root       `/.well-known/oauth-protected-resource`       → `/mcp`
 *
 *  The path-inserted + bare-root shapes are what an MCP client CONSTRUCTS when it
 *  never saw our WWW-Authenticate challenge (an unauthenticated `initialize`
 *  succeeds, so there's no 401 carrying the metadata URL) — without them discovery
 *  404s and the client can't reach the authorization server. Bare root maps to the
 *  per-site `/mcp` endpoint (Host-resolved); canonical `/s/<tenant>[/<property>]/mcp`
 *  clients use the path-inserted shape, which carries the resource path verbatim. */
export function mcpResourcePath(request: FastifyRequest): string {
  const path = pathOnly(request.url);
  if (path === WELL_KNOWN_PRM) return '/mcp';
  if (path.startsWith(`${WELL_KNOWN_PRM}/`)) return path.slice(WELL_KNOWN_PRM.length);
  if (path.endsWith(WELL_KNOWN_PRM)) return path.slice(0, -WELL_KNOWN_PRM.length);
  return path;
}

/** RFC 9728 Protected Resource Metadata: this resource + the site's AS. `resource`
 *  is the MCP endpoint the request describes (see `mcpResourcePath`); `authServer`
 *  is the site's canonical origin (from site-info). */
export function protectedResourceMetadata(
  request: FastifyRequest,
  authServer: string | null
): Record<string, unknown> {
  const resource = `${requestOrigin(request)}${mcpResourcePath(request)}`;
  return {
    resource,
    ...(authServer ? { authorization_servers: [authServer] } : {}),
    scopes_supported: [...CUSTOMER_MCP_SCOPES],
    bearer_methods_supported: ['header'],
  };
}
