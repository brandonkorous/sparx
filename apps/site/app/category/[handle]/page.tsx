// Category detail = a browse node. Unlike a collection (a flat merchandising
// surface rendered through the Site Builder template pipeline), a category is a
// tree node: this page shows the category's own header, its subcategories, and a
// ROLLUP of every product beneath it (self + descendants). Rendered directly —
// categories aren't a customizable layout target — with the same chrome
// (breadcrumbs, metadata, OG, redirects) as every other storefront route.

import type { Metadata } from 'next';
import Image from 'next/image';
import { notFound } from 'next/navigation';

import { Breadcrumbs } from '@/components/breadcrumbs';
import { Pagination } from '@/components/pagination';
import { ProductGrid } from '@/components/product-grid';
import { getCategory, listCategories, listCategoryProducts } from '@/lib/commerce';
import { mediaUrl } from '@/lib/media';
import { ogImageUrl } from '@/lib/og';
import { applyRedirect } from '@/lib/redirects';
import { resolveSite } from '@/lib/site-context';

import { categoryLineage } from '../_lib/lineage';
import { CategoryCard } from '../_lib/category-card';

export const dynamic = 'force-dynamic';

const PER_PAGE = 24;

interface PageProps {
  params: Promise<{ handle: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const site = await resolveSite();
  if (!site) return {};
  const { handle } = await params;
  const category = await getCategory(site.slug, handle);
  if (!category) return {};
  // Author-set OG, then the category hero, then a tenant-branded generated card
  // — so a category always has a real social image.
  const image =
    mediaUrl(category.ogImageId ?? category.heroMediaId ?? null, site.slug) ??
    ogImageUrl({
      title: category.seoTitle ?? category.name,
      eyebrow: 'Category',
      brand: site.name,
      accent: site.theme?.colorPrimary,
    });
  return {
    title: category.seoTitle ?? category.name,
    description: category.seoDescription ?? category.description ?? undefined,
    openGraph: {
      title: category.seoTitle ?? category.name,
      description: category.seoDescription ?? category.description ?? undefined,
      images: [{ url: image }],
    },
  };
}

export default async function CategoryDetailPage({ params, searchParams }: PageProps) {
  const site = await resolveSite();
  if (!site) notFound();
  const { handle } = await params;
  const sp = (await searchParams) ?? {};
  const page = Math.max(1, Number(one(sp.page) ?? '1') || 1);

  const category = await getCategory(site.slug, handle);
  if (!category) {
    await applyRedirect(site.slug, `/category/${handle}`);
    notFound();
  }

  const [all, products] = await Promise.all([
    listCategories(site.slug),
    listCategoryProducts(site.slug, handle, page, PER_PAGE),
  ]);
  const { ancestors, children } = categoryLineage(all, category);
  const { items, total, perPage } = products;
  const { defaultCurrency: currency, defaultLocale: locale } = site.commerce;
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const hero = mediaUrl(category.heroMediaId, site.slug);

  return (
    <div className="st-container">
      <Breadcrumbs
        items={[
          { label: 'Home', href: '/' },
          { label: 'Categories', href: '/category' },
          ...ancestors.map((a) => ({ label: a.name, href: `/category/${a.handle}` })),
          { label: category.name },
        ]}
      />

      <header
        style={{
          position: 'relative',
          borderRadius: 'var(--st-radius-lg)',
          overflow: 'hidden',
          marginBottom: '2rem',
          background: hero ? undefined : 'var(--st-bg-subtle)',
        }}
      >
        {hero ? (
          <Image
            src={hero}
            alt=""
            aria-hidden="true"
            width={1280}
            height={260}
            priority
            sizes="100vw"
            style={{ width: '100%', height: '260px', objectFit: 'cover', display: 'block' }}
          />
        ) : null}
        <div
          style={{
            padding: hero ? '2rem' : '2.5rem 0',
            // Solid scrim (not a gradient) keeps overlaid text legible per the
            // no-gradients rule.
            ...(hero
              ? {
                  position: 'absolute',
                  inset: 'auto 0 0 0',
                  background: 'rgb(0 0 0 / 0.55)',
                  color: '#fff',
                }
              : {}),
          }}
        >
          <h1 className="st-h1" style={hero ? { color: '#fff' } : undefined}>
            {category.name}
          </h1>
          {category.description ? (
            <p style={{ marginTop: '0.5rem', maxWidth: '60ch', lineHeight: 1.6 }}>
              {category.description}
            </p>
          ) : null}
        </div>
      </header>

      {children.length > 0 ? (
        <section style={{ marginBottom: '2.5rem' }}>
          <h2 className="st-h2" style={{ marginBottom: '1rem' }}>
            Browse {category.name}
          </h2>
          <div className="st-grid st-grid--auto">
            {children.map((c) => (
              <CategoryCard key={c.id} category={c} tenantSlug={site.slug} />
            ))}
          </div>
        </section>
      ) : null}

      <section>
        {total > 0 ? (
          <div className="st-toolbar">
            <span className="st-toolbar__count">
              {total} {total === 1 ? 'product' : 'products'}
            </span>
          </div>
        ) : null}

        <ProductGrid
          products={items}
          tenantSlug={site.slug}
          currency={currency}
          locale={locale}
          empty={
            children.length > 0 ? (
              <p className="st-muted">Pick a subcategory above to start browsing.</p>
            ) : undefined
          }
        />

        {totalPages > 1 ? (
          <Pagination
            basePath={`/category/${category.handle}`}
            currentParams={sp}
            page={page}
            totalPages={totalPages}
          />
        ) : null}
      </section>
    </div>
  );
}
