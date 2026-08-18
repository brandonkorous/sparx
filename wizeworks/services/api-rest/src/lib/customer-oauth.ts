// Shopper OAuth authorization-server plumbing for api-rest (docs/113 §5, docs/27
// §6). The customer Better Auth instance (@wizeworks/customer-auth) is the AS; its
// HTTP handler is mounted here under `/v1/public/auth/*`. Because the AS lives on
// the STORE's own origin (Caddy routes `<store>/v1/public/auth/*` + the store-root
// `.well-known` to api-rest), the browser stays same-origin with its
// sparx_customer_session cookie through the whole authorize → consent flow.
//
// This module holds the request→tenant resolution and the Fastify↔Web bridge that
// runs Better Auth's `handler(Request): Promise<Response>` inside the ambient
// tenantStore so every adapter op is RLS-scoped to the resolved store.

import type { FastifyReply, FastifyRequest } from 'fastify';

import { getCustomerAuth } from '@wizeworks/customer-auth';
import { prisma, tenantStore } from '@wizeworks/db';
import { notFound } from '@wizeworks/api-core/errors';

import { resolveSiteByHost } from './domain.js';

const ZERO_TENANT = '00000000-0000-0000-0000-000000000000';

/** The single forwarded host (Caddy sets X-Forwarded-Host; trustProxy reflects
 *  it). Falls back to the raw Host. */
function forwardedHost(request: FastifyRequest): string | undefined {
  const xf = request.headers['x-forwarded-host'];
  const raw = (Array.isArray(xf) ? xf[0] : xf) ?? request.headers.host;
  const trimmed = raw?.split(',')[0]?.trim();
  return trimmed === '' ? undefined : trimmed;
}

/** The store's own public origin for this request — the AS origin. `host` (not
 *  `hostname`) keeps a non-standard port, which matters in local dev. */
export function requestStoreOrigin(request: FastifyRequest): string {
  const xfProto = request.headers['x-forwarded-proto'];
  const rawProto = (Array.isArray(xfProto) ? xfProto[0] : xfProto)?.split(',')[0]?.trim();
  const proto = rawProto === undefined || rawProto === '' ? request.protocol : rawProto;
  return `${proto}://${forwardedHost(request) ?? request.host}`;
}

export interface AuthTenant {
  tenantId: string;
  /** The store origin the AS + its redirects/metadata are built on. */
  storeOrigin: string;
}

/** Resolve the tenant an AS request targets: primarily the storefront HOST
 *  (`resolveSiteByHost`, the same authoritative resolver the rest of the public
 *  surface uses), with a `?tenant=<slug>` fallback for local dev / direct
 *  api-rest access where no store host is present. 404 if neither resolves. */
export async function resolveAuthTenant(request: FastifyRequest): Promise<AuthTenant> {
  const storeOrigin = requestStoreOrigin(request);
  const host = forwardedHost(request);
  if (host) {
    const site = await resolveSiteByHost(host);
    if (site) return { tenantId: site.tenantId, storeOrigin };
  }
  const slug = (request.query as { tenant?: string } | undefined)?.tenant;
  if (slug) {
    const row = await prisma.tenant.findUnique({ where: { slug }, select: { id: true } });
    if (row && row.id !== ZERO_TENANT) return { tenantId: row.id, storeOrigin };
  }
  throw notFound('Store', host ?? slug ?? 'unknown');
}

/** Bridge a Fastify request into Better Auth's Web `handler(Request)` and pipe the
 *  Web `Response` back onto the Fastify reply, running the whole thing inside
 *  `tenantStore.run(tenantId, …)` so every customer-auth adapter op is scoped to
 *  the resolved store (RLS). Set-Cookie is relayed via `getSetCookie()` — never the
 *  comma-coalescing `forEach`, which corrupts multiple cookies. */
export async function runCustomerAuthHandler(
  request: FastifyRequest,
  reply: FastifyReply,
  tenant: AuthTenant
): Promise<void> {
  const headers = new Headers();
  for (const [key, value] of Object.entries(request.headers)) {
    if (Array.isArray(value)) for (const v of value) headers.append(key, v);
    else if (typeof value === 'string') headers.set(key, value);
  }

  const method = request.method.toUpperCase();
  const hasBody = method !== 'GET' && method !== 'HEAD';
  // The scoped content-type parsers (routes/v1/public/auth.ts) keep the RAW string
  // body for json + form-urlencoded, so Better Auth re-parses it itself (the token
  // endpoint is form-encoded). Fall back to re-stringifying a parsed object.
  const body = hasBody
    ? typeof request.body === 'string'
      ? request.body
      : request.body != null
        ? JSON.stringify(request.body)
        : undefined
    : undefined;

  const webRequest = new Request(`${tenant.storeOrigin}${request.url}`, {
    method,
    headers,
    body,
    redirect: 'manual',
  });

  const auth = getCustomerAuth();
  const webResponse = await tenantStore.run(tenant.tenantId, () => auth.handler(webRequest));

  reply.status(webResponse.status);
  const setCookies = webResponse.headers.getSetCookie();
  webResponse.headers.forEach((value, key) => {
    if (key.toLowerCase() === 'set-cookie') return;
    reply.header(key, value);
  });
  if (setCookies.length > 0) reply.header('set-cookie', setCookies);
  reply.send(Buffer.from(await webResponse.arrayBuffer()));
}
