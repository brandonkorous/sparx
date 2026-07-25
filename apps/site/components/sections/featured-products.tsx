// Featured products section — a grid of product tiles sourced from a
// collection, the newest published products, or a hand-picked list. Reuses the
// shared ProductCard so theming + sale/stock badges stay consistent with the
// PLP. Async server component (fetches from the public commerce API).

import type { FeaturedProductsConfig } from '@sparx/sitebuilder-schemas';

import {
  listProducts,
  listCollections,
  listCollectionProducts,
  getProductsByIds,
  type PublicProductListItem,
} from '@/lib/commerce';
import { ProductCard } from '@/components/product-card';
import type { SectionContext } from '../section-renderer';

// Fixed-column grid at md+ (mobile stays single-column). Literal class strings so
// Tailwind emits them (a `md:grid-cols-${n}` template would scan to nothing).
const GRID_COLS: Record<number, string> = {
  1: 'md:grid-cols-1',
  2: 'md:grid-cols-2',
  3: 'md:grid-cols-3',
  4: 'md:grid-cols-4',
  5: 'md:grid-cols-5',
  6: 'md:grid-cols-6',
};

async function resolveProducts(
  config: FeaturedProductsConfig,
  tenantSlug: string
): Promise<PublicProductListItem[]> {
  if (config.source === 'manual') {
    const items = await getProductsByIds(tenantSlug, config.productIds);
    return items.slice(0, config.limit);
  }
  if (config.source === 'collection' && config.collectionId) {
    // The public collection-products read keys on handle; resolve the
    // configured collection id → handle (collections are few per store).
    const collections = await listCollections(tenantSlug).catch(() => []);
    const match = collections.find((c) => c.id === config.collectionId);
    if (!match) return [];
    const { items } = await listCollectionProducts(tenantSlug, match.handle, 1, config.limit).catch(
      () => ({ items: [] as PublicProductListItem[], total: 0, page: 1, perPage: config.limit })
    );
    return items;
  }
  // newest (and the collection fallback when no collection is configured)
  const { items } = await listProducts(tenantSlug, {
    sort: 'newest',
    perPage: config.limit,
  }).catch(() => ({
    items: [] as PublicProductListItem[],
    total: 0,
    page: 1,
    perPage: config.limit,
  }));
  return items;
}

export async function FeaturedProductsSection({
  config,
  ctx,
}: {
  config: FeaturedProductsConfig;
  ctx: SectionContext;
}) {
  const products = await resolveProducts(config, ctx.tenantSlug);
  if (products.length === 0) return null;

  return (
    <section className="mx-auto w-full max-w-6xl px-6 py-16">
      {config.heading ? (
        <div className="mb-7 flex items-end justify-between gap-4">
          <h2 className="text-base-content text-3xl font-semibold tracking-tight">
            {config.heading}
          </h2>
        </div>
      ) : null}
      <div className={`grid grid-cols-1 gap-8 ${GRID_COLS[config.columns] ?? 'md:grid-cols-3'}`}>
        {products.map((p) => (
          <ProductCard
            key={p.id}
            product={p}
            tenantSlug={ctx.tenantSlug}
            currency={ctx.currency}
            locale={ctx.locale}
          />
        ))}
      </div>
    </section>
  );
}
