// Resolve which storefront a request targets (docs/113 §3.2 / §4).
//
//   • canonical host  mcp.sparx.zone/s/<tenant>[/<property>]/mcp  → subpath
//   • per-site        <store-domain>/mcp                          → Host header
//
// Host resolution defers to api-rest's authoritative resolver
// (GET /v1/public/site-by-host), which handles both *.sparx.zone subdomains and
// custom domains. No DB access here.

import type { FastifyRequest } from 'fastify';
import { StorefrontApiClient, type StorefrontCtx } from '@sparx/storefront-mcp';
import { env } from './env.js';

/** The request did not name a storefront we could resolve → a clean 404, not a 500. */
export class UnknownStorefrontError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UnknownStorefrontError';
  }
}

export interface SiteRoute {
  tenantSlug: string;
  propertySlug: string | null;
}

export async function resolveSite(
  request: FastifyRequest,
  subpath?: { tenant?: string; property?: string }
): Promise<SiteRoute> {
  if (subpath?.tenant) {
    return { tenantSlug: subpath.tenant, propertySlug: subpath.property ?? null };
  }

  const forwarded = request.headers['x-forwarded-host'];
  const rawHost = (Array.isArray(forwarded) ? forwarded[0] : forwarded) ?? request.headers.host;
  const host = rawHost?.split(',')[0]?.trim();
  if (!host) throw new UnknownStorefrontError('no host header');

  const url = new URL('/v1/public/site-by-host', env.SPARX_API_REST_URL);
  url.searchParams.set('host', host);

  let res: Response;
  try {
    res = await fetch(url, { headers: { accept: 'application/json' } });
  } catch {
    throw new UnknownStorefrontError('storefront resolver unreachable');
  }
  if (!res.ok) throw new UnknownStorefrontError(`unknown storefront host: ${host}`);
  const body = (await res.json()) as { success?: boolean; data?: Partial<SiteRoute> };
  if (body?.success !== true || !body.data?.tenantSlug) {
    throw new UnknownStorefrontError(`unknown storefront host: ${host}`);
  }
  return { tenantSlug: body.data.tenantSlug, propertySlug: body.data.propertySlug ?? null };
}

export function makeClient(site: SiteRoute): StorefrontApiClient {
  const ctx: StorefrontCtx = { tenantSlug: site.tenantSlug, propertySlug: site.propertySlug };
  return new StorefrontApiClient(env.SPARX_API_REST_URL, ctx);
}

/** Best-effort read of the tenant's disabled modules (from storefront-info) so
 *  we can skip registering tools for modules that are off. Fails OPEN — on any
 *  error we register the full catalog and let the public route reject calls. */
export async function fetchDisabledModules(client: StorefrontApiClient): Promise<string[]> {
  try {
    const { data } = await client.request<{ disabledModules?: unknown }>({
      method: 'GET',
      path: '/v1/public/storefront-info',
    });
    const list = data?.disabledModules;
    return Array.isArray(list) ? list.filter((m): m is string => typeof m === 'string') : [];
  } catch {
    return [];
  }
}
