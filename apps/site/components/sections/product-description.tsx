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
    <section className="mx-auto w-full max-w-[68ch] py-16">
      <h2 className="text-base-content mb-4 text-3xl font-semibold tracking-tight">
        {config.heading}
      </h2>
      <div className="sparx-content leading-relaxed whitespace-pre-wrap">{product.description}</div>
    </section>
  );
}
