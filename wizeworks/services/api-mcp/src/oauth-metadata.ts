// Resource-server OAuth surface (docs/07 §5, RFC 9728).
//
// api-mcp is the OAuth *resource* server: it serves Protected Resource Metadata
// pointing MCP clients at the authorization server, and it emits the
// `WWW-Authenticate` challenge on 401 so a client can discover that metadata.
// Token issuance/DCR lives on the authorization server, not here.
//
// ── WHY THE HOSTNAME DECIDES WHICH BRAND ANSWERS ────────────────────────────
//
// One api-mcp serves every brand, and this document is fetched BEFORE any token
// exists — there is no tenant to read `platform_brand` from, and there never can
// be, because the whole purpose of the document is to tell a client where to go
// and get one. The request's HOST is the only thing at that moment carrying the
// brand, so the host is what we resolve on. That is not a workaround; it is why
// a brand needs an MCP hostname of its own rather than a shared one.
//
// Before this, the pair was two fixed environment values. Every client was told
// the resource was `mcp.sparx.works/mcp` and the authorization server was
// `app.sparx.works` — so a Piggles customer connecting their assistant was sent
// to sparx to sign in and approve access to their own business, on a sparx
// consent screen, while getpiggles.com (the ONLY place Piggles mounts Better
// Auth) served a consent route nothing ever reached.
//
// An unrecognised host answers for the default brand. That covers a laptop, a
// health check, and the cluster-internal Service address, and it is safe because
// the fallback is what this file did for every request before brands existed.

import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { MCP_ALL_OAUTH_SCOPES } from '@wizeworks/auth';
import { DEFAULT_BRAND, mcpAuthServerOrigin, mcpResourceUrl } from '@wizeworks/links/server';
import { env } from './env.js';

/** This server's public origin, honouring the proxy chain (Caddy + Cloudflare
 *  set X-Forwarded-Proto/Host; Fastify `trustProxy` reflects them). `host`
 *  (not `hostname`) keeps a non-standard port, which matters in local dev. */
function publicOrigin(request: FastifyRequest): string {
  return `${request.protocol}://${request.host}`;
}

function hostOf(url: string): string | null {
  try {
    return new URL(url).host.toLowerCase();
  } catch {
    return null;
  }
}

/**
 * host → brand, built once at boot from each served brand's configured MCP
 * address.
 *
 * Built rather than declared: the brands this deployment serves come from
 * `PLATFORM_BRANDS` and each one's address from its own `<BRAND>_MCP_URL`, so
 * this file names no brand and no hostname, and a third brand is two config
 * lines. A brand with nothing configured is simply absent from the map — which
 * is the honest state, not a guess at what its hostname might be. `env.ts`
 * refuses to boot on that gap rather than let it be discovered by a customer.
 *
 * FIRST BRAND WINS on a shared host. In production the hostnames are distinct by
 * construction — that is the entire point — but on a laptop every brand's
 * address is the same `localhost:3000`, and a last-writer-wins map would hand
 * local sparx development to whichever brand happened to be listed last.
 */
const BRAND_BY_HOST: ReadonlyMap<string, string> = (() => {
  const map = new Map<string, string>();
  for (const brand of env.PLATFORM_BRANDS) {
    let url: string;
    try {
      url = mcpResourceUrl(brand);
    } catch {
      // Unconfigured. `mcpResourceUrl` throws in production on purpose, but a
      // boot-time map is the wrong place to die: the brand that IS configured
      // must keep serving, and `assertBrandAddresses` in env.ts has already
      // stopped the rollout with this brand and its variable named.
      continue;
    }
    const host = hostOf(url);
    if (host !== null && !map.has(host)) map.set(host, brand);
  }
  return map;
})();

/**
 * The brand to answer as when the request's host matches none of them.
 *
 * The default brand, unless this deployment does not serve it — a Piggles-only
 * api-mcp would otherwise answer a health check or the cluster-internal Service
 * address with an address it has no configuration for, and throw where a
 * document was expected. Falling back to a brand we CAN describe is the only
 * answer available; falling back to one we cannot is a 500.
 */
const FALLBACK_BRAND: string = env.PLATFORM_BRANDS.includes(DEFAULT_BRAND)
  ? DEFAULT_BRAND
  : (env.PLATFORM_BRANDS[0] ?? DEFAULT_BRAND);

/** The brand this request is addressed to, from its host. */
export function brandForRequest(request: FastifyRequest): string {
  return BRAND_BY_HOST.get(request.host.toLowerCase()) ?? FALLBACK_BRAND;
}

/** URL of this server's Protected Resource Metadata document. */
export function resourceMetadataUrl(request: FastifyRequest): string {
  return `${publicOrigin(request)}/.well-known/oauth-protected-resource`;
}

/** RFC 9728 challenge value pointing a client at the metadata document. */
export function wwwAuthenticate(request: FastifyRequest): string {
  return `Bearer resource_metadata="${resourceMetadataUrl(request)}"`;
}

function protectedResourceMetadata(brand: string) {
  return {
    resource: mcpResourceUrl(brand),
    authorization_servers: [mcpAuthServerOrigin(brand)],
    scopes_supported: [...MCP_ALL_OAUTH_SCOPES],
    bearer_methods_supported: ['header'],
  };
}

/** Register the public discovery routes. The bare well-known path and the
 *  resource-path-inserted variants (RFC 9728 §3.1, for a resource with a path)
 *  all return the same document. `/mcp` is the canonical endpoint; `/v1` is kept
 *  for the deprecated alias so a client still on that path discovers the AS. No
 *  auth — discovery must be reachable pre-token. */
export function registerOAuthMetadataRoutes(app: FastifyInstance): void {
  const handler = (request: FastifyRequest, reply: FastifyReply) => {
    reply
      .header('access-control-allow-origin', '*')
      // Vary on Host: the document differs per hostname, and a cache that keyed
      // only on path would serve one brand's authorization server to the other.
      .header('vary', 'Host')
      .header('cache-control', 'public, max-age=3600')
      .code(200)
      .send(protectedResourceMetadata(brandForRequest(request)));
  };
  app.get('/.well-known/oauth-protected-resource', handler);
  app.get('/.well-known/oauth-protected-resource/mcp', handler);
  app.get('/.well-known/oauth-protected-resource/v1', handler);
}
