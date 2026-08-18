// Resolve which site a request targets (docs/113 §3.2 / §4).
//
//   • canonical host  mcp.sparx.zone/s/<tenant>[/<property>]/mcp  → subpath
//   • per-site        <site-domain>/mcp                          → Host header
//
// Host resolution defers to api-rest's authoritative resolver
// (GET /v1/public/site-by-host), which handles both *.sparx.zone subdomains and
// custom domains. No DB access here.

import type { FastifyRequest } from 'fastify';
import { SiteApiClient, type SiteCtx } from '@wizeworks/site-mcp';
import { env } from './env.js';

/** The request did not name a site we could resolve → a clean 404, not a 500. */
export class UnknownSiteError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UnknownSiteError';
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
  if (!host) throw new UnknownSiteError('no host header');

  const url = new URL('/v1/public/site-by-host', env.SPARX_API_REST_URL);
  url.searchParams.set('host', host);

  let res: Response;
  try {
    res = await fetch(url, { headers: { accept: 'application/json' } });
  } catch {
    throw new UnknownSiteError('site resolver unreachable');
  }
  if (!res.ok) throw new UnknownSiteError(`unknown site host: ${host}`);
  const body = (await res.json()) as { success?: boolean; data?: Partial<SiteRoute> };
  if (body?.success !== true || !body.data?.tenantSlug) {
    throw new UnknownSiteError(`unknown site host: ${host}`);
  }
  return { tenantSlug: body.data.tenantSlug, propertySlug: body.data.propertySlug ?? null };
}

export function makeClient(site: SiteRoute, customerBearer?: string | null): SiteApiClient {
  const ctx: SiteCtx = {
    tenantSlug: site.tenantSlug,
    propertySlug: site.propertySlug,
    customerBearer: customerBearer ?? null,
  };
  return new SiteApiClient(env.SPARX_API_REST_URL, ctx);
}

export interface SiteInfo {
  /** Modules the tenant switched off — used to skip registering their tools. */
  disabledModules: string[];
  /** The site's canonical public origin — the shopper OAuth authorization-server
   *  origin (docs/113 §5), where its sparx_customer_session cookie lives. null on a
   *  failed lookup (the customer tier then can't advertise an AS). */
  siteUrl: string | null;
}

/** Best-effort read of the site's projected info (from site-info): its
 *  disabled modules + canonical origin. Fails OPEN on modules (register the full
 *  catalog, let the public route reject) and returns a null siteUrl on error. */
export async function fetchSiteInfo(client: SiteApiClient): Promise<SiteInfo> {
  try {
    const { data } = await client.request<{ disabledModules?: unknown; siteUrl?: unknown }>({
      method: 'GET',
      path: '/v1/public/site-info',
    });
    const list = data?.disabledModules;
    return {
      disabledModules: Array.isArray(list)
        ? list.filter((m): m is string => typeof m === 'string')
        : [],
      siteUrl: typeof data?.siteUrl === 'string' ? data.siteUrl : null,
    };
  } catch {
    return { disabledModules: [], siteUrl: null };
  }
}
