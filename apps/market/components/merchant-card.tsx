// Presentational marketplace merchant card. Pure — takes fully-resolved props
// and fetches nothing. Renders the seller's logo, name, location, and listing
// count, linking to the merchant storefront page on sparx.market.

import Link from 'next/link';
import Image from 'next/image';
import { Store, MapPin } from 'lucide-react';

export interface MerchantCardData {
  slug: string;
  name: string;
  /** Fully-resolved logo URL (already run through media resolution), or null. */
  logoUrl: string | null;
  location: string | null;
  listingCount: number;
}

export function MerchantCard({ merchant }: { merchant: MerchantCardData }) {
  const listingLabel =
    merchant.listingCount === 1
      ? '1 listing'
      : `${merchant.listingCount.toLocaleString()} listings`;

  return (
    <article className="mx-card">
      <Link
        href={`/merchants/${merchant.slug}`}
        className="flex items-center gap-3 p-4"
        aria-label={merchant.name}
      >
        <span
          className="relative inline-flex h-14 w-14 flex-shrink-0 items-center justify-center overflow-hidden rounded-full"
          style={{ background: 'var(--color-bg-subtle)' }}
        >
          {merchant.logoUrl ? (
            <Image
              src={merchant.logoUrl}
              alt={merchant.name}
              fill
              sizes="56px"
              className="object-cover"
            />
          ) : (
            <Store size={22} aria-hidden style={{ color: 'var(--color-text-secondary)' }} />
          )}
        </span>

        <span className="flex min-w-0 flex-col gap-0.5">
          <span className="mx-card__title">{merchant.name}</span>
          {merchant.location ? (
            <span className="mx-card__meta inline-flex items-center gap-1">
              <MapPin size={13} aria-hidden />
              {merchant.location}
            </span>
          ) : null}
          <span className="mx-card__meta">{listingLabel}</span>
        </span>
      </Link>
    </article>
  );
}
