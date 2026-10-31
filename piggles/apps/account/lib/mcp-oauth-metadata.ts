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
// So the authorization server is this app's origin, the one place in Piggles
// that serves Better Auth's routes (proxied to api-rest, which runs it,
// docs/154). The consent screen lives here for the same reason: it has
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
// documents have to be served here. api-rest builds them, against this brand's
// sign-in origin, because only it holds the auth instance.

import { platformRequest } from '@wizeworks/auth-client-server';

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

/** The discovery document, as api-rest built it for this brand. Asked without
 *  the visitor's cookies: it describes the server, not anybody's session. */
export function mcpDiscoveryDocument(kind: 'oauth' | 'openid'): Promise<unknown> {
  return platformRequest<unknown>(`mcp-discovery/${kind}`, { requestHeaders: new Headers() });
}
