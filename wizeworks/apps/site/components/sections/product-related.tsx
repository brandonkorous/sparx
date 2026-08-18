// Bound product section — a "you may also like" rail of related products.

import type { ProductRelatedConfig } from '@wizeworks/sitebuilder-schemas';

import { ProductCard } from '@/components/product-card';
import type { SectionContext } from '../section-renderer';

export function ProductRelatedSection({
  config,
  ctx,
}: {
  config: ProductRelatedConfig;
  ctx: SectionContext;
}) {
  const related = ctx.productExtras?.related ?? [];
  if (related.length === 0) return null;
  const items = related.slice(0, config.limit);
  return (
    <section className="py-16">
      <div className="mb-7 flex items-end justify-between gap-4">
        <h2 className="text-base-content text-3xl font-semibold tracking-tight">
          {config.heading}
        </h2>
      </div>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(230px,1fr))] gap-[clamp(1rem,2vw,1.75rem)]">
        {items.map((p) => (
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
