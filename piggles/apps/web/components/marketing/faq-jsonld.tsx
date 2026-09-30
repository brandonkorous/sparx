import { PRODUCT } from '@piggles/config';

// A page's questions as FAQPage structured data, so search and answer engines
// read them as questions and answers rather than guessing from the markup.
// The trade and comparison pages build their own graph with a breadcrumb; this
// is the plain form for a page that only needs the questions.

export function FaqJsonLd({
  path,
  name,
  items,
}: {
  path: string;
  name: string;
  items: { q: string; a: string }[];
}) {
  const url = `https://${PRODUCT.hosts.marketing}${path}`;
  const graph = [
    { '@type': 'WebPage', '@id': url, url, name },
    {
      '@type': 'FAQPage',
      mainEntity: items.map((f) => ({
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
