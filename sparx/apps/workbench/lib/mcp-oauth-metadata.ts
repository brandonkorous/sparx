// OAuth 2.0 Authorization Server Metadata (RFC 8414) for the MCP OAuth flow
// (docs/07 §5). Served at the workbench origin's /.well-known so MCP clients
// (Claude, ChatGPT) can discover the endpoints after the resource server
// (mcp.sparx.works) advertises this origin as its authorization server.
//
// The workbench is the authorization server: it holds the staff Better Auth
// instance (the mcp() plugin lives in the shared @wizeworks/auth), and app.sparx.works
// resolves to this app. We build the document OURSELVES rather than proxying
// Better Auth's helper because the plugin hardcodes `scopes_supported` to the
// four OIDC scopes — it never surfaces our MCP business-scope vocabulary. The
// endpoints below are the plugin's mcp() routes under /api/auth; /mcp/authorize
// is guarded by the consent-grant `before` hook (wizeworks/packages/auth/src/server.ts),
// so advertising it directly is safe.

import { MCP_ALL_OAUTH_SCOPES } from '@wizeworks/auth';

/** Canonical public origin of the authorization server (the workbench, at
 *  app.sparx.works). Prefer the configured BETTER_AUTH_URL — the same value
 *  Better Auth uses as its baseURL — over the request origin, which behind the
 *  Caddy/GKE proxy resolves to the internal bind address (0.0.0.0:3000). The
 *  dev fallback is the workbench's own dev port. */
export function authServerOrigin(requestOrigin?: string): string {
  const configured = process.env.BETTER_AUTH_URL;
  return (configured ?? requestOrigin ?? 'http://localhost:3011').replace(/\/$/, '');
}

export function buildAuthorizationServerMetadata(origin: string): Record<string, unknown> {
  const auth = `${origin}/api/auth`;
  return {
    issuer: origin,
    authorization_endpoint: `${auth}/mcp/authorize`,
    token_endpoint: `${auth}/mcp/token`,
    registration_endpoint: `${auth}/mcp/register`,
    // No jwks_uri: this AS issues OPAQUE access tokens (validated by api-mcp via
    // a DB lookup in verifyMcpOAuthToken, never signature verification) and signs
    // id_tokens with HS256 (a shared client secret, not an asymmetric keypair).
    // Neither scheme has a public key to publish, so there is no JWKS document —
    // the mcp() plugin serves no /mcp/jwks route. jwks_uri is optional in RFC 8414;
    // advertising it here only pointed strict clients at a 404. (It was carried
    // over from the dashboard, where it was likewise dead.)
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

/** Shared response headers so browsers/clients on any origin can read the
 *  discovery document and preflight it. */
export const OAUTH_DISCOVERY_HEADERS: Record<string, string> = {
  'Content-Type': 'application/json',
  'Cache-Control': 'public, max-age=3600',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400',
};
