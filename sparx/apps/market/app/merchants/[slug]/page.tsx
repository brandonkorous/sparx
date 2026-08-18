// Merchant profile page — the seller site. Banner + logo + name + trust row
// (rating, product count, member-since, location) + bio + socials + a link out to
// the seller's own site, then their catalog with in-store search + sort +
// pagination. Pure server component (revalidate 60). Emits Store JSON-LD + OG/meta.
// Solid fills only — no gradients.

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Image from 'next/image';
import { CalendarDays, ExternalLink, MapPin, Package, Store } from 'lucide-react';
import { Button } from '@wizeworks/silicaui-react';

import { ProductGrid } from '@/components/product-grid';
import { MarketPager } from '@/components/market-pager';
import { StoreControls } from '@/components/store-controls';
import { Stars } from '@/components/stars';
import { Container } from '@/components/ui/layout';
import { getMerchant, type MarketSort } from '@/lib/market';

export const revalidate = 60;

const SORTS = new Set<MarketSort>([
  'relevance',
  'newest',
  'lowest_price',
  'highest_price',
  'rating',
]);

interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

function one(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
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

export default async function MerchantProfilePage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const sp = (await searchParams) ?? {};
  const trimmedQ = one(sp.q)?.trim();
  const q = trimmedQ && trimmedQ.length > 0 ? trimmedQ : undefined;
  const rawSort = one(sp.sort);
  const sort: MarketSort =
    rawSort && SORTS.has(rawSort as MarketSort) ? (rawSort as MarketSort) : 'newest';
  const page = Math.max(1, Number(one(sp.page) ?? '1') || 1);

  const profile = await getMerchant(slug, { ...(q ? { q } : {}), sort, page });
  if (!profile) notFound();

  const { merchant, products, total, perPage } = profile;
  const totalPages = Math.max(1, Math.ceil(total / (perPage || 24)));
  const memberYear = new Date(merchant.memberSince).getFullYear();

  const storeJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Store',
    name: merchant.name,
    description: merchant.bio ?? merchant.headline ?? undefined,
    ...(merchant.logoUrl ? { logo: merchant.logoUrl } : {}),
    ...(merchant.bannerUrl ? { image: merchant.bannerUrl } : {}),
    ...(merchant.siteUrl ? { url: merchant.siteUrl } : {}),
    ...(merchant.location ? { address: merchant.location } : {}),
    ...(merchant.rating != null && merchant.ratingCount > 0
      ? {
          aggregateRating: {
            '@type': 'AggregateRating',
            ratingValue: merchant.rating,
            reviewCount: merchant.ratingCount,
          },
        }
      : {}),
    ...(merchant.socials.length > 0 ? { sameAs: merchant.socials.map((s) => s.url) } : {}),
  };

  return (
    <Container className="py-8 md:py-10">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(storeJsonLd) }}
      />

      {/* Banner — a real image, or a solid subtle panel (no gradient). */}
      <div className="bg-base-200 relative h-36 overflow-hidden rounded-2xl md:h-56">
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

      {/* Identity head — logo overlaps the banner. */}
      <div className="-mt-12 flex flex-wrap items-end gap-5 px-2">
        <span className="bg-base-100 border-base-100 relative inline-flex h-[5.5rem] w-[5.5rem] flex-shrink-0 items-center justify-center overflow-hidden rounded-2xl border-[3px] shadow-[0_4px_14px_-6px_rgba(0,0,0,0.25)]">
          {merchant.logoUrl ? (
            <Image src={merchant.logoUrl} alt={merchant.name} fill sizes="88px" />
          ) : (
            <Store size={32} aria-hidden />
          )}
        </span>
        <div className="min-w-0 flex-1 pb-1">
          <h1 className="text-2xl font-bold tracking-[-0.02em] md:text-3xl">{merchant.name}</h1>
          {/* Trust row */}
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm">
            {merchant.rating != null && merchant.ratingCount > 0 ? (
              <Stars rating={merchant.rating} reviewCount={merchant.ratingCount} size={14} />
            ) : null}
            <span className="inline-flex items-center gap-1.5">
              <Package size={14} aria-hidden />
              {merchant.listingCount === 1
                ? '1 product'
                : `${merchant.listingCount.toLocaleString()} products`}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <CalendarDays size={14} aria-hidden />
              Selling since {memberYear}
            </span>
            {merchant.location ? (
              <span className="inline-flex items-center gap-1.5">
                <MapPin size={14} aria-hidden />
                {merchant.location}
              </span>
            ) : null}
          </div>
        </div>
        {merchant.siteUrl ? (
          <Button
            render={
              <a
                href={merchant.siteUrl}
                target="_blank"
                rel="noopener noreferrer nofollow"
                aria-label="Visit their store"
              />
            }
            color="primary"
            variant="soft"
            size="md"
            className="self-end"
          >
            Visit their store
            <ExternalLink size={15} aria-hidden />
          </Button>
        ) : null}
      </div>

      {/* Headline + bio + socials */}
      {merchant.headline || merchant.bio || merchant.socials.length > 0 ? (
        <div className="mt-6 flex max-w-3xl flex-col gap-3">
          {merchant.headline ? <p className="text-lg font-medium">{merchant.headline}</p> : null}
          {merchant.bio ? <p className="text-sm leading-relaxed">{merchant.bio}</p> : null}
          {merchant.socials.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {merchant.socials.map((social) => (
                <a
                  key={`${social.platform}-${social.url}`}
                  href={social.url}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  className="border-base-300 hover:border-base-content/20 items-center gap-1.5 rounded-full border px-3 py-1.5 text-[0.8125rem] transition-colors hover:inline-flex"
                >
                  {social.platform}
                  <ExternalLink size={12} aria-hidden />
                </a>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      {/* Catalog with in-store controls */}
      <section className="mt-10">
        <div className="mb-5 flex flex-col gap-4">
          <h2 className="text-xl font-semibold">
            {q ? `Results for “${q}” in ${merchant.name}` : `Products from ${merchant.name}`}
          </h2>
          <StoreControls basePath={`/merchants/${merchant.slug}`} q={q} sort={sort} />
        </div>
        <ProductGrid
          products={products}
          emptyTitle={q ? `No products match “${q}”` : 'No products listed yet'}
          emptyHint={
            q
              ? 'Try a different search in this store.'
              : 'This seller hasn’t listed anything on the marketplace yet.'
          }
        />
        <MarketPager basePath={`/merchants/${merchant.slug}`} page={page} totalPages={totalPages} />
      </section>
    </Container>
  );
}
