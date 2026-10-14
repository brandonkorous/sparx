// The site's feed, at the address a reader's feed app looks for. Proxies api-rest's
// /v1/rss.xml?tenant=<slug>[&property=<slug>] for the site this host serves: every
// kind of writing it publishes, linked on its own address.
//
// The feed existed only on the API, defaulted to blog posts and was named nowhere on
// the site, so a journal's readers had no way to follow it (P09). `app/layout.tsx`
// names this address in every page's head, which is how a feed app finds it when a
// reader pastes the site's address.

import { resolveActivePropertySlug, resolveSite } from '@/lib/site-context';
import { siteShowsModule } from '@/lib/site-modules';

export const runtime = 'nodejs';

const BASE_URL = process.env.SPARX_API_REST_URL ?? 'http://localhost:3100';

export async function GET() {
  const site = await resolveSite();
  // A dark site and a site with its writing switched off have no feed, the same as
  // they have no pieces to open.
  if (!site || site.billingPhase === 'suspended' || !siteShowsModule(site, 'cms')) {
    return new Response('Not found', { status: 404 });
  }
  const propertySlug = await resolveActivePropertySlug();

  const upstream = new URL(`${BASE_URL}/v1/rss.xml`);
  upstream.searchParams.set('tenant', site.slug);
  if (propertySlug) upstream.searchParams.set('property', propertySlug);

  try {
    const res = await fetch(upstream, {
      next: {
        revalidate: 300,
        tags: propertySlug
          ? [`content:${site.slug}`, `tenant:${site.slug}:${propertySlug}`, 'sparx-storefront']
          : [`content:${site.slug}`, 'sparx-storefront'],
      },
    });
    if (res.status === 404) return new Response('Not found', { status: 404 });
    if (res.ok) {
      return new Response(await res.text(), {
        headers: {
          'content-type': 'application/rss+xml; charset=utf-8',
          'cache-control': 'public, max-age=300, stale-while-revalidate=86400',
        },
      });
    }
  } catch {
    // api-rest unreachable: answered below.
  }
  // A feed app retries on its own schedule. A short, honest failure is better than
  // an empty feed, which it would read as "everything was taken down".
  return new Response('The feed could not be read just now.', {
    status: 503,
    headers: { 'retry-after': '60', 'cache-control': 'no-store' },
  });
}
