// Bound product section — domain-aware compatibility/fitment table.

import type { ProductFitmentConfig } from '@wizeworks/sitebuilder-schemas';

import { FitmentTable } from '@/components/fitment-table';
import type { SectionContext } from '../section-renderer';

export function ProductFitmentSection({
  config,
  ctx,
}: {
  config: ProductFitmentConfig;
  ctx: SectionContext;
}) {
  const product = ctx.product;
  if (!product || product.fitments.length === 0) return null;
  const domainsBySlug = ctx.productExtras?.fitmentDomainsBySlug ?? {};
  return (
    <section className="py-16">
      <h2 className="text-base-content mb-4 text-3xl font-semibold tracking-tight">
        {config.heading}
      </h2>
      <FitmentTable fitments={product.fitments} domainsBySlug={domainsBySlug} />
    </section>
  );
}
