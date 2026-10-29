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
// ── AND AS OF 2026-08-23 SOMETHING ACTUALLY ARRIVES HERE ────────────────────
//
// This document was correct and unreached. api-mcp served ONE protected-resource
// document naming `app.sparx.works` as the authorization server, because the
// resource identifier and the AS were single platform-wide values, so a Piggles
// customer connecting an assistant was sent to sparx to sign in and approve
// access to their own business. Discovery happens before any token exists —
// there is no tenant to read a brand from — so the fix was a HOSTNAME:
// `mcp.mypiggles.com` maps to the Piggles brand and api-mcp answers with this
// origin. See docs/07 §5 and piggles/STATUS.md.
//
// Better Auth mounts its handler under /api/auth, so the root /.well-known
// documents have to be served here.

import { auth } from '@wizeworks/auth';

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

/**
 * The provider's own discovery document, as JSON.
 *
 * Built by `@better-auth/mcp` from the live configuration rather than written
 * out here: the endpoints (`/api/auth/oauth2/*`), the signing keys
 * (`/api/auth/jwks`), the grant types and the scope list (our whole MCP
 * vocabulary, `MCP_ALL_OAUTH_SCOPES`) all come from the same options the
 * provider enforces, so the document cannot advertise something the server
 * does not do. The hand-written 1.6 version listed `/mcp/*` endpoints and no
 * key set, which was true then and would be wrong now. `issuer` is this origin
 * because the jwt() plugin is configured with it (@wizeworks/auth server.ts),
 * and that is the authorization server api-mcp names for this brand.
 *
 * `openid` is the OpenID Provider Metadata alias some MCP clients probe
 * instead; it carries the same endpoints plus the OIDC fields.
 */
export async function mcpDiscoveryDocument(
  kind: 'oauth' | 'openid',
  request: Request
): Promise<unknown> {
  return kind === 'openid'
    ? await auth.api.getOpenIdConfig({ request })
    : await auth.api.getOAuthServerConfig({ request });
}
