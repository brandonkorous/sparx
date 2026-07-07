// The marketplace home hero — a shoppable band, not a marketing box. When enough
// photographed products are available it's two columns: benefit copy + actions on
// the left, a live bento mosaic of real trending products (each linking to its PDP
// with a price tag) on the right. When imagery is thin it falls back to a single
// CENTERED hero rather than stranding the copy in an empty half. Solid fills only —
// the color comes from the product photography.

import Link from 'next/link';
import Image from 'next/image';
import { ArrowRight, ImageOff } from 'lucide-react';
import { MARKET_CATEGORIES } from '@sparx/commerce-schemas';
import { Badge, Button } from 'silicaui-react';
import { cx } from 'silicaui-react/server';

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
      className={`group bg-base-200 relative overflow-hidden rounded-xl ${span}`}
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
          className="text-base-content/50 flex h-full w-full items-center justify-center"
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

/** The hero copy block — left-aligned beside the mosaic, or centered on its own. */
function HeroCopy({ centered }: { centered: boolean }) {
  return (
    <div className={centered ? 'mx-auto max-w-2xl text-center' : 'max-w-xl'}>
      <h1 className="text-base-content text-[2.25rem] leading-[1.04] font-bold tracking-[-0.03em] md:text-[3rem]">
        Shop thousands of independent sellers.
      </h1>
      <p className="text-base-content/70 mt-4 text-[1.0625rem] leading-relaxed">
        One cart for the whole network of independent shops on sparx — discover original products
        you won’t find on the big marketplaces, and check out in a single place.
      </p>
      <div className={cx('mt-7 flex flex-wrap gap-3', centered && 'justify-center')}>
        <Button render={<Link href="/products" />} color="primary" variant="solid" size="lg">
          Start browsing
          <ArrowRight size={18} aria-hidden />
        </Button>
        <Button render={<Link href="/merchants" />} color="neutral" variant="soft" size="lg">
          Meet the sellers
        </Button>
      </div>
      <nav
        aria-label="Shop by category"
        className={cx('mt-6 flex flex-wrap gap-x-4 gap-y-2 text-sm', centered && 'justify-center')}
      >
        {MARKET_CATEGORIES.map((category) => (
          <Link
            key={category.slug}
            href={`/${category.slug}`}
            className="text-base-content/70 hover:text-primary font-medium transition-colors hover:underline"
          >
            {category.name}
          </Link>
        ))}
      </nav>
    </div>
  );
}

export function HomeHero({ products }: { products: ListingCard[] }) {
  const withImages = products.filter((p) => p.imageUrl);

  // Not enough photography for a balanced two-column hero → center the copy rather
  // than leaving it stranded against an empty right half.
  if (withImages.length < 4) {
    return (
      <section className="py-6 md:py-10">
        <HeroCopy centered />
      </section>
    );
  }

  return (
    <section className="grid items-center gap-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-12">
      <HeroCopy centered={false} />
      <HeroMosaic products={withImages} />
    </section>
  );
}
