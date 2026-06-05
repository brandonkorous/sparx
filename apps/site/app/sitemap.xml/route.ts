// Per-SITE sitemap. Proxies api-rest's /v1/sitemap.xml?tenant=<slug>[&property=<slug>]
// keyed off the Host header — so each web property (docs/49) advertises only its
// own pages/products/content at its own canonical host. Cached at the edge for
// 5 min (same as api-rest's own Cache-Control on the underlying endpoint).

import { resolveTenant, resolveActivePropertySlug } from '@/lib/tenant';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const BASE_URL = process.env.SPARX_API_REST_URL ?? 'http://localhost:3100';

export async function GET() {
  const tenant = await resolveTenant();
  if (!tenant) {
    return new Response('Not found', { status: 404 });
  }
  const propertySlug = await resolveActivePropertySlug();

  const upstream = new URL(`${BASE_URL}/v1/sitemap.xml`);
  upstream.searchParams.set('tenant', tenant.slug);
  if (propertySlug) upstream.searchParams.set('property', propertySlug);

  const res = await fetch(upstream, {
    next: {
      revalidate: 300,
      tags: propertySlug
        ? [`tenant:${tenant.slug}`, `tenant:${tenant.slug}:${propertySlug}`, 'sparx-storefront']
        : [`tenant:${tenant.slug}`, 'sparx-storefront'],
    },
  });
  if (!res.ok) {
    return new Response('', { status: 502 });
  }
  const xml = await res.text();
  return new Response(xml, {
    headers: {
      'content-type': 'application/xml; charset=utf-8',
      'cache-control': 'public, max-age=300, stale-while-revalidate=86400',
    },
  });
}
