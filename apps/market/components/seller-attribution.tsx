// Merchant attribution card on the product detail page. Shows the seller's logo
// + name and links to their sparx.market profile, plus an outbound "Visit their
// store" link to the seller's own storefront when one is known.

import Link from 'next/link';
import Image from 'next/image';
import { ExternalLink, Store } from 'lucide-react';

export function SellerAttribution({
  merchantSlug,
  merchantName,
  merchantLogoUrl,
  storeUrl,
}: {
  merchantSlug: string;
  merchantName: string;
  merchantLogoUrl: string | null;
  /** The seller's own storefront URL for this product / shop, if known. */
  storeUrl: string | null;
}) {
  return (
    <div className="mx-seller">
      <Link
        href={`/merchants/${merchantSlug}`}
        className="mx-seller__logo"
        aria-label={`${merchantName} on sparx.market`}
      >
        {merchantLogoUrl ? (
          <Image src={merchantLogoUrl} alt={merchantName} fill sizes="44px" />
        ) : (
          <Store size={20} aria-hidden />
        )}
      </Link>

      <div className="min-w-0 flex-1">
        <Link href={`/merchants/${merchantSlug}`} className="mx-seller__name hover:underline">
          {merchantName}
        </Link>
        <p className="mx-seller__meta">Sold by an independent seller on sparx.market</p>
      </div>

      {storeUrl ? (
        <a href={storeUrl} target="_blank" rel="noopener noreferrer nofollow" className="mx-social">
          Visit their store
          <ExternalLink size={13} aria-hidden />
        </a>
      ) : (
        <Link href={`/merchants/${merchantSlug}`} className="mx-social">
          View shop
        </Link>
      )}
    </div>
  );
}
