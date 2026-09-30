import { PRODUCT } from '@piggles/config';
import type { TradePage } from '@/content/trades/types';

// Search and answer engines read the questions straight from this graph.

export function TradeJsonLd({ trade }: { trade: TradePage }) {
  const base = `https://${PRODUCT.hosts.marketing}`;
  const url = `${base}/for/${trade.slug}`;
  const graph = [
    {
      '@type': 'WebPage',
      '@id': url,
      url,
      name: trade.heading,
      description: trade.lede,
      about: { '@type': 'SoftwareApplication', name: PRODUCT.name, url: base },
    },
    {
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Who it is for', item: `${base}/who-its-for` },
        { '@type': 'ListItem', position: 2, name: trade.plural, item: url },
      ],
    },
    {
      '@type': 'FAQPage',
      mainEntity: trade.questions.map((f) => ({
        '@type': 'Question',
        name: f.q,
        acceptedAnswer: { '@type': 'Answer', text: f.a },
      })),
    },
  ];
  const json = JSON.stringify({ '@context': 'https://schema.org', '@graph': graph }).replace(
    /</g,
    '\\u003c'
  );
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: json }} />;
}
