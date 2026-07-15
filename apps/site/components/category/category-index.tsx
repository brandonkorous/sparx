// The category index experience as ONE self-contained server component — the pinned
// `commerce.categories` core (docs/122). It lists the root categories (featured first)
// as a card grid, each drilling into /category/[handle]. The /category route drops it
// into an editable silica shell via a host node, so a tenant surrounds the index without
// touching the browse tree. Needs only the resolved site (no URL state).
//
// Extracted verbatim from the old app/category/page.tsx body (only the outer container +
// breadcrumbs stayed on the route).

import { EmptyState } from '@/components/empty-state';
import { listCategories } from '@/lib/commerce';
import type { ResolvedSite } from '@/lib/site-context';

import { CategoryCard } from '@/app/category/_lib/category-card';

export async function CategoryIndex({ site }: { site: ResolvedSite }) {
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
    <>
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
    </>
  );
}
