// Category landing page (/auto, /beauty, …). A real, indexed page that always
// renders its SEO hero (name / tagline / description from MARKET_CATEGORIES) even
// with zero products, plus a faceted product grid scoped to the category. Slugs
// that aren't a market category 404.

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getMarketCategory, MARKET_CATEGORIES } from '@sparx/commerce-schemas';

import { CategoryIcon } from '@/components/category-icon';
import { PlpView } from '@/components/plp-view';
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
    <div className="mx-container">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(collectionJsonLd) }}
      />

      <section className="mx-section" style={{ paddingBottom: 0 }}>
        <div className="mx-hero">
          <span className="mx-cat-tile__icon">
            <CategoryIcon name={category.icon} size={22} />
          </span>
          <h1 className="mx-hero__title" style={{ marginTop: '1rem' }}>
            {category.name}
          </h1>
          <p className="mx-hero__lead">{category.tagline}</p>
        </div>
      </section>

      <div className="mx-section" style={{ paddingTop: '1.5rem' }}>
        <PlpView
          basePath={`/${category.slug}`}
          searchParams={sp}
          query={query}
          facetState={facetState}
          perPage={PLP_PER_PAGE}
          lockCategory
          emptyTitle={`No ${category.name} products yet`}
          emptyHint="Check back soon — sellers are listing in this category all the time."
        />
      </div>
    </div>
  );
}
