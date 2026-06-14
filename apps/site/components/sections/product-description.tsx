// Bound product section — the long-form description block (today's "Details").

import type { ProductDescriptionConfig } from '@sparx/sitebuilder-schemas';

import type { SectionContext } from '../section-renderer';

export function ProductDescriptionSection({
  config,
  ctx,
}: {
  config: ProductDescriptionConfig;
  ctx: SectionContext;
}) {
  const product = ctx.product;
  if (!product) return null;
  if (!product.description && config.hideWhenEmpty) return null;
  return (
    <section className="st-section st-container--prose" style={{ paddingInline: 0 }}>
      <h2 className="st-h2" style={{ marginBottom: '1rem' }}>
        {config.heading}
      </h2>
      <div className="sparx-content" style={{ whiteSpace: 'pre-wrap', lineHeight: 1.7 }}>
        {product.description}
      </div>
    </section>
  );
}
