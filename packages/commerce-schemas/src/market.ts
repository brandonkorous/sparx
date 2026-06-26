// sparx.market — the first-party marketplace schemas (docs/106 §4.7, docs/72).
//
// The single source of truth for: the market CATEGORY taxonomy (the indexed
// landing pages /auto /beauty /…), the flat COMMISSION model (a platform rate in
// basis points, per-tenant override — NOT a plan tier; the platform has modules,
// not tiers, so docs/72's plan-tiered table is corrected here), and every market
// write surface (product opt-in, merchant profile, ACH payout account, the public
// browse query). Imported by @sparx/commerce (services), api-rest (routes), the
// dashboard, and apps/market (category metadata).

import { z } from 'zod';

import { Money } from './common';

// ── Category taxonomy ───────────────────────────────────────────────────────────
//
// Each category is a real, indexed landing page (docs/72 §3) — it carries copy +
// SEO even with zero products. `general` is the catch-all for products that don't
// fit a named vertical. Order here is the nav + homepage order.

export interface MarketCategory {
  slug: string;
  name: string;
  /** One-line hero subhead for the category landing page. */
  tagline: string;
  /** SEO meta description + the directory blurb. */
  description: string;
  /** Lucide icon name the dashboard + site render for the category chip. */
  icon: string;
}

export const MARKET_CATEGORIES: readonly MarketCategory[] = [
  {
    slug: 'auto',
    name: 'Auto & Industrial',
    tagline: 'Parts, tools, and supplies for vehicles and the shop floor.',
    description:
      'Shop auto parts, industrial supplies, and equipment from independent sellers across the sparx network — fitment-aware, in stock, and ready to ship.',
    icon: 'Wrench',
  },
  {
    slug: 'beauty',
    name: 'Beauty & Wellness',
    tagline: 'Independent skincare, cosmetics, and self-care brands.',
    description:
      'Discover independent beauty, skincare, and wellness brands selling direct on sparx.market — small-batch, original, and shipped from the maker.',
    icon: 'Sparkles',
  },
  {
    slug: 'home',
    name: 'Home & Living',
    tagline: 'Furniture, decor, and goods for every room.',
    description:
      'Furnish and decorate from independent home-goods sellers on sparx.market — kitchen, decor, furniture, and the things that make a space yours.',
    icon: 'Home',
  },
  {
    slug: 'fashion',
    name: 'Fashion & Apparel',
    tagline: 'Clothing, accessories, and footwear from real sellers.',
    description:
      'Browse apparel, accessories, and footwear from independent fashion sellers on sparx.market — new arrivals from brands you won’t find on the big marketplaces.',
    icon: 'Shirt',
  },
  {
    slug: 'food',
    name: 'Food & Drink',
    tagline: 'Pantry, specialty, and small-batch food and beverage.',
    description:
      'Stock up on specialty food and drink from independent makers on sparx.market — pantry staples, small-batch treats, and regional favorites.',
    icon: 'UtensilsCrossed',
  },
  {
    slug: 'tech',
    name: 'Tech & Electronics',
    tagline: 'Gadgets, accessories, and components.',
    description:
      'Find electronics, gadgets, and components from independent tech sellers on sparx.market — accessories, parts, and hard-to-find gear.',
    icon: 'Cpu',
  },
  {
    slug: 'general',
    name: 'Everything Else',
    tagline: 'Everything that doesn’t fit a single aisle.',
    description:
      'Browse everything else on sparx.market — the long tail of independent sellers and the products that defy a category.',
    icon: 'LayoutGrid',
  },
] as const;

export const MARKET_CATEGORY_SLUGS = MARKET_CATEGORIES.map((c) => c.slug) as [string, ...string[]];

/** A market category slug (one of the taxonomy above). */
export const MarketCategorySlug = z.enum(MARKET_CATEGORY_SLUGS);
export type MarketCategorySlug = z.infer<typeof MarketCategorySlug>;

/** Look up a category descriptor by slug. */
export function getMarketCategory(slug: string): MarketCategory | undefined {
  return MARKET_CATEGORIES.find((c) => c.slug === slug);
}

/** Human label for a category slug (falls back to the slug). */
export function marketCategoryLabel(slug: string | null | undefined): string {
  if (!slug) return 'Uncategorized';
  return getMarketCategory(slug)?.name ?? slug;
}

// ── Commission (flat platform rate, per-tenant override) ────────────────────────
//
// sparx is merchant-of-record; it deducts a commission at SETTLEMENT (never an
// in-flow Stripe application_fee — the charge is a direct platform charge, settled
// to the seller weekly by ACH). The rate is a flat platform default in basis
// points; a tenant may negotiate an override (docs/106 §4.7). This is deliberately
// NOT plan-based — the platform has modules, not tiers.

/** The platform default commission, in basis points (200 = 2.00%). Ops can
 *  override per-process via the MARKET_COMMISSION_BPS env (read in the server
 *  layer, not here — this package is pure/no-node); a tenant override on the
 *  merchant profile wins over both. */
export const MARKET_COMMISSION_BPS_DEFAULT = 200;

/** Whether a bps value is in the sane [0, 3000] (0–30%) range. */
export function isValidCommissionBps(bps: number | null | undefined): bps is number {
  return bps !== null && bps !== undefined && Number.isInteger(bps) && bps >= 0 && bps <= 3000;
}

/** Resolve the effective commission for a tenant: its override if valid, else the
 *  supplied platform default (the server layer reads MARKET_COMMISSION_BPS and
 *  passes it in; defaults to MARKET_COMMISSION_BPS_DEFAULT). */
export function resolveCommissionBps(
  overrideBps: number | null | undefined,
  platformDefaultBps: number = MARKET_COMMISSION_BPS_DEFAULT
): number {
  if (isValidCommissionBps(overrideBps)) return overrideBps;
  return isValidCommissionBps(platformDefaultBps)
    ? platformDefaultBps
    : MARKET_COMMISSION_BPS_DEFAULT;
}

/** Commission in cents for a gross amount at a bps rate (banker-safe round). */
export function commissionCents(grossCents: number, bps: number): number {
  return Math.round((grossCents * bps) / 10_000);
}

/** Format a basis-points rate as a percent string for display (200 → "2%"). */
export function formatBps(bps: number): string {
  const pct = bps / 100;
  return `${Number.isInteger(pct) ? pct : pct.toFixed(2)}%`;
}

// ── Write surfaces ──────────────────────────────────────────────────────────────

/** Toggle a single product's sparx.market opt-in + its category. */
export const MarketProductOptInInput = z.object({
  listed: z.boolean(),
  category: MarketCategorySlug.optional(),
  /** sparx-curated placement — admin-only (the route gates who may set it). */
  featured: z.boolean().optional(),
});
export type MarketProductOptInInput = z.infer<typeof MarketProductOptInInput>;

/** Bulk opt-in/out from the products table selection. */
export const MarketBulkOptInInput = z.object({
  productIds: z.array(z.string().uuid()).min(1).max(500),
  listed: z.boolean(),
  category: MarketCategorySlug.optional(),
});
export type MarketBulkOptInInput = z.infer<typeof MarketBulkOptInInput>;

/** The merchant's editable sparx.market profile (the participation enable flag +
 *  public profile fields + the commission override). */
export const MarketMerchantProfileInput = z.object({
  enabled: z.boolean(),
  bio: z.string().max(2000).nullish(),
  location: z.string().max(160).nullish(),
  headline: z.string().max(255).nullish(),
  bannerMediaId: z.string().uuid().nullish(),
  defaultCategory: MarketCategorySlug.nullish(),
  /** Per-tenant commission override (bps); platform-admin-set, gated in the route. */
  commissionBpsOverride: z.number().int().min(0).max(3000).nullish(),
});
export type MarketMerchantProfileInput = z.infer<typeof MarketMerchantProfileInput>;

/** US ACH bank account capture. The raw routing/account numbers are encrypted at
 *  the service boundary (AES-256-GCM) and never persisted in the clear. */
export const MarketPayoutAccountInput = z.object({
  accountHolderName: z.string().min(1).max(255),
  bankName: z.string().max(255).optional(),
  routingNumber: z.string().regex(/^\d{9}$/, 'Routing number must be 9 digits'),
  accountNumber: z.string().regex(/^\d{4,17}$/, 'Account number must be 4–17 digits'),
  accountType: z.enum(['checking', 'savings']).default('checking'),
});
export type MarketPayoutAccountInput = z.infer<typeof MarketPayoutAccountInput>;

// ── Public browse ───────────────────────────────────────────────────────────────

export const MarketProductSort = z.enum([
  'relevance',
  'newest',
  'lowest_price',
  'highest_price',
  'rating',
]);
export type MarketProductSort = z.infer<typeof MarketProductSort>;

/** The faceted browse query for the public marketplace catalog (/products and the
 *  category pages). Cross-tenant — reads the global market_listings projection. */
export const MarketBrowseQuery = z.object({
  q: z.string().max(255).optional(),
  category: MarketCategorySlug.optional(),
  merchant: z.string().max(63).optional(),
  sort: MarketProductSort.default('relevance'),
  minPriceCents: Money.optional(),
  maxPriceCents: Money.optional(),
  inStock: z.boolean().optional(),
  featured: z.boolean().optional(),
  page: z.number().int().min(1).default(1),
  perPage: z.number().int().min(1).max(60).default(24),
});
export type MarketBrowseQuery = z.infer<typeof MarketBrowseQuery>;

// ── Marketplace checkout (single-merchant cart, MoR) ────────────────────────────
//
// sparx.market checkout is single-merchant-per-cart (docs/72 §5 Phase 1). The cart
// + order live on the SELLER's tenant; the public market routes resolve that tenant
// from the listing, and the payment is a sparx-platform direct charge. These mirror
// the storefront contact/shipping shapes but live here so apps/market shares them.

export const MarketCartLineInput = z.object({
  /** The market listing slug the shopper is buying (resolves to a seller variant). */
  variantId: z.string().uuid(),
  quantity: z.number().int().min(1).max(999),
});
export type MarketCartLineInput = z.infer<typeof MarketCartLineInput>;

export const MarketContactInput = z.object({
  email: z.string().email().max(255),
  phone: z.string().max(40).optional(),
  acceptsMarketing: z.boolean().default(false),
});
export type MarketContactInput = z.infer<typeof MarketContactInput>;

export const MarketAddressInput = z.object({
  name: z.string().min(1).max(255),
  line1: z.string().min(1).max(255),
  line2: z.string().max(255).optional(),
  city: z.string().min(1).max(160),
  region: z.string().max(160).optional(),
  postalCode: z.string().min(1).max(32),
  countryCode: z
    .string()
    .length(2)
    .regex(/^[A-Z]{2}$/, 'Country must be ISO 3166-1 alpha-2'),
  phone: z.string().max(40).optional(),
});
export type MarketAddressInput = z.infer<typeof MarketAddressInput>;
