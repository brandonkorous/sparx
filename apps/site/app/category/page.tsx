// Category index — the top level of the browse tree (root categories, featured
// first). Each tile drills into /category/[handle], where its subcategories and
// product rollup live. Hand-composed like the collections index; categories are
// a structural tree, not a customizable layout target.

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { Breadcrumbs } from '@/components/breadcrumbs';
import { EmptyState } from '@/components/empty-state';
import { listCategories } from '@/lib/commerce';
import { resolveSite } from '@/lib/site-context';

import { CategoryCard } from './_lib/category-card';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Categories' };

export default async function CategoryIndexPage() {
  const site = await resolveSite();
  if (!site) notFound();

  const all = await listCategories(site.slug);
  const roots = all
    .filter((c) => c.parentId === null)
    .sort(
      (a, b) =>
        Number(b.featured) - Number(a.featured) ||
        a.position - b.position ||
        a.name.localeCompare(b.name)
    );

  return (
    <div className="st-container">
      <Breadcrumbs items={[{ label: 'Home', href: '/' }, { label: 'Categories' }]} />
      <header style={{ marginBottom: '2rem' }}>
        <h1 className="st-h1">Categories</h1>
        <p className="st-muted" style={{ marginTop: '0.5rem' }}>
          Browse everything at {site.name}.
        </p>
      </header>

      {roots.length === 0 ? (
        <EmptyState
          icon="▤"
          title="No categories yet"
          description="Check back soon, or browse the full catalog."
          action={{ label: 'Shop all products', href: '/products' }}
        />
      ) : (
        <div className="st-grid st-grid--auto">
          {roots.map((c) => (
            <CategoryCard key={c.id} category={c} tenantSlug={site.slug} />
          ))}
        </div>
      )}
    </div>
  );
}
