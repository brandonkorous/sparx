// Resource-server OAuth surface (docs/07 §5, RFC 9728).
//
// api-mcp is the OAuth *resource* server: it serves Protected Resource Metadata
// pointing MCP clients at the authorization server (the dashboard), and it
// emits the `WWW-Authenticate` challenge on 401 so a client can discover that
// metadata. Token issuance/DCR lives on the authorization server, not here.

import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { MCP_ALL_OAUTH_SCOPES } from '@sparx/auth';
import { env } from './env.js';

/** This server's public origin, honouring the proxy chain (Caddy + Cloudflare
 *  set X-Forwarded-Proto/Host; Fastify `trustProxy` reflects them). `host`
 *  (not `hostname`) keeps a non-standard port, which matters in local dev. */
function publicOrigin(request: FastifyRequest): string {
  return `${request.protocol}://${request.host}`;
}

/** URL of this server's Protected Resource Metadata document. */
export function resourceMetadataUrl(request: FastifyRequest): string {
  return `${publicOrigin(request)}/.well-known/oauth-protected-resource`;
}

/** RFC 9728 challenge value pointing a client at the metadata document. */
export function wwwAuthenticate(request: FastifyRequest): string {
  return `Bearer resource_metadata="${resourceMetadataUrl(request)}"`;
}

function protectedResourceMetadata() {
  return {
    resource: env.MCP_RESOURCE_URL,
    authorization_servers: [env.MCP_AUTH_SERVER_URL],
    scopes_supported: [...MCP_ALL_OAUTH_SCOPES],
    bearer_methods_supported: ['header'],
  };
}

/** Register the public discovery routes. Both the bare well-known path and the
 *  resource-path-suffixed variant (RFC 9728 §3.1, for a resource with a path)
 *  return the same document. No auth — discovery must be reachable pre-token. */
export function registerOAuthMetadataRoutes(app: FastifyInstance): void {
  const handler = (_request: FastifyRequest, reply: FastifyReply) => {
    reply
      .header('access-control-allow-origin', '*')
      .header('cache-control', 'public, max-age=3600')
      .code(200)
      .send(protectedResourceMetadata());
  };
  app.get('/.well-known/oauth-protected-resource', handler);
  app.get('/.well-known/oauth-protected-resource/v1', handler);
}
