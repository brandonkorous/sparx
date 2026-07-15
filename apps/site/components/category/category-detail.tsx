// The category DETAIL experience as ONE self-contained server component — the pinned
// `commerce.category-detail` core (docs/122). A category is a browse TREE node (not a flat
// merchandising surface): this shows the category's header, its subcategories, and a ROLLUP
// of every product beneath it (self + descendants), paginated. The /category/[handle] route
// drops it into an editable silica shell via a host node, so a tenant surrounds the browse
// experience (intro copy, promos) without touching the rollup logic. Self-contained: given
// the handle + page, it resolves the category, its lineage, and its products itself.
//
// Extracted from the old app/category/[handle]/page.tsx body (breadcrumbs included, since
// they need the lineage the core already computes). The route keeps the record lookup + the
// 404/redirect guard; this core assumes a resolvable handle and renders an empty notice if
// one ever slips through.

import Image from 'next/image';

import { Breadcrumbs } from '@/components/breadcrumbs';
import { Pagination } from '@/components/pagination';
import { ProductGrid } from '@/components/product-grid';
import { getCategory, listCategories, listCategoryProducts } from '@/lib/commerce';
import { mediaUrl } from '@/lib/media';
import type { ResolvedSite } from '@/lib/site-context';

import { categoryLineage } from '@/app/category/_lib/lineage';
import { CategoryCard } from '@/app/category/_lib/category-card';

const PER_PAGE = 24;

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export async function CategoryDetail({
  site,
  handle,
  searchParams,
}: {
  site: ResolvedSite;
  handle: string;
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const sp = searchParams ?? {};
  const page = Math.max(1, Number(one(sp.page) ?? '1') || 1);

  const category = await getCategory(site.slug, handle);
  if (!category) {
    return <p className="st-muted">This category isn’t available right now.</p>;
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
    <>
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
    </>
  );
}
