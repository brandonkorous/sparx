// The full marketplace product listing (PLP). Faceted, sortable, paginated —
// all state in the URL so every variant is SSR-cacheable (revalidate 60). Search,
// category, price range, in-stock, and sort drive the cross-tenant browse query.

import type { Metadata } from 'next';

import { PlpView } from '@/components/plp-view';
import { Container } from '@/components/ui/layout';
import { parsePlpParams, PLP_PER_PAGE, type RawSearchParams } from '@/lib/plp-params';

export const revalidate = 60;

export async function generateMetadata({
  searchParams,
}: {
  searchParams?: Promise<RawSearchParams>;
}): Promise<Metadata> {
  const sp = (await searchParams) ?? {};
  const q = Array.isArray(sp.q) ? sp.q[0] : sp.q;
  if (q) {
    return {
      title: `Search: ${q}`,
      description: `Products matching “${q}” from independent sellers on sparx.market.`,
    };
  }
  return {
    title: 'Shop all products',
    description:
      'Browse the full sparx.market catalog — thousands of products from independent sellers, faceted by category, price, and availability.',
  };
}

export default async function ProductsPage({
  searchParams,
}: {
  searchParams?: Promise<RawSearchParams>;
}) {
  const sp = (await searchParams) ?? {};
  const { query, facetState } = parsePlpParams(sp);
  const q = facetState.q;

  return (
    <Container className="py-8 md:py-12">
      <header className="mb-8">
        <h1 className="text-[1.75rem] font-bold tracking-[-0.02em] text-[var(--color-text-primary)] md:text-4xl">
          {q ? `Results for “${q}”` : 'All products'}
        </h1>
        <p className="mt-2 max-w-2xl text-base text-[var(--color-text-secondary)]">
          {q
            ? 'Products from independent sellers across the sparx network.'
            : 'Every product on sparx.market, from independent sellers shipping direct.'}
        </p>
      </header>

      <PlpView
        basePath="/products"
        query={query}
        facetState={facetState}
        perPage={PLP_PER_PAGE}
        emptyTitle={q ? `No products match “${q}”` : 'No products found'}
        emptyHint="Try a broader search or clear your filters."
      />
    </Container>
  );
}
