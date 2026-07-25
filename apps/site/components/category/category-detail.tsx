// The category DETAIL experience as ONE self-contained server component — the pinned
// `commerce.category-detail` core (docs/122 + docs/127 §8). A category is a browse TREE
// node (not a flat merchandising surface): this shows the category's header, its
// subcategories, and a ROLLUP of every product beneath it (self + descendants) as a
// FACETED, sortable, paginated grid — the same `ScopedProductBrowser` the PLP and
// collection detail use, scoped to this category. The /category/[handle] route drops it
// into an editable silica shell via a host node, so a tenant surrounds the browse
// experience (intro copy, promos) without touching the rollup logic. Self-contained: given
// the handle + search params, it resolves the category, its lineage, and its filtered page.
//
// The facet/sort/pagination used to be a bare grid + pager here; it now shares the one
// browser implementation (docs/127 §8), so a deep category is genuinely shoppable.

import Image from 'next/image';

import { Breadcrumbs } from '@/components/breadcrumbs';
import {
  ScopedProductBrowser,
  type SearchParams,
} from '@/components/products/scoped-product-browser';
import { getCategory, listCategories } from '@/lib/commerce';
import { mediaUrl } from '@/lib/media';
import type { ResolvedSite } from '@/lib/site-context';

import { categoryLineage } from '@/app/category/_lib/lineage';
import { CategoryCard } from '@/app/category/_lib/category-card';

export async function CategoryDetail({
  site,
  handle,
  searchParams,
}: {
  site: ResolvedSite;
  handle: string;
  searchParams?: SearchParams;
}) {
  const sp = searchParams ?? {};

  const category = await getCategory(site.slug, handle);
  if (!category) {
    return <p className="text-base-content">This category isn’t available right now.</p>;
  }

  const all = await listCategories(site.slug);
  const { ancestors, children } = categoryLineage(all, category);
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
        className={
          hero
            ? 'rounded-box relative mb-8 overflow-hidden'
            : 'rounded-box bg-base-200 relative mb-8 overflow-hidden'
        }
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
          <h1
            className="text-4xl font-semibold tracking-tight"
            style={hero ? { color: '#fff' } : undefined}
          >
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
          <h2
            className="text-base-content text-3xl font-semibold tracking-tight"
            style={{ marginBottom: '1rem' }}
          >
            Browse {category.name}
          </h2>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(230px,1fr))] gap-[clamp(1rem,2vw,1.75rem)]">
            {children.map((c) => (
              <CategoryCard key={c.id} category={c} tenantSlug={site.slug} />
            ))}
          </div>
        </section>
      ) : null}

      {/* The category's product ROLLUP (self + descendants), faceted + sorted + paged by
          the shared browser scoped to this category handle. */}
      <ScopedProductBrowser
        site={site}
        searchParams={sp}
        basePath={`/category/${category.handle}`}
        scope={{ category: category.handle }}
      />
    </>
  );
}
