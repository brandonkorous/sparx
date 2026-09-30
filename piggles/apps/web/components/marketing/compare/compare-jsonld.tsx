import { PRODUCT } from '@piggles/config';
import { CHECKED_ON, type ComparePage } from '@/content/compare';

// Search and answer engines read the questions and the date straight from this graph.

export function CompareJsonLd({ page }: { page: ComparePage }) {
  const base = `https://${PRODUCT.hosts.marketing}`;
  const url = `${base}/compare/${page.slug}`;
  const graph = [
    {
      '@type': 'WebPage',
      '@id': url,
      url,
      name: page.heading,
      description: page.lede,
      dateModified: CHECKED_ON,
      about: [
        { '@type': 'SoftwareApplication', name: PRODUCT.name, url: base },
        { '@type': 'SoftwareApplication', name: page.name },
      ],
    },
    {
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Comparisons', item: `${base}/compare` },
        { '@type': 'ListItem', position: 2, name: `Piggles or ${page.name}`, item: url },
      ],
    },
    {
      '@type': 'FAQPage',
      mainEntity: page.questions.map((f) => ({
        '@type': 'Question',
        name: f.q,
        acceptedAnswer: { '@type': 'Answer', text: f.a },
      })),
    },
  ];
  const json = JSON.stringify({ '@context': 'https://schema.org', '@graph': graph }).replace(
    /</g,
    '\u003c'
  );
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: json }} />;
}
