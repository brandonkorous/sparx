import { PRODUCT } from '@piggles/config';
import type { PigglesTool } from './registry';
import { searchTitleFor } from './tool-metadata';
import { toolFaqs } from './tool-content';

/**
 * The machine-readable version of the page.
 *
 * Three graphs, each earning its place:
 *
 * • **WebApplication** — what the thing IS. `offers` at price 0 is the part
 * that matters: "free" in a description is marketing, ` "price": "0"` is a
 * fact a search engine will show, and these tools genuinely are free with no
 * account, so it is a claim we are entitled to make.
 * • **BreadcrumbList** — puts "Free tools › Favicon maker" under the result
 * instead of a bare URL, and tells a crawler the hub is the parent.
 * • **FAQPage** — the questions can be shown, unfolded, directly in the search
 * result. Only emitted when there are real questions with real answers,
 * because an FAQ graph whose answers are filler is the kind of markup that
 * earns a manual penalty.
 *
 * Written as one `@graph` in one script tag rather than three tags: same result
 * for every consumer, and it makes it obvious that these describe one page.
 *
 * ── ON `dangerouslySetInnerHTML` ────────────────────────────────────────────
 *
 * It is the only way to emit a JSON-LD script tag in React, and it is safe here
 * because every value comes from the registry — no user input reaches it. The
 * `<` escape is still applied, since JSON.stringify will happily produce a
 * `</script>` sequence out of an innocent string and end the tag early.
 */
export function ToolJsonLd({ tool }: { tool: PigglesTool }) {
  const url = `https://${PRODUCT.hosts.marketing}/tools/${tool.slug}`;
  const faqs = toolFaqs(tool.slug);

  const graph: Record<string, unknown>[] = [
    {
      '@type': 'WebApplication',
      name: searchTitleFor(tool),
      alternateName: tool.name,
      url,
      description: tool.description,
      applicationCategory: 'BusinessApplication',
      // It runs in a browser and needs nothing installed. Both of these are
      // literally true of every tool here, which is why they can be asserted.
      operatingSystem: 'Any',
      browserRequirements: 'Requires JavaScript',
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
      isAccessibleForFree: true,
      publisher: {
        '@type': 'Organization',
        name: PRODUCT.name,
        url: `https://${PRODUCT.hosts.marketing}`,
      },
    },
    {
      '@type': 'BreadcrumbList',
      itemListElement: [
        {
          '@type': 'ListItem',
          position: 1,
          name: 'Free tools',
          item: `https://${PRODUCT.hosts.marketing}/tools`,
        },
        { '@type': 'ListItem', position: 2, name: tool.name, item: url },
      ],
    },
  ];

  if (faqs.length > 0) {
    graph.push({
      '@type': 'FAQPage',
      mainEntity: faqs.map((f) => ({
        '@type': 'Question',
        name: f.q,
        acceptedAnswer: { '@type': 'Answer', text: f.a },
      })),
    });
  }

  const json = JSON.stringify({ '@context': 'https://schema.org', '@graph': graph }).replace(
    /</g,
    '\\u003c'
  );

  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: json }} />;
}

/** The hub's own graph — an ItemList of all seventeen, so the collection can be
 * understood as a collection rather than as seventeen unrelated pages. */
export function ToolsIndexJsonLd({ tools }: { tools: readonly PigglesTool[] }) {
  const json = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: `Free tools from ${PRODUCT.name}`,
    numberOfItems: tools.length,
    itemListElement: tools.map((t, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: t.name,
      description: t.tagline,
      url: `https://${PRODUCT.hosts.marketing}/tools/${t.slug}`,
    })),
  }).replace(/</g, '\\u003c');

  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: json }} />;
}
