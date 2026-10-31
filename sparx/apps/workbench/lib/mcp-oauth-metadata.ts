// OAuth 2.0 Authorization Server Metadata (RFC 8414) for the MCP OAuth flow
// (docs/07 §5). Served at the workbench origin's /.well-known so MCP clients
// (Claude, ChatGPT) can discover the endpoints after the resource server
// (mcp.sparx.works) advertises this origin as its authorization server.
// SPARX's, specifically: api-mcp resolves the brand from the request host, so
// mcp.mypiggles.com advertises getpiggles.com instead (docs/07 §5).
//
// The workbench's origin is the authorization server: app.sparx.works resolves
// to this app, which serves Better Auth's routes under /api/auth (proxied to
// api-rest, which runs the staff instance and the MCP provider, docs/154). So
// the root /.well-known documents have to be served here.
//
// The document is the provider's own, built by `@better-auth/mcp` in api-rest
// from the live configuration rather than written out here: the endpoints
// (`/api/auth/oauth2/*`), the signing keys (`/api/auth/jwks`), the grant types
// and the scope list (our whole MCP vocabulary, `MCP_ALL_OAUTH_SCOPES`) all come
// from the same options the provider enforces, so the document cannot advertise
// something the server does not do. The hand-written 1.6 version listed `/mcp/*`
// endpoints and no key set, which was true then and would be wrong now.
// `issuer` is this origin because the jwt() plugin is configured with it
// (@wizeworks/auth server.ts), and that is the authorization server api-mcp
// names for this brand. `openid` is the OpenID Provider Metadata alias some MCP
// clients probe instead; it carries the same endpoints plus the OIDC fields.

export { mcpDiscoveryDocument } from '@wizeworks/auth-client-server';

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
