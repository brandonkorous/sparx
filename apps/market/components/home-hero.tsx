// The marketplace home hero — a shoppable band, not a marketing box. A tight
// benefit headline + primary actions on the left; a live bento mosaic of real
// trending product photos on the right, each linking straight to its PDP with a
// price tag. Leading with actual products (the way Amazon/Etsy do) is what makes
// the surface read as a marketplace instead of a SaaS landing page. Solid fills
// only — the color comes from the product photography.

import Link from 'next/link';
import Image from 'next/image';
import { ArrowRight, ImageOff } from 'lucide-react';
import { MARKET_CATEGORIES } from '@sparx/commerce-schemas';
import { Badge, Button } from 'silicaui-react';

import { formatCents } from '@/lib/format';
import type { ListingCard } from '@/lib/market';

// Bento cell placement for the 5-tile mosaic: one 2×2 feature + four 1×1.
const MOSAIC_SPANS = [
  'col-span-2 row-span-2',
  'col-span-1 row-span-1',
  'col-span-1 row-span-1',
  'col-span-1 row-span-1',
  'col-span-1 row-span-1',
];

function MosaicTile({
  product,
  span,
  priority,
}: {
  product: ListingCard;
  span: string;
  priority: boolean;
}) {
  const price = formatCents(product.priceMinCents, product.currency);
  return (
    <Link
      href={`/products/${product.slug}`}
      aria-label={product.title}
      className={`group relative overflow-hidden rounded-xl bg-[var(--color-bg-subtle)] ${span}`}
    >
      {product.imageUrl ? (
        <Image
          src={product.imageUrl}
          alt={product.title}
          fill
          priority={priority}
          sizes="(min-width: 1024px) 30vw, 50vw"
          className="object-cover transition-transform duration-500 group-hover:scale-[1.05]"
        />
      ) : (
        <span
          className="flex h-full w-full items-center justify-center text-[var(--color-text-tertiary)]"
          aria-hidden
        >
          <ImageOff size={28} />
        </span>
      )}
      <span className="absolute bottom-2 left-2">
        <Badge color="neutral" variant="solid" size="sm">
          {price}
        </Badge>
      </span>
    </Link>
  );
}

/** The 5-up bento mosaic of trending products (desktop) — degrades to a simple
 *  2-up grid when fewer than five photographed products are available. */
function HeroMosaic({ products }: { products: ListingCard[] }) {
  if (products.length >= 5) {
    return (
      <div className="grid aspect-[5/4] grid-cols-4 grid-rows-2 gap-3 md:aspect-[3/2]">
        {products.slice(0, 5).map((product, i) => (
          <MosaicTile
            key={product.slug}
            product={product}
            span={MOSAIC_SPANS[i] ?? 'col-span-1 row-span-1'}
            priority={i === 0}
          />
        ))}
      </div>
    );
  }
  return (
    <div className="grid grid-cols-2 gap-3">
      {products.slice(0, 4).map((product, i) => (
        <div key={product.slug} className="relative aspect-square">
          <MosaicTile product={product} span="absolute inset-0" priority={i === 0} />
        </div>
      ))}
    </div>
  );
}

export function HomeHero({ products }: { products: ListingCard[] }) {
  const withImages = products.filter((p) => p.imageUrl);
  const hasMosaic = withImages.length >= 4;

  return (
    <section className="grid items-center gap-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-12">
      <div className="max-w-xl">
        <h1 className="text-[2.25rem] leading-[1.04] font-bold tracking-[-0.03em] text-[var(--color-text-primary)] md:text-[3rem]">
          Shop thousands of independent sellers.
        </h1>
        <p className="mt-4 text-[1.0625rem] leading-relaxed text-[var(--color-text-secondary)]">
          One cart for the whole network of independent shops on sparx — discover original products
          you won’t find on the big marketplaces, and check out in a single place.
        </p>
        <div className="mt-7 flex flex-wrap gap-3">
          <Button render={<Link href="/products" />} color="primary" variant="solid" size="lg">
            Start browsing
            <ArrowRight size={18} aria-hidden />
          </Button>
          <Button render={<Link href="/merchants" />} color="neutral" variant="soft" size="lg">
            Meet the sellers
          </Button>
        </div>
        <nav aria-label="Shop by category" className="mt-6 flex flex-wrap gap-x-4 gap-y-2 text-sm">
          {MARKET_CATEGORIES.map((category) => (
            <Link
              key={category.slug}
              href={`/${category.slug}`}
              className="font-medium text-[var(--color-text-secondary)] transition-colors hover:text-[var(--sparx-primary)] hover:underline"
            >
              {category.name}
            </Link>
          ))}
        </nav>
      </div>

      {hasMosaic ? <HeroMosaic products={withImages} /> : null}
    </section>
  );
}
