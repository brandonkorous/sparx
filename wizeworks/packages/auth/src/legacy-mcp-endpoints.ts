// The 1.6 MCP OAuth URLs, answered instead of 404'd (docs/07 §5).
//
// Better Auth 1.6's `mcp()` plugin served the authorization server under
// `<basePath>/mcp/*`. 1.7 removed it; `@better-auth/mcp` serves the same flow
// under `<basePath>/oauth2/*` and the signing keys at `<basePath>/jwks`. An
// assistant that cached the old endpoints from discovery would otherwise get a
// bare 404 from the router and show its user a connection error with no reason.
//
// Each old endpoint is sent to its new address with a method-preserving
// redirect (302 for the browser authorize hop, 308 for the POSTs, so a token or
// registration body arrives intact). The client ids those assistants hold no
// longer exist, so what they get there is the provider's own `invalid_client`,
// which every MCP client handles by registering again. Anything else under the
// old prefix answers 410 with the reason in the OAuth error envelope.
//
// A plugin `onRequest` runs before routing, so it sees paths no endpoint
// matches. It is a plain function of the basePath, which is why the customer
// instance (basePath /v1/public/auth) carries the same shape.

import type { BetterAuthPlugin } from 'better-auth';

const MOVED: Readonly<Record<string, string>> = {
  '/mcp/authorize': '/oauth2/authorize',
  '/mcp/token': '/oauth2/token',
  '/mcp/register': '/oauth2/register',
  '/mcp/userinfo': '/oauth2/userinfo',
  '/mcp/jwks': '/jwks',
};

/** Where a request for a removed `/mcp/*` endpoint should go, or a 410 for one
 *  with no successor. Null for every path that is not under `<basePath>/mcp/`.
 *  Exported for its test. */
export function legacyMcpResponse(request: Request, basePath: string): Response | null {
  const url = new URL(request.url);
  const base = basePath.replace(/\/$/, '');
  const prefix = `${base}/mcp/`;
  if (!url.pathname.startsWith(prefix)) return null;

  const oldPath = url.pathname.slice(base.length).replace(/\/$/, '');
  const next = MOVED[oldPath];
  if (next) {
    const status = oldPath === '/mcp/authorize' ? 302 : 308;
    // Relative Location: resolved against the public URL the client used, never
    // the internal bind address a proxied request carries.
    return new Response(null, {
      status,
      headers: { Location: `${base}${next}${url.search}`, 'Cache-Control': 'no-store' },
    });
  }
  return Response.json(
    {
      error: 'invalid_request',
      error_description:
        'This connection uses an address that no longer exists. Remove the connection in your assistant and connect again.',
    },
    { status: 410, headers: { 'Cache-Control': 'no-store' } }
  );
}

export function legacyMcpEndpoints(): BetterAuthPlugin {
  return {
    id: 'sparx-legacy-mcp-endpoints',
    // eslint-disable-next-line @typescript-eslint/require-await -- Better Auth's onRequest signature is async.
    onRequest: async (request, ctx) => {
      const response = legacyMcpResponse(request, ctx.options.basePath ?? '/api/auth');
      return response ? { response } : undefined;
    },
  };
}
