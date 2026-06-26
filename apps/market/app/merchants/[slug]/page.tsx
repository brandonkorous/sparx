// Merchant profile page. Banner + logo + name + location + bio + socials and a
// link out to the seller's own storefront, followed by their product grid. Pure
// server component (revalidate 60). Emits Store JSON-LD + OG/meta from the
// profile.

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Image from 'next/image';
import { ExternalLink, MapPin, Store } from 'lucide-react';
import { Button } from '@sparx/ui';

import { ProductGrid } from '@/components/product-grid';
import { getMerchant } from '@/lib/market';

export const revalidate = 60;

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const profile = await getMerchant(slug);
  if (!profile) return {};
  const { merchant } = profile;
  const description =
    merchant.headline ??
    merchant.bio?.slice(0, 200) ??
    `Shop ${merchant.name} on sparx.market — ${merchant.listingCount} listings from an independent seller.`;

  return {
    title: merchant.name,
    description,
    alternates: { canonical: `/merchants/${merchant.slug}` },
    openGraph: {
      type: 'profile',
      title: `${merchant.name} · sparx.market`,
      description,
      url: `/merchants/${merchant.slug}`,
      ...(merchant.bannerUrl
        ? { images: [{ url: merchant.bannerUrl }] }
        : merchant.logoUrl
          ? { images: [{ url: merchant.logoUrl }] }
          : {}),
    },
  };
}

export default async function MerchantProfilePage({ params }: PageProps) {
  const { slug } = await params;
  const profile = await getMerchant(slug);
  if (!profile) notFound();

  const { merchant, products } = profile;

  const storeJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Store',
    name: merchant.name,
    description: merchant.bio ?? merchant.headline ?? undefined,
    ...(merchant.logoUrl ? { logo: merchant.logoUrl } : {}),
    ...(merchant.bannerUrl ? { image: merchant.bannerUrl } : {}),
    ...(merchant.siteUrl ? { url: merchant.siteUrl } : {}),
    ...(merchant.location ? { address: merchant.location } : {}),
    ...(merchant.socials.length > 0 ? { sameAs: merchant.socials.map((s) => s.url) } : {}),
  };

  return (
    <div className="mx-container mx-section">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(storeJsonLd) }}
      />

      {/* Banner */}
      <div className={merchant.bannerUrl ? 'mx-banner' : 'mx-banner mx-banner--empty'}>
        {merchant.bannerUrl ? (
          <Image
            src={merchant.bannerUrl}
            alt={`${merchant.name} banner`}
            fill
            priority
            sizes="100vw"
          />
        ) : null}
      </div>

      {/* Identity head */}
      <div className="mx-profile-head">
        <span className="mx-profile-head__logo">
          {merchant.logoUrl ? (
            <Image src={merchant.logoUrl} alt={merchant.name} fill sizes="88px" />
          ) : (
            <Store size={32} aria-hidden />
          )}
        </span>
        <div className="min-w-0 flex-1 pb-1">
          <h1 className="mx-page-title">{merchant.name}</h1>
          <div
            className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            {merchant.location ? (
              <span className="inline-flex items-center gap-1">
                <MapPin size={14} aria-hidden />
                {merchant.location}
              </span>
            ) : null}
            <span>
              {merchant.listingCount === 1
                ? '1 listing'
                : `${merchant.listingCount.toLocaleString()} listings`}
            </span>
          </div>
        </div>
        {merchant.siteUrl ? (
          <Button asChild color="primary" variant="soft" size="md" className="self-end">
            <a href={merchant.siteUrl} target="_blank" rel="noopener noreferrer nofollow">
              Visit their store
              <ExternalLink size={15} aria-hidden />
            </a>
          </Button>
        ) : null}
      </div>

      {/* Headline + bio + socials */}
      {merchant.headline || merchant.bio || merchant.socials.length > 0 ? (
        <div className="mt-6 flex max-w-3xl flex-col gap-3">
          {merchant.headline ? (
            <p className="text-lg font-medium" style={{ color: 'var(--color-text-primary)' }}>
              {merchant.headline}
            </p>
          ) : null}
          {merchant.bio ? (
            <p className="text-sm leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
              {merchant.bio}
            </p>
          ) : null}
          {merchant.socials.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {merchant.socials.map((social) => (
                <a
                  key={`${social.platform}-${social.url}`}
                  href={social.url}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  className="mx-social"
                >
                  {social.platform}
                  <ExternalLink size={12} aria-hidden />
                </a>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      {/* Products */}
      <section className="mt-10">
        <h2 className="mx-section__title mb-5">Products from {merchant.name}</h2>
        <ProductGrid
          products={products}
          emptyTitle="No products listed yet"
          emptyHint="This seller hasn’t listed anything on the marketplace yet."
        />
      </section>
    </div>
  );
}
