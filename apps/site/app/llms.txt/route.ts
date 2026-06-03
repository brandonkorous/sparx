// Per-tenant llms.txt — the AI-readable index of a tenant storefront (docs/50).
//
// The llms.txt convention (llmstxt.org) hands answer engines and agents a
// curated, link-first map of the site in Markdown. For a storefront that's the
// store identity plus the navigational entry points and a pointer to the full
// machine-readable sitemap (which already enumerates every product, collection,
// and page). Tenant resolved from the Host header, same as robots.txt/sitemap.xml.

import { resolveTenant } from '@/lib/tenant';

export const dynamic = 'force-dynamic';
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

  const tenant = await resolveTenant();
  if (!tenant) {
    return new Response('# Unknown store\n', {
      status: 404,
      headers: { 'content-type': 'text/plain; charset=utf-8' },
    });
  }

  const settings = tenant.settings ?? {};
  const description =
    typeof settings.description === 'string' && settings.description.trim()
      ? settings.description.trim()
      : typeof settings.tagline === 'string' && settings.tagline.trim()
        ? settings.tagline.trim()
        : `${tenant.name} — an online store powered by Sparx.`;

  const policySlug = tenant.consent?.policyPageSlug;

  const body = `# ${tenant.name}

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

This store runs on Sparx (sparx.works). For the complete, always-current list of URLs, use the sitemap above.
`;

  return new Response(body, {
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      'cache-control': 'public, max-age=3600, stale-while-revalidate=86400',
    },
  });
}
