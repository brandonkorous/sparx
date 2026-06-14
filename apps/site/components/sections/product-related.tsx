// Bound product section — a "you may also like" rail of related products.

import type { ProductRelatedConfig } from '@sparx/sitebuilder-schemas';

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
    <section className="st-section">
      <div className="st-section__head">
        <h2 className="st-h2">{config.heading}</h2>
      </div>
      <div className="st-grid">
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
