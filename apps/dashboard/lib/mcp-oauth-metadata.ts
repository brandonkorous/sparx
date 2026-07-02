// OAuth 2.0 Authorization Server Metadata (RFC 8414) for the MCP OAuth flow
// (docs/07 §5). Served at the dashboard origin's /.well-known so MCP clients
// (Claude, ChatGPT) can discover the endpoints after the resource server
// (mcp.sparx.works) points them here.
//
// We build this OURSELVES rather than proxying Better Auth's helper because the
// plugin hardcodes `scopes_supported` to the four OIDC scopes — it never
// surfaces our MCP business-scope vocabulary. Endpoints below are Better Auth's
// mcp() plugin routes under /api/auth; /mcp/authorize is guarded by the
// consent-grant `before` hook (server.ts), so advertising it directly is safe.

import { MCP_ALL_OAUTH_SCOPES } from '@sparx/auth';

/** Canonical public origin of the authorization server (the dashboard). */
export function authServerOrigin(requestOrigin?: string): string {
  const configured = process.env.BETTER_AUTH_URL ?? process.env.NEXT_PUBLIC_DASHBOARD_URL;
  return (configured ?? requestOrigin ?? 'http://localhost:3001').replace(/\/$/, '');
}

export function buildAuthorizationServerMetadata(origin: string): Record<string, unknown> {
  const auth = `${origin}/api/auth`;
  return {
    issuer: origin,
    authorization_endpoint: `${auth}/mcp/authorize`,
    token_endpoint: `${auth}/mcp/token`,
    registration_endpoint: `${auth}/mcp/register`,
    jwks_uri: `${auth}/mcp/jwks`,
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
