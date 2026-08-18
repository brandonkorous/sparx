// The marketplace home hero — a warm, welcoming band: benefit copy + actions +
// live trust stats on one side, a tall PORTRAIT photograph of a real independent
// seller on the other, so the very first thing a shopper sees is a person, not a
// grid. The surface is a bold solid sparx pink (secondary) — energetic and warm,
// never a gradient. White inks (secondary-content) ride the pink. The product
// catalog leads the sections immediately below; the hero sets the tone.

import Link from 'next/link';
import Image from 'next/image';
import { ArrowRight } from 'lucide-react';
import { MARKET_CATEGORIES } from '@wizeworks/commerce-schemas';
import { Button } from '@wizeworks/silicaui-react';

import { Container } from '@/components/ui/layout';
import { HERO_IMAGE, HERO_ALT } from '@/lib/editorial';

/** A live trust stat ("2,480+ products"), or a graceful generic when the count is
 *  not yet known. Real numbers earn more trust than round marketing claims. */
function statLabel(count: number | undefined, noun: string, fallback: string): string {
  return count && count > 0 ? `${count.toLocaleString()}+ ${noun}` : fallback;
}

/** The hero copy block — on the pink band, so its inks are the light
 *  secondary-content ramp (never base-content, which would vanish on the fill). */
function HeroCopy({ productCount, sellerCount }: { productCount?: number; sellerCount?: number }) {
  return (
    <div className="max-w-xl">
      <h1 className="text-secondary-content text-[2.5rem] leading-[1.03] font-bold tracking-[-0.03em] md:text-[3.25rem]">
        Shop thousands of independent sellers.
      </h1>
      <p className="text-secondary-content/90 mt-5 text-[1.0625rem] leading-relaxed">
        One cart for the whole network of independent shops on sparx — discover original products
        you won’t find on the big marketplaces, and check out in a single place.
      </p>
      <div className="mt-7 flex flex-wrap items-center gap-x-5 gap-y-3">
        <Button render={<Link href="/products" />} color="neutral" variant="solid" size="lg">
          Start browsing
          <ArrowRight size={18} aria-hidden />
        </Button>
        <Link
          href="/merchants"
          className="text-secondary-content inline-flex items-center gap-1.5 text-[0.9375rem] font-semibold underline-offset-4 hover:underline"
        >
          Meet the sellers
          <ArrowRight size={16} aria-hidden />
        </Link>
      </div>

      {/* Live trust stats — real catalog + seller counts when available. */}
      <div className="text-secondary-content/80 mt-7 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-sm">
        <span className="text-secondary-content font-semibold">
          {statLabel(productCount, 'products', 'Thousands of products')}
        </span>
        <span aria-hidden>·</span>
        <span className="text-secondary-content font-semibold">
          {statLabel(sellerCount, 'independent shops', 'Hundreds of independent shops')}
        </span>
        <span aria-hidden>·</span>
        <span>Ships direct</span>
      </div>

      {/* Category quick-links as pills — legible on the pink band. */}
      <nav aria-label="Shop by category" className="mt-7 flex flex-wrap gap-2">
        {MARKET_CATEGORIES.map((category) => (
          <Link
            key={category.slug}
            href={`/${category.slug}`}
            className="bg-secondary-content/15 text-secondary-content hover:bg-secondary-content/25 rounded-full px-3 py-1.5 text-sm font-medium transition-colors"
          >
            {category.name}
          </Link>
        ))}
      </nav>
    </div>
  );
}

export function HomeHero({
  productCount,
  sellerCount,
}: {
  productCount?: number;
  sellerCount?: number;
}) {
  return (
    <section className="bg-secondary text-secondary-content">
      <Container className="py-12 md:py-16">
        <div className="grid items-center gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.82fr)] lg:gap-14">
          <HeroCopy
            {...(productCount !== undefined ? { productCount } : {})}
            {...(sellerCount !== undefined ? { sellerCount } : {})}
          />
          <div className="ring-secondary-content/15 relative mx-auto aspect-[4/5] w-full max-w-sm overflow-hidden rounded-3xl ring-1 sm:aspect-[4/5] lg:mx-0 lg:max-w-none">
            <Image
              src={HERO_IMAGE}
              alt={HERO_ALT}
              fill
              priority
              sizes="(min-width: 1024px) 40vw, (min-width: 640px) 60vw, 100vw"
              className="object-cover"
            />
          </div>
        </div>
      </Container>
    </section>
  );
}
