// Per-tenant llms.txt — the AI-readable index of a tenant storefront (docs/50).
//
// The llms.txt convention (llmstxt.org) hands answer engines and agents a
// curated, link-first map of the site in Markdown. For a storefront that's the
// store identity plus the navigational entry points and a pointer to the full
// machine-readable sitemap (which already enumerates every product, collection,
// and page). Tenant resolved from the Host header, same as robots.txt/sitemap.xml.

import { resolveSite } from '@/lib/site-context';

// NO `force-dynamic` (docs/127 §6). It was doing two things and only one was wanted:
// forcing dynamic rendering, and forcing `no-store` on every fetch beneath it — which
// overrode the revalidate window + purge tags each read in lib/* already declares. This
// route still renders per-request either way, because `resolveSite()` reads the Host
// header; what changed is that its data is now cached and purged on publish.
export const runtime = 'nodejs';

export async function GET(request: Request) {
  // Behind the cluster ingress, request.url reports the internal bind address —
  // prefer the forwarded host so the links point at the public storefront origin
  // (mirrors robots.txt/route.ts).
  const headers = request.headers;
  const forwardedHost = headers.get('x-forwarded-host');
  const forwardedProto = headers.get('x-forwarded-proto');
  const url = new URL(request.url);
  const host = forwardedHost ?? headers.get('host') ?? url.host;
  const protocol = forwardedProto ? `${forwardedProto}:` : url.protocol;
  const origin = `${protocol}//${host}`;

  const site = await resolveSite();
  if (!site) {
    return new Response('# Unknown store\n', {
      status: 404,
      headers: { 'content-type': 'text/plain; charset=utf-8' },
    });
  }

  const settings = site.settings ?? {};
  const description =
    typeof settings.description === 'string' && settings.description.trim()
      ? settings.description.trim()
      : typeof settings.tagline === 'string' && settings.tagline.trim()
        ? settings.tagline.trim()
        : `The official website of ${site.name}.`;

  const policySlug = site.consent?.policyPageSlug;

  const body = `# ${site.name}

> ${description}

## Browse

- [Products](${origin}/products): The full product catalog.
- [Collections](${origin}/collections): Curated groups of products.

## Site

- [Sitemap](${origin}/sitemap.xml): Complete machine-readable index of every product, collection, and page.${
    policySlug
      ? `\n- [Privacy & cookies](${origin}/${policySlug}): How this store handles your data.`
      : ''
  }

## Assistant

- [MCP endpoint](${origin}/mcp): Connect an AI assistant (Model Context Protocol) to browse products, check availability, book appointments, and shop this store.

This store runs on sparx (sparx.works). For the complete, always-current list of URLs, use the sitemap above.
`;

  return new Response(body, {
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      'cache-control': 'public, max-age=3600, stale-while-revalidate=86400',
    },
  });
}
