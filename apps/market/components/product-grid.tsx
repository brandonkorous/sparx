// Renders a responsive grid of product cards from resolved ListingCards, or a
// silicaui <EmptyState> when there are none. A thin server component shared by
// the PLP, category pages, merchant profiles, and the homepage strips.

import Link from 'next/link';
import { PackageOpen } from 'lucide-react';
import { Button, EmptyState } from 'silicaui-react';

import { ProductCard } from './product-card';
import { CardGrid } from '@/components/ui/layout';
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
      <EmptyState
        icon={<PackageOpen size={40} aria-hidden />}
        title={emptyTitle}
        description={emptyHint}
        actions={
          showBrowseCta ? (
            <Button render={<Link href="/products" />} color="primary" variant="soft" size="sm">
              Browse all products
            </Button>
          ) : undefined
        }
      />
    );
  }

  return (
    <CardGrid>
      {products.map((product) => (
        <ProductCard key={product.slug} product={toProductCardData(product)} />
      ))}
    </CardGrid>
  );
}
