// The "What it fits" block on a product page: the makes, models and engines (or
// whatever the shop's fit domain uses) this product's fit rules name.
//
// The table itself was built long ago and lived in the previous generation's
// product body. When product pages became silica templates nothing placed it, so a
// live product page never said what the part fits (sparx persona issue 126). This
// core is how a template places it.

import { FitmentTable } from '@/components/fitment-table';
import { getProduct, listFitmentDomains, type PublicFitmentDomain } from '@/lib/commerce';

export interface ProductFitmentCoreProps {
  tenantSlug: string;
  /** The in-scope product's URL handle, from the route's record context. */
  handle: string;
  heading: string;
}

export async function ProductFitmentCore({ tenantSlug, handle, heading }: ProductFitmentCoreProps) {
  // No handle: placed on a page that is not a product template. Nothing to say.
  if (!handle) return null;

  const product = await getProduct(tenantSlug, handle);
  // No fit rules: a T-shirt, a fuel additive, a gift card. An empty "What it fits"
  // heading would read as "fits nothing", which is a different and false claim.
  if (!product || product.fitments.length === 0) return null;

  const domains = await listFitmentDomains(tenantSlug).catch<PublicFitmentDomain[]>(() => []);
  const domainsBySlug = Object.fromEntries(domains.map((d) => [d.slug, d]));

  return (
    <section className="py-12">
      <h2 className="text-base-content mb-4 text-2xl font-semibold tracking-tight">{heading}</h2>
      <FitmentTable fitments={product.fitments} domainsBySlug={domainsBySlug} />
    </section>
  );
}
