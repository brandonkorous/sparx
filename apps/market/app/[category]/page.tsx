// Category landing page (/auto, /beauty, …). A real, indexed page that always
// renders its SEO hero (name / tagline / description from MARKET_CATEGORIES) even
// with zero products, plus a faceted product grid scoped to the category. Slugs
// that aren't a market category 404.

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getMarketCategory, MARKET_CATEGORIES } from '@sparx/commerce-schemas';

import { CategoryIcon } from '@/components/category-icon';
import { PlpView } from '@/components/plp-view';
import { Container } from '@/components/ui/layout';
import { parsePlpParams, PLP_PER_PAGE, type RawSearchParams } from '@/lib/plp-params';

export const revalidate = 60;

interface PageProps {
  params: Promise<{ category: string }>;
  searchParams?: Promise<RawSearchParams>;
}

// Pre-render one static page per category (they're a small fixed set).
export function generateStaticParams() {
  return MARKET_CATEGORIES.map((category) => ({ category: category.slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { category: slug } = await params;
  const category = getMarketCategory(slug);
  if (!category) return {};
  return {
    title: category.name,
    description: category.description,
    alternates: { canonical: `/${category.slug}` },
    openGraph: {
      title: `${category.name} · sparx.market`,
      description: category.description,
      url: `/${category.slug}`,
    },
  };
}

export default async function CategoryPage({ params, searchParams }: PageProps) {
  const { category: slug } = await params;
  const category = getMarketCategory(slug);
  if (!category) notFound();

  const sp = (await searchParams) ?? {};
  const { query, facetState } = parsePlpParams(sp, category.slug);

  const collectionJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: category.name,
    description: category.description,
    url: `https://sparx.market/${category.slug}`,
  };

  return (
    <Container>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(collectionJsonLd) }}
      />

      <section className="pt-8 pb-6 md:pt-12">
        <div className="border-base-300 bg-base-100 rounded-2xl border px-6 py-10 md:px-10 md:py-12">
          <span className="text-primary bg-primary/10 inline-flex h-12 w-12 items-center justify-center rounded-xl">
            <CategoryIcon name={category.icon} size={22} />
          </span>
          <h1 className="mt-4 max-w-2xl text-[2rem] leading-[1.05] font-bold tracking-[-0.03em] md:text-[3rem]">
            {category.name}
          </h1>
          <p className="mt-3 max-w-xl text-[1.0625rem] leading-relaxed">{category.tagline}</p>
        </div>
      </section>

      <div className="pb-12">
        <PlpView
          basePath={`/${category.slug}`}
          query={query}
          facetState={facetState}
          perPage={PLP_PER_PAGE}
          lockCategory
          emptyTitle={`No ${category.name} products yet`}
          emptyHint="Check back soon — sellers are listing in this category all the time."
        />
      </div>
    </Container>
  );
}
