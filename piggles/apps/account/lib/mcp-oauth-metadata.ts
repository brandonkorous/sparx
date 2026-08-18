// OAuth 2.0 Authorization Server Metadata (RFC 8414) for the MCP flow
// (docs/07 §5). MCP clients — Claude, ChatGPT — fetch this to discover the
// authorize / token / register endpoints after the resource server advertises
// this origin as its authorization server.
//
// ── WHY THIS LIVES IN THE ACCOUNT APP AND NOT THE CONSOLE ───────────────────
//
// It was forked into the console (mypiggles.com) along with everything else, and
// nothing ever served it — the two /.well-known routes did not come across. That
// was the lucky version of the bug. Had they come across, they would have
// advertised `https://mypiggles.com/api/auth/mcp/authorize`, and the console
// mounts NO Better Auth handler at all: getpiggles.com is the auth authority and
// the console deliberately has no sign-in, no OAuth callback and no way to mint a
// session (piggles/CLAUDE.md, "The three surfaces"). Every advertised endpoint
// would have been a 404.
//
// So the authorization server is this app, which is the one place in Piggles that
// mounts Better Auth. The consent screen lives here for the same reason: it has
// to be able to send an unauthenticated visitor to a sign-in page that exists.
//
// We build the document ourselves rather than proxying Better Auth's helper
// because the plugin hardcodes `scopes_supported` to the four OIDC scopes and
// never surfaces the MCP business-scope vocabulary. The endpoints below are the
// plugin's mcp() routes under /api/auth; /mcp/authorize is guarded by the
// consent-grant `before` hook in @wizeworks/auth, so advertising it is safe.

import { MCP_ALL_OAUTH_SCOPES } from '@wizeworks/auth';

/**
 * Canonical public origin of the authorization server.
 *
 * Prefer the configured `BETTER_AUTH_URL` — the same value Better Auth uses as
 * its baseURL — over the request origin, which behind the ingress proxy resolves
 * to the internal bind address rather than the public host. The dev fallback is
 * this app's own port (3021), NOT the console's: pointing discovery at an app
 * with no `/api/auth` handler is precisely the failure described above.
 */
export function authServerOrigin(requestOrigin?: string): string {
  const configured = process.env.BETTER_AUTH_URL;
  return (configured ?? requestOrigin ?? 'http://localhost:3021').replace(/\/$/, '');
}

export function buildAuthorizationServerMetadata(origin: string): Record<string, unknown> {
  const auth = `${origin}/api/auth`;
  return {
    issuer: origin,
    authorization_endpoint: `${auth}/mcp/authorize`,
    token_endpoint: `${auth}/mcp/token`,
    registration_endpoint: `${auth}/mcp/register`,
    // No jwks_uri: this AS issues OPAQUE access tokens (validated by api-mcp via
    // a DB lookup, never signature verification) and signs id_tokens with HS256
    // (a shared client secret, not an asymmetric keypair). Neither scheme has a
    // public key to publish, so there is no JWKS document and the mcp() plugin
    // serves no /mcp/jwks route. jwks_uri is optional in RFC 8414; advertising
    // one only pointed strict clients at a 404.
    scopes_supported: [...MCP_ALL_OAUTH_SCOPES],
    response_types_supported: ['code'],
    response_modes_supported: ['query'],
    grant_types_supported: ['authorization_code', 'refresh_token'],
    token_endpoint_auth_methods_supported: ['none', 'client_secret_basic', 'client_secret_post'],
    // OAuth 2.1: PKCE with S256 only (plain is disabled in the provider config).
    code_challenge_methods_supported: ['S256'],
    subject_types_supported: ['public'],
    id_token_signing_alg_values_supported: ['HS256'],
    claims_supported: ['sub', 'iss', 'aud', 'exp', 'iat', 'email', 'email_verified', 'name'],
  };
}

/** Shared response headers so clients on any origin can read the discovery
 *  document and preflight it. */
export const OAUTH_DISCOVERY_HEADERS: Record<string, string> = {
  'Content-Type': 'application/json',
  'Cache-Control': 'public, max-age=3600',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400',
};
