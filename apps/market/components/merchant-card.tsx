// Presentational marketplace merchant card. Pure — takes fully-resolved props
// and fetches nothing. Renders on a silicaui <Card>: the seller's logo, name,
// location, and listing count, linking to the merchant storefront page.

import Link from 'next/link';
import Image from 'next/image';
import { Store, MapPin } from 'lucide-react';
import { Card } from '@wizeworks/silicaui-react';

import { Stars } from '@/components/stars';
import { INTERACTIVE_CARD_CLASS } from '@/components/ui/card';

export interface MerchantCardData {
  slug: string;
  name: string;
  /** Fully-resolved logo URL (already run through media resolution), or null. */
  logoUrl: string | null;
  location: string | null;
  listingCount: number;
  rating: number | null;
  ratingCount: number;
}

export function MerchantCard({ merchant }: { merchant: MerchantCardData }) {
  const listingLabel =
    merchant.listingCount === 1
      ? '1 listing'
      : `${merchant.listingCount.toLocaleString()} listings`;

  return (
    <Card className={INTERACTIVE_CARD_CLASS}>
      <Link
        href={`/merchants/${merchant.slug}`}
        className="flex items-center gap-3 p-4"
        aria-label={merchant.name}
      >
        <span className="bg-base-200 relative inline-flex h-14 w-14 flex-shrink-0 items-center justify-center overflow-hidden rounded-full">
          {merchant.logoUrl ? (
            <Image
              src={merchant.logoUrl}
              alt={merchant.name}
              fill
              sizes="56px"
              className="object-cover"
            />
          ) : (
            <Store size={22} aria-hidden className="text-base-content" />
          )}
        </span>

        <span className="flex min-w-0 flex-col gap-0.5">
          <span className="text-base-content truncate text-[0.9375rem] font-semibold">
            {merchant.name}
          </span>
          {merchant.rating != null && merchant.ratingCount > 0 ? (
            <Stars rating={merchant.rating} reviewCount={merchant.ratingCount} size={13} compact />
          ) : null}
          {merchant.location ? (
            <span className="text-base-content inline-flex items-center gap-1 text-[0.8125rem]">
              <MapPin size={13} aria-hidden />
              {merchant.location}
            </span>
          ) : null}
          <span className="text-base-content text-[0.8125rem]">{listingLabel}</span>
        </span>
      </Link>
    </Card>
  );
}
