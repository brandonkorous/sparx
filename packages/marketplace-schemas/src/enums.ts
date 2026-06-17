// Marketplace catalog enums (docs/60 §6) — the small closed vocabularies shared
// by the catalog tables, the API contract, and the dashboard registry. Kept in
// one file so a new value lands once.

import { z } from 'zod';

/** The four catalog categories. Each is one DB table behind a uniform adapter. */
export const MARKETPLACE_CATEGORIES = [
  'blueprints',
  'themes',
  'components',
  'integrations',
] as const;
export const MarketplaceCategory = z.enum(MARKETPLACE_CATEGORIES);
export type MarketplaceCategory = z.infer<typeof MarketplaceCategory>;

/** A listing's lifecycle (docs/60 §11). Only `published` is publicly visible;
 *  the rest are visible to the owning publisher (and sparx review) only. */
export const ListingStatus = z.enum(['draft', 'in_review', 'published', 'suspended', 'rejected']);
export type ListingStatus = z.infer<typeof ListingStatus>;

/** `public` lists in browse + search; `unlisted` is reachable only by direct
 *  slug (an install link a publisher shares). */
export const ListingVisibility = z.enum(['public', 'unlisted']);
export type ListingVisibility = z.infer<typeof ListingVisibility>;

/** How a listing is priced. Monetization itself is deferred (docs/60 §16), but
 *  the shape is carried from day one so the spine never migrates for it. */
export const PricingModel = z.enum(['free', 'one_time', 'subscription']);
export type PricingModel = z.infer<typeof PricingModel>;

/** Who owns a listing (docs/60 D5/D9). `sparx` is first-party; `tenant` is a
 *  sparx tenant publishing its own work; `partner` is an external/verified party. */
export const PublisherType = z.enum(['sparx', 'tenant', 'partner']);
export type PublisherType = z.infer<typeof PublisherType>;
