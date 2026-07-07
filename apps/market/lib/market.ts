// Typed server-side data layer for the public marketplace catalog. Thin wrappers
// over `marketApi` (lib/api.ts), which already unwraps the `{ success, data }`
// envelope. Every function here is a SERVER read (revalidate ~60, cross-tenant);
// the browser-side cart + checkout writes live in lib/cart-client.ts +
// lib/checkout-client.ts.
//
// Media resolution: list/detail rows carry raw media REFERENCES that belong to
// the SELLER tenant (`merchantSlug`). The API may hand us either a fully-resolved
// URL or a bare asset id, so we run every image through `mediaUrl(ref, sellerSlug)`
// at the data boundary and the presentational cards receive ready-to-use URLs.

import { mediaUrl } from './media';
import { marketApi, MarketApiError } from './api';
import type { ProductCardData } from '@/components/product-card';
import type { MerchantCardData } from '@/components/merchant-card';

// ── Wire shapes (exact API return shapes, docs/72) ──────────────────────────

/** A product card row from the browse/category/merchant endpoints. */
export interface ListingCard {
  slug: string;
  title: string;
  imageUrl: string | null;
  priceMinCents: number;
  priceMaxCents: number;
  currency: string;
  inStock: boolean;
  averageRating: number | null;
  reviewCount: number;
  category: string | null;
  merchantSlug: string;
  merchantName: string;
  merchantLogoUrl: string | null;
  // Card-badge signals (docs/117 S3): bestseller rank (1 = top; null = unranked),
  // running-low urgency flag, sparx-curated featured placement.
  bestSellerRank: number | null;
  lowStock: boolean;
  featured: boolean;
}

export interface ListingVariant {
  variantId: string;
  sku: string;
  title: string;
  options: Record<string, string>;
  priceCents: number;
  currency: string;
  inStock: boolean;
}

export interface ListingImage {
  url: string;
  alt: string | null;
}

/** A full product detail record (a ListingCard plus the buyable detail). */
export interface ListingDetail extends ListingCard {
  productId: string;
  description: string | null;
  /** The seller's own storefront URL for this product ("Visit their store"). */
  productUrl: string | null;
  /** Ordered product gallery (primary first). Empty → fall back to `imageUrl`. */
  images: ListingImage[];
  variants: ListingVariant[];
}

export interface MerchantSocial {
  platform: string;
  url: string;
}

export interface MerchantSummary {
  slug: string;
  name: string;
  logoUrl: string | null;
  bannerUrl: string | null;
  bio: string | null;
  location: string | null;
  headline: string | null;
  siteUrl: string | null;
  socials: MerchantSocial[];
  listingCount: number;
  // Seller trust signals (docs/117 S5).
  rating: number | null;
  ratingCount: number;
  /** ISO join date, for "Selling since {year}" trust copy. */
  memberSince: string;
}

export type MarketSort = 'relevance' | 'newest' | 'lowest_price' | 'highest_price' | 'rating';

export interface ListProductsParams {
  q?: string;
  category?: string;
  merchant?: string;
  sort?: MarketSort;
  minPriceCents?: number;
  maxPriceCents?: number;
  inStock?: boolean;
  featured?: boolean;
  page?: number;
  perPage?: number;
}

export interface ProductPage {
  items: ListingCard[];
  total: number;
  page: number;
  perPage: number;
}

export interface MerchantDirectoryPage {
  items: MerchantSummary[];
  total: number;
  page: number;
  perPage: number;
}

export interface MerchantProfile {
  merchant: MerchantSummary;
  products: ListingCard[];
  total: number;
  page: number;
  perPage: number;
}

// ── Raw wire types (pre-resolution) ─────────────────────────────────────────
//
// The API may return either a resolved http(s) URL or a bare media asset id in
// the image fields; `mediaUrl(ref, sellerSlug)` handles both. We type the raw
// rows with the same field names so resolution is a single map at the boundary.

interface RawListingCard extends Omit<ListingCard, 'imageUrl' | 'merchantLogoUrl'> {
  imageUrl: string | null;
  merchantLogoUrl: string | null;
}

interface RawListingDetail extends Omit<ListingDetail, 'imageUrl' | 'merchantLogoUrl' | 'images'> {
  imageUrl: string | null;
  merchantLogoUrl: string | null;
  images?: ListingImage[];
}

interface RawMerchantSummary extends Omit<MerchantSummary, 'logoUrl' | 'bannerUrl'> {
  logoUrl: string | null;
  bannerUrl: string | null;
}

// ── Resolution helpers ──────────────────────────────────────────────────────

function resolveCard(raw: RawListingCard): ListingCard {
  return {
    ...raw,
    imageUrl: mediaUrl(raw.imageUrl, raw.merchantSlug),
    merchantLogoUrl: mediaUrl(raw.merchantLogoUrl, raw.merchantSlug),
  };
}

function resolveMerchant(raw: RawMerchantSummary): MerchantSummary {
  return {
    ...raw,
    logoUrl: mediaUrl(raw.logoUrl, raw.slug),
    bannerUrl: mediaUrl(raw.bannerUrl, raw.slug),
    socials: raw.socials ?? [],
  };
}

// Default revalidation window for catalog reads (60s, per the brief).
const REVALIDATE = 60;

function buildQuery(params: Record<string, string | number | boolean | undefined>): string {
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === '') continue;
    qs.set(key, String(value));
  }
  const s = qs.toString();
  return s ? `?${s}` : '';
}

// ── Adapters: ListingCard → presentational card props ───────────────────────

/** Map a resolved ListingCard to the presentational <ProductCard> props. */
export function toProductCardData(listing: ListingCard): ProductCardData {
  return {
    slug: listing.slug,
    title: listing.title,
    imageUrl: listing.imageUrl,
    priceMinCents: listing.priceMinCents,
    priceMaxCents: listing.priceMaxCents,
    currency: listing.currency,
    merchantName: listing.merchantName,
    merchantSlug: listing.merchantSlug,
    inStock: listing.inStock,
    averageRating: listing.averageRating,
    reviewCount: listing.reviewCount,
    bestSellerRank: listing.bestSellerRank,
    lowStock: listing.lowStock,
    featured: listing.featured,
  };
}

/** Map a resolved MerchantSummary to the presentational <MerchantCard> props. */
export function toMerchantCardData(merchant: MerchantSummary): MerchantCardData {
  return {
    slug: merchant.slug,
    name: merchant.name,
    logoUrl: merchant.logoUrl,
    location: merchant.location,
    listingCount: merchant.listingCount,
    rating: merchant.rating,
    ratingCount: merchant.ratingCount,
  };
}

// ── Reads ───────────────────────────────────────────────────────────────────

/** Faceted catalog browse (the PLP, category pages, featured strips). */
export async function listProducts(params: ListProductsParams = {}): Promise<ProductPage> {
  const query = buildQuery({
    q: params.q,
    category: params.category,
    merchant: params.merchant,
    sort: params.sort,
    minPriceCents: params.minPriceCents,
    maxPriceCents: params.maxPriceCents,
    inStock: params.inStock,
    featured: params.featured,
    page: params.page,
    perPage: params.perPage,
  });
  const data = await marketApi<{
    items: RawListingCard[];
    total: number;
    page: number;
    perPage: number;
  }>(`/products${query}`, { next: { revalidate: REVALIDATE } });
  return {
    items: data.items.map(resolveCard),
    total: data.total,
    page: data.page,
    perPage: data.perPage,
  };
}

export interface MarketFacets {
  /** Per-category tallies (honoring every filter except the selected category). */
  categories: { slug: string; count: number }[];
  /** How many results remain if "in stock only" is toggled on. */
  inStockCount: number;
  /** Total matching the full active filter set (mirrors the grid count). */
  total: number;
}

/** Facet counts for the PLP sidebar. Shares the browse filter vocabulary. */
export async function listFacets(params: ListProductsParams = {}): Promise<MarketFacets> {
  const query = buildQuery({
    q: params.q,
    category: params.category,
    merchant: params.merchant,
    minPriceCents: params.minPriceCents,
    maxPriceCents: params.maxPriceCents,
    inStock: params.inStock,
    featured: params.featured,
  });
  return marketApi<MarketFacets>(`/products/facets${query}`, {
    next: { revalidate: REVALIDATE },
  });
}

/** The discovery-home "Trending now" rail (best sellers first). */
export async function listTrending(limit = 12): Promise<ListingCard[]> {
  const data = await marketApi<{ items: RawListingCard[] }>(`/products/trending?limit=${limit}`, {
    next: { revalidate: REVALIDATE },
  });
  return data.items.map(resolveCard);
}

/** Single product detail. Returns null on a 404 so the page can `notFound()`. */
export async function getProduct(slug: string): Promise<ListingDetail | null> {
  try {
    const raw = await marketApi<RawListingDetail>(`/products/${encodeURIComponent(slug)}`, {
      next: { revalidate: REVALIDATE },
    });
    // Gallery URLs are already resolved to absolute CDN URLs server-side; the
    // single card image still runs through mediaUrl (it may arrive as a bare ref).
    const gallery = raw.images ?? [];
    return {
      ...raw,
      imageUrl: mediaUrl(raw.imageUrl, raw.merchantSlug),
      merchantLogoUrl: mediaUrl(raw.merchantLogoUrl, raw.merchantSlug),
      images: gallery,
      variants: raw.variants ?? [],
    };
  } catch (err) {
    if (err instanceof MarketApiError && err.status === 404) return null;
    throw err;
  }
}

/** Merchant directory (the /merchants grid + search). */
export async function listMerchants(
  params: { page?: number; perPage?: number; q?: string } = {}
): Promise<MerchantDirectoryPage> {
  const query = buildQuery({ page: params.page, perPage: params.perPage, q: params.q });
  const data = await marketApi<{
    items: RawMerchantSummary[];
    total: number;
    page: number;
    perPage: number;
  }>(`/merchants${query}`, { next: { revalidate: REVALIDATE } });
  return {
    items: data.items.map(resolveMerchant),
    total: data.total,
    page: data.page,
    perPage: data.perPage,
  };
}

/** Merchant profile + their products (with in-store search/sort/paginate). Null on
 *  a 404 so the page can `notFound()`. */
export async function getMerchant(
  slug: string,
  params: { q?: string; sort?: MarketSort; page?: number } = {}
): Promise<MerchantProfile | null> {
  const query = buildQuery({ q: params.q, sort: params.sort, page: params.page });
  try {
    const data = await marketApi<{
      merchant: RawMerchantSummary;
      products: { items: RawListingCard[]; total: number; page: number; perPage: number };
    }>(`/merchants/${encodeURIComponent(slug)}${query}`, { next: { revalidate: REVALIDATE } });
    return {
      merchant: resolveMerchant(data.merchant),
      products: data.products.items.map(resolveCard),
      total: data.products.total,
      page: data.products.page,
      perPage: data.products.perPage,
    };
  } catch (err) {
    if (err instanceof MarketApiError && err.status === 404) return null;
    throw err;
  }
}

// ── Public order view ─────────────────────────────────────────────────────────

export interface PublicOrderItem {
  name: string;
  quantity: number;
  lineTotalCents: number;
}

export interface PublicOrder {
  orderNumber: string;
  status: string;
  paymentStatus: string;
  totalCents: number;
  currency: string;
  items: PublicOrderItem[];
  placedAt: string;
  shippingCity: string | null;
  shippingRegion: string | null;
  shippingCountry: string | null;
}

/** The public order view (confirmation page). Scoped to the seller, so it needs
 *  the merchant slug. Order reads are NEVER cached — an order's status changes
 *  after placement. Null on a 404. */
export async function getOrder(orderId: string, merchantSlug: string): Promise<PublicOrder | null> {
  try {
    return await marketApi<PublicOrder>(
      `/orders/${encodeURIComponent(orderId)}?merchant=${encodeURIComponent(merchantSlug)}`,
      { cache: 'no-store' }
    );
  } catch (err) {
    if (err instanceof MarketApiError && err.status === 404) return null;
    throw err;
  }
}

// ── PDP depth: reviews, Q&A, related ─────────────────────────────────────────

export interface ProductReview {
  id: string;
  rating: number;
  title: string | null;
  body: string;
  author: string | null;
  verifiedPurchase: boolean;
  helpfulCount: number;
  /** The seller's public reply, if any. */
  response: string | null;
  respondedAt: string | null;
  createdAt: string;
}

export interface ProductReviewPage {
  summary: { averageRating: number; total: number };
  items: ProductReview[];
  page: number;
  perPage: number;
}

/** A listing's approved reviews (newest first) + the live rating summary. */
export async function getProductReviews(
  slug: string,
  params: { page?: number; perPage?: number } = {}
): Promise<ProductReviewPage> {
  const query = buildQuery({ page: params.page, perPage: params.perPage });
  return marketApi<ProductReviewPage>(`/products/${encodeURIComponent(slug)}/reviews${query}`, {
    next: { revalidate: REVALIDATE },
  });
}

export interface ProductQuestionAnswer {
  id: string;
  body: string;
  isOfficial: boolean;
  createdAt: string;
}

export interface ProductQuestion {
  id: string;
  displayName: string | null;
  body: string;
  createdAt: string;
  helpfulCount: number;
  answers: ProductQuestionAnswer[];
}

/** A listing's published questions + their answers (official first). */
export async function getProductQuestions(slug: string): Promise<ProductQuestion[]> {
  const data = await marketApi<{ items: ProductQuestion[] }>(
    `/products/${encodeURIComponent(slug)}/questions`,
    { next: { revalidate: REVALIDATE } }
  );
  return data.items;
}

/** Same-category "you may also like" listings for the PDP. */
export async function getRelatedProducts(slug: string): Promise<ListingCard[]> {
  const data = await marketApi<{ items: RawListingCard[] }>(
    `/products/${encodeURIComponent(slug)}/related`,
    { next: { revalidate: REVALIDATE } }
  );
  return data.items.map(resolveCard);
}
