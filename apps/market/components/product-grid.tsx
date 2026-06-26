// Renders a responsive grid of product cards from resolved ListingCards, or an
// empty state when there are none. A thin server component shared by the PLP,
// category pages, merchant profiles, and the homepage strips.

import Link from 'next/link';
import { PackageOpen } from 'lucide-react';
import { Button } from '@sparx/ui';

import { ProductCard } from './product-card';
import { toProductCardData, type ListingCard } from '@/lib/market';

export function ProductGrid({
  products,
  emptyTitle = 'No products found',
  emptyHint = 'Try clearing a filter or browsing another category.',
  showBrowseCta = false,
}: {
  products: ListingCard[];
  emptyTitle?: string;
  emptyHint?: string;
  showBrowseCta?: boolean;
}) {
  if (products.length === 0) {
    return (
      <div className="mx-empty">
        <span className="mx-empty__icon" aria-hidden>
          <PackageOpen size={40} />
        </span>
        <p className="mx-empty__title">{emptyTitle}</p>
        <p>{emptyHint}</p>
        {showBrowseCta ? (
          <Button asChild color="primary" variant="soft" size="sm">
            <Link href="/products">Browse all products</Link>
          </Button>
        ) : null}
      </div>
    );
  }

  return (
    <div className="mx-grid">
      {products.map((product) => (
        <ProductCard key={product.slug} product={toProductCardData(product)} />
      ))}
    </div>
  );
}
