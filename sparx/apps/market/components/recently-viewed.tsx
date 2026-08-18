'use client';

// The "Recently viewed" home rail — the marketplace's guest personalization. Reads
// the localStorage view history and hydrates it to cards via the by-slugs proxy.
// Renders nothing for a first-time visitor (empty history), so it never leaves a
// gap on the page. Stays live as the shopper browses in another tab.

import { useEffect, useState } from 'react';

import { ProductCard, type ProductCardData } from '@/components/product-card';
import { RAIL_ITEM_CLASS, ScrollRail, SectionHeading } from '@/components/home-sections';
import { fetchListingsBySlugs } from '@/lib/listings-client';
import { useRecentlyViewed } from '@/lib/recently-viewed-client';

const RAIL_LIMIT = 12;

export function RecentlyViewed() {
  const slugs = useRecentlyViewed();
  const [items, setItems] = useState<ProductCardData[] | null>(null);

  useEffect(() => {
    if (slugs.length === 0) {
      setItems([]);
      return;
    }
    let active = true;
    void fetchListingsBySlugs(slugs.slice(0, RAIL_LIMIT)).then((r) => {
      if (active) setItems(r);
    });
    return () => {
      active = false;
    };
  }, [slugs]);

  if (!items || items.length === 0) return null;

  return (
    <section>
      <SectionHeading
        title="Recently viewed"
        sub="Pick up where you left off."
        href="/products"
        linkLabel="Browse all"
      />
      <ScrollRail>
        {items.map((product) => (
          <div key={product.slug} className={RAIL_ITEM_CLASS}>
            <ProductCard product={product} />
          </div>
        ))}
      </ScrollRail>
    </section>
  );
}
