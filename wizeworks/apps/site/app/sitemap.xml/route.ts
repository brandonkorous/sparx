// Per-SITE sitemap. Proxies api-rest's /v1/sitemap.xml?tenant=<slug>[&property=<slug>]
// keyed off the Host header — so each web property (docs/49) advertises only its
// own pages/products/content at its own canonical host. Cached at the edge for
// 5 min (same as api-rest's own Cache-Control on the underlying endpoint).

import { resolveSite, resolveActivePropertySlug } from '@/lib/site-context';

// NO `force-dynamic` (docs/127 §6). It was doing two things and only one was wanted:
// forcing dynamic rendering, and forcing `no-store` on every fetch beneath it — which
// overrode the revalidate window + purge tags each read in lib/* already declares. This
// route still renders per-request either way, because `resolveSite()` reads the Host
// header; what changed is that its data is now cached and purged on publish.
export const runtime = 'nodejs';

const BASE_URL = process.env.SPARX_API_REST_URL ?? 'http://localhost:3100';

export async function GET(request: Request) {
  const site = await resolveSite();
  if (!site) {
    return new Response('Not found', { status: 404 });
  }
  const propertySlug = await resolveActivePropertySlug();

  const upstream = new URL(`${BASE_URL}/v1/sitemap.xml`);
  upstream.searchParams.set('tenant', site.slug);
  if (propertySlug) upstream.searchParams.set('property', propertySlug);

  let xml: string | null = null;
  try {
    const res = await fetch(upstream, {
      next: {
        revalidate: 300,
        tags: propertySlug
          ? [`tenant:${site.slug}`, `tenant:${site.slug}:${propertySlug}`, 'sparx-storefront']
          : [`tenant:${site.slug}`, 'sparx-storefront'],
      },
    });
    if (res.ok) xml = await res.text();
  } catch {
    // Network-level failure (api-rest unreachable, DNS, timeout). Falls through
    // to the degraded sitemap below — an unhandled throw here would 500 the
    // route, which is strictly worse for a crawler than a thin-but-valid index.
  }

  if (xml === null) {
    return degradedSitemap(request);
  }

  return new Response(xml, {
    headers: {
      'content-type': 'application/xml; charset=utf-8',
      'cache-control': 'public, max-age=300, stale-while-revalidate=86400',
    },
  });
}

// api-rest is unreachable or erroring. Previously this returned a bare 502,
// which meant a transient blip served every crawler an error for the whole
// 5-minute cache window — and repeated errors on a sitemap URL are a signal
// search engines act on. Serve a VALID sitemap containing the homepage instead:
// the crawler gets a usable document, discovers the site, and re-crawls to find
// the rest once the API recovers.
//
// The short max-age is the point — 60s rather than the healthy path's 300s, so
// a recovered API is picked up quickly instead of the degraded document being
// cached for the full window. `must-revalidate` keeps a CDN from serving it stale
// past that.
function degradedSitemap(request: Request): Response {
  // `<loc>` must be a fully-qualified URL — a relative path is invalid and the
  // whole document gets rejected. Behind the cluster ingress `request.url` is
  // the internal bind address, so derive the public origin from the forwarded
  // headers exactly as app/robots.txt/route.ts does.
  const url = new URL(request.url);
  const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host') ?? url.host;
  const forwardedProto = request.headers.get('x-forwarded-proto');
  const origin = `${forwardedProto ? `${forwardedProto}:` : url.protocol}//${host}`;

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>${origin}/</loc></url>
</urlset>`;
  return new Response(xml, {
    status: 200,
    headers: {
      'content-type': 'application/xml; charset=utf-8',
      'cache-control': 'public, max-age=60, must-revalidate',
    },
  });
}
