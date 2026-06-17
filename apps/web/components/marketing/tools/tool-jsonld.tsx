import type { ToolMeta } from './registry';
import { getToolContent } from './tool-content';
import { getToolSeo } from './tool-seo';

/**
 * All of a tool page's structured data in one place. Tool pages live or die in
 * search and AI answers on whether engines understand "this is a free web tool
 * that does X":
 *
 *  - WebApplication — what the page IS (a free, browser-based business tool).
 *  - BreadcrumbList — the Home › Free tools › Tool trail (SERP breadcrumbs).
 *  - HowTo — the ordered steps (also rendered visibly by ToolLearn).
 *  - FAQPage — the questions (also rendered visibly as <details>).
 *
 * Multiple JSON-LD blocks on one page are valid; engines merge them.
 */
export function ToolJsonLd({ tool }: { tool: ToolMeta }) {
  const content = getToolContent(tool.slug);
  const seo = getToolSeo(tool.slug);
  const url = `https://sparx.works/tools/${tool.slug}`;

  const blocks: { key: string; data: object }[] = [
    {
      key: 'webapp',
      data: {
        '@context': 'https://schema.org',
        '@type': 'WebApplication',
        name: tool.name,
        url,
        description: seo?.answer ?? tool.description,
        applicationCategory: 'BusinessApplication',
        operatingSystem: 'Any (web browser)',
        browserRequirements: 'Requires a modern web browser with JavaScript',
        isAccessibleForFree: true,
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
        featureList: tool.keywords,
        provider: { '@type': 'Organization', name: 'sparx', url: 'https://sparx.works' },
      },
    },
    {
      key: 'breadcrumb',
      data: {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://sparx.works' },
          { '@type': 'ListItem', position: 2, name: 'Free tools', item: 'https://sparx.works/tools' },
          { '@type': 'ListItem', position: 3, name: tool.name, item: url },
        ],
      },
    },
  ];

  if (seo?.howTo) {
    blocks.push({
      key: 'howto',
      data: {
        '@context': 'https://schema.org',
        '@type': 'HowTo',
        name: seo.howTo.name,
        step: seo.howTo.steps.map((s, i) => ({
          '@type': 'HowToStep',
          position: i + 1,
          name: s.name,
          text: s.text,
        })),
      },
    });
  }

  if (content?.faq.length) {
    blocks.push({
      key: 'faq',
      data: {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: content.faq.map((item) => ({
          '@type': 'Question',
          name: item.q,
          acceptedAnswer: { '@type': 'Answer', text: item.a },
        })),
      },
    });
  }

  return (
    <>
      {blocks.map((block) => (
        <script
          key={block.key}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(block.data) }}
        />
      ))}
    </>
  );
}
