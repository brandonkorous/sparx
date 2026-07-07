// Seller attribution / trust card on the product detail page. Shows the seller's
// logo + name, links to their sparx.market storefront, and offers an outbound
// "Visit their store" link to the seller's own site when known. A server
// component composed on a silicaui <Card> (no more mx-seller / mx-social).

import Link from 'next/link';
import Image from 'next/image';
import { ExternalLink, ShieldCheck, Store } from 'lucide-react';
import { Button, Card } from 'silicaui-react';

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
    <Card className="border-base-300 bg-base-100 border p-4">
      <div className="flex items-center gap-3">
        <Link
          href={`/merchants/${merchantSlug}`}
          className="bg-base-200 relative inline-flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full"
          aria-label={`${merchantName} on sparx.market`}
        >
          {merchantLogoUrl ? (
            <Image
              src={merchantLogoUrl}
              alt={merchantName}
              fill
              sizes="44px"
              className="object-cover"
            />
          ) : (
            <Store size={20} aria-hidden className="text-base-content/70" />
          )}
        </Link>

        <div className="min-w-0 flex-1">
          <Link
            href={`/merchants/${merchantSlug}`}
            className="text-base-content font-semibold hover:underline"
          >
            {merchantName}
          </Link>
          <p className="text-base-content/70 inline-flex items-center gap-1 text-[0.8125rem]">
            <ShieldCheck size={13} aria-hidden className="text-success" />
            Independent seller on sparx.market
          </p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          render={<Link href={`/merchants/${merchantSlug}`} />}
          color="neutral"
          variant="outline"
          size="sm"
        >
          View shop
        </Button>
        {storeUrl ? (
          <Button
            render={
              <a
                href={storeUrl}
                target="_blank"
                rel="noopener noreferrer nofollow"
                aria-label="Visit their store"
              />
            }
            color="neutral"
            variant="ghost"
            size="sm"
            iconEnd={<ExternalLink size={13} />}
          >
            Visit their store
          </Button>
        ) : null}
      </div>
    </Card>
  );
}
