import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { buttonClasses } from '@wizeworks/silicaui-react/server';
import { FaqSection } from '@piggles/ui';
import { accountUrl, APP_COUNT_WORD, PRODUCT } from '@piggles/config';
import { PRICE_LABEL } from '@piggles/config/pricing';
import { COMPARISON_BY_SLUG, COMPARISONS } from '@/content/compare';
import { PageHero } from '@/components/marketing/page-hero';
import { CloseBand } from '@/components/marketing/close-band';
import { CompareFigure } from '@/components/marketing/compare/compare-figure';
import { ComparePoints } from '@/components/marketing/compare/compare-points';
import { CompareTable } from '@/components/marketing/compare/compare-table';
import { CompareBill } from '@/components/marketing/compare/compare-bill';
import { CompareMoving } from '@/components/marketing/compare/compare-moving';
import { ComparePick } from '@/components/marketing/compare/compare-pick';
import { CompareSources } from '@/components/marketing/compare/compare-sources';
import { CompareJsonLd } from '@/components/marketing/compare/compare-jsonld';

// /compare/<slug>: Piggles beside one named competitor, told in order. Where
// they win (first, and plainly), the turn, where Piggles fits better, every
// need side by side, how each bill is shaped, moving over, the verdict both
// ways, the questions, and where the facts came from.
//
// Competitor facts: piggles/docs/marketing/COMPETITORS-2026-09-30.md.

export function generateStaticParams() {
  return COMPARISONS.map((c) => ({ slug: c.slug }));
}

export const dynamicParams = false;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const page = COMPARISON_BY_SLUG[slug];
  if (!page) return {};
  return {
    title: `${PRODUCT.name} vs ${page.name}: an honest comparison`,
    description: page.lede,
    keywords: page.searchTerms,
    alternates: { canonical: `/compare/${page.slug}` },
  };
}

export default async function ComparePageRoute({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const page = COMPARISON_BY_SLUG[slug];
  if (!page) notFound();

  return (
    <>
      <CompareJsonLd page={page} />
      <PageHero
        heading={page.heading}
        lede={page.lede}
        figure={<CompareFigure page={page} />}
        assurances={['Free for 14 days', 'No card needed', `All ${APP_COUNT_WORD} apps included`]}
      >
        <a
          className={buttonClasses({ color: 'primary', size: 'lg' })}
          href={accountUrl('signup', `compare-${page.slug}`)}
        >
          Start free for 14 days
        </a>
        <Link className={buttonClasses({ variant: 'outline', size: 'lg' })} href="#side-by-side">
          See every difference
        </Link>
      </PageHero>

      <ComparePoints page={page} />
      <CompareTable page={page} />
      <CompareBill page={page} />
      <CompareMoving page={page} />
      <ComparePick page={page} />
      <FaqSection heading={`Questions about Piggles and ${page.name}`} items={page.questions} />
      <CompareSources page={page} />

      <CloseBand
        heading={`Try Piggles beside ${page.name} for fourteen days, for free.`}
        primary={{
          label: 'Start free for 14 days',
          href: accountUrl('signup', `compare-${page.slug}-close`),
        }}
        secondary={{ label: `What ${PRICE_LABEL} a month includes`, href: '/pricing' }}
        note="No card needed. Nothing to cancel if you decide not to carry on."
      />
    </>
  );
}
