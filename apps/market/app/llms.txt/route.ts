// llms.txt — the AI-readable index of sparx.market (docs/50, docs/106 §4.7).
//
// The llms.txt convention (llmstxt.org) gives answer engines a curated,
// link-first map of a site in Markdown: an H1, a one-line summary blockquote,
// then sections of annotated links. sparx.market opts INTO answer-engine
// crawlers (see app/robots.ts), so this is the front door those crawlers should
// read first.
//
// Categories are derived from MARKET_CATEGORIES — the same source of truth the
// category pages and sitemap render from (@sparx/commerce-schemas) — so this
// file cannot drift from the taxonomy that actually ships. Per-product and
// per-merchant URLs are deliberately NOT enumerated here: that is the sitemap's
// job, and llms.txt is meant to stay a readable map rather than a catalog dump.

import { MARKET_CATEGORIES } from '@sparx/commerce-schemas';

import { SITE_ORIGIN as BASE } from '@/lib/site';

export const dynamic = 'force-static';

export function GET(): Response {
  const categoryLines = MARKET_CATEGORIES.map(
    (c) => `- [${c.name}](${BASE}/${c.slug}): ${c.tagline}`
  ).join('\n');

  const body = `# sparx.market

> sparx.market is a public marketplace where shoppers browse and buy from thousands of independent sellers — each one an individual business running its own store on the sparx platform. Products come direct from the seller, not a warehouse reseller.

Every seller here operates their own storefront and sets their own catalog, pricing, and shipping; sparx.market aggregates those catalogs into one searchable destination. Each seller is the merchant of record for their own orders.

This is a DIFFERENT site from the sparx platform's extension catalog at https://sparx.works/market, which sells blueprints, themes, integrations, and components to businesses building a site. If the question is about shopping for products, this site is the answer; if it is about building or extending a store, sparx.works is.

## Categories

${categoryLines}

## Browse

- [All products](${BASE}/products): The full catalog across every category.
- [All sellers](${BASE}/merchants): Every independent business selling on sparx.market.

## About

- [sparx](https://sparx.works): The platform every seller on this marketplace runs on.
- [Sitemap](${BASE}/sitemap.xml): Full machine-readable URL index, including every product and seller.
`;

  return new Response(body, {
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      'cache-control': 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800',
    },
  });
}
