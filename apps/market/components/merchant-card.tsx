// Presentational marketplace merchant card. Pure — takes fully-resolved props
// and fetches nothing. Renders on a silicaui <Card>: the seller's logo, name,
// location, and listing count, linking to the merchant storefront page.

import Link from 'next/link';
import Image from 'next/image';
import { Store, MapPin } from 'lucide-react';
import { Card } from 'silicaui-react';

import { Stars } from '@/components/stars';

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
    <Card className="border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] transition-all duration-150 hover:-translate-y-0.5 hover:border-[color-mix(in_oklch,var(--sparx-primary)_40%,var(--color-border-default))] hover:shadow-[0_10px_28px_-12px_rgba(0,0,0,0.28)]">
      <Link
        href={`/merchants/${merchant.slug}`}
        className="flex items-center gap-3 p-4"
        aria-label={merchant.name}
      >
        <span className="relative inline-flex h-14 w-14 flex-shrink-0 items-center justify-center overflow-hidden rounded-full bg-[var(--color-bg-subtle)]">
          {merchant.logoUrl ? (
            <Image
              src={merchant.logoUrl}
              alt={merchant.name}
              fill
              sizes="56px"
              className="object-cover"
            />
          ) : (
            <Store size={22} aria-hidden className="text-[var(--color-text-secondary)]" />
          )}
        </span>

        <span className="flex min-w-0 flex-col gap-0.5">
          <span className="truncate text-[0.9375rem] font-semibold text-[var(--color-text-primary)]">
            {merchant.name}
          </span>
          {merchant.rating != null && merchant.ratingCount > 0 ? (
            <Stars rating={merchant.rating} reviewCount={merchant.ratingCount} size={13} compact />
          ) : null}
          {merchant.location ? (
            <span className="inline-flex items-center gap-1 text-[0.8125rem] text-[var(--color-text-secondary)]">
              <MapPin size={13} aria-hidden />
              {merchant.location}
            </span>
          ) : null}
          <span className="text-[0.8125rem] text-[var(--color-text-secondary)]">
            {listingLabel}
          </span>
        </span>
      </Link>
    </Card>
  );
}
