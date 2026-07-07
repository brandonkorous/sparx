// Shop spotlight — a featured seller rendered as a mini-storefront: their banner
// + logo + trust row, and a strip of their top products, all inside one framed
// card. This is the marketplace's "meet a maker" moment (Etsy's shop spotlight),
// and it doubles as social proof that real shops live here. Solid fills only.

import Link from 'next/link';
import Image from 'next/image';
import { ArrowRight, MapPin, Package, Store } from 'lucide-react';
import { Button } from 'silicaui-react';

import { ProductCard } from '@/components/product-card';
import { Stars } from '@/components/stars';
import { toProductCardData, type ListingCard, type MerchantSummary } from '@/lib/market';

export function ShopSpotlight({
  merchant,
  products,
}: {
  merchant: MerchantSummary;
  products: ListingCard[];
}) {
  const productLabel =
    merchant.listingCount === 1
      ? '1 product'
      : `${merchant.listingCount.toLocaleString()} products`;

  return (
    <section className="border-base-300 bg-base-100 overflow-hidden rounded-2xl border">
      {/* Banner — a real image, or a solid subtle panel (no gradient). */}
      <div className="bg-base-200 relative h-28 md:h-36">
        {merchant.bannerUrl ? (
          <Image src={merchant.bannerUrl} alt={`${merchant.name} banner`} fill sizes="100vw" />
        ) : null}
      </div>

      {/* Identity — logo overlaps the banner. */}
      <div className="-mt-8 flex flex-wrap items-end gap-4 px-5 md:px-6">
        <span className="bg-base-100 border-base-100 relative inline-flex h-16 w-16 flex-shrink-0 items-center justify-center overflow-hidden rounded-2xl border-[3px] shadow-[0_4px_14px_-6px_rgba(0,0,0,0.25)]">
          {merchant.logoUrl ? (
            <Image src={merchant.logoUrl} alt={merchant.name} fill sizes="64px" />
          ) : (
            <Store size={26} aria-hidden className="text-base-content/70" />
          )}
        </span>
        <div className="min-w-0 flex-1 pb-1">
          <Link
            href={`/merchants/${merchant.slug}`}
            className="text-base-content text-lg font-bold tracking-[-0.01em] hover:underline"
          >
            {merchant.name}
          </Link>
          <div className="text-base-content/70 mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-[0.8125rem]">
            {merchant.rating != null && merchant.ratingCount > 0 ? (
              <Stars
                rating={merchant.rating}
                reviewCount={merchant.ratingCount}
                size={13}
                compact
              />
            ) : null}
            <span className="inline-flex items-center gap-1">
              <Package size={13} aria-hidden />
              {productLabel}
            </span>
            {merchant.location ? (
              <span className="inline-flex items-center gap-1">
                <MapPin size={13} aria-hidden />
                {merchant.location}
              </span>
            ) : null}
          </div>
        </div>
        <Button
          render={<Link href={`/merchants/${merchant.slug}`} />}
          color="neutral"
          variant="outline"
          size="sm"
          className="mb-1"
        >
          Visit shop
          <ArrowRight size={15} aria-hidden />
        </Button>
      </div>

      {/* Headline / bio */}
      {merchant.headline || merchant.bio ? (
        <p className="text-base-content/70 mt-4 max-w-3xl px-5 text-[0.9375rem] leading-relaxed md:px-6">
          {merchant.headline ?? merchant.bio}
        </p>
      ) : null}

      {/* Their top products */}
      <div className="mt-5 grid grid-cols-2 gap-4 p-5 pt-0 sm:grid-cols-4 md:px-6">
        {products.slice(0, 4).map((product) => (
          <ProductCard key={product.slug} product={toProductCardData(product)} />
        ))}
      </div>
    </section>
  );
}
