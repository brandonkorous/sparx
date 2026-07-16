'use client';

// Favorites (wishlist) page. Client-only — reads the saved product slugs from
// localStorage and resolves them to cards via the market by-slugs endpoint. Stays
// in sync as hearts toggle anywhere (the favorites store broadcasts changes).

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { HeartCrack, Loader2 } from 'lucide-react';
import { Button, EmptyState } from '@wizeworks/silicaui-react';

import { ProductCard, type ProductCardData } from '@/components/product-card';
import { CardGrid, Container } from '@/components/ui/layout';
import { fetchFavoriteListings, useFavorites } from '@/lib/favorites-client';

export default function FavoritesPage() {
  const slugs = useFavorites();
  const [items, setItems] = useState<ProductCardData[] | null>(null);

  useEffect(() => {
    let active = true;
    if (slugs.length === 0) {
      setItems([]);
      return;
    }
    void fetchFavoriteListings(slugs).then((r) => {
      if (active) setItems(r);
    });
    return () => {
      active = false;
    };
  }, [slugs]);

  return (
    <Container className="py-8 md:py-12">
      <header className="mb-8">
        <h1 className="text-base-content text-[1.75rem] font-bold tracking-[-0.02em] md:text-4xl">
          Your favorites
        </h1>
        <p className="text-base-content mt-2 max-w-2xl text-base">
          Products you’ve saved from across the marketplace. Saved on this device.
        </p>
      </header>

      {items === null ? (
        <div className="text-base-content flex items-center justify-center gap-2 py-20">
          <Loader2 size={20} className="animate-spin" aria-hidden />
          Loading your favorites…
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={<HeartCrack size={40} aria-hidden />}
          title="No favorites yet"
          description="Tap the heart on any product to save it here for later."
          actions={
            <Button render={<Link href="/products" />} color="primary" variant="soft" size="sm">
              Browse the marketplace
            </Button>
          }
        />
      ) : (
        <CardGrid>
          {items.map((product) => (
            <ProductCard key={product.slug} product={product} />
          ))}
        </CardGrid>
      )}
    </Container>
  );
}
