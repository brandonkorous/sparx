// The normalized MarketplaceListing (docs/60 §6, D4) — the single shape the
// browse + detail UI renders for ANY category. A uniform "spine" (identity,
// media, publisher, pricing, status, stats) plus exactly one category-specific
// block matching `category`. The api-rest adapters map each catalog table row
// onto this; the dashboard + apps/web consume it verbatim. Dates are ISO strings
// (JSON-safe).

import { z } from 'zod';

import {
  ListingStatus,
  ListingVisibility,
  MarketplaceCategory,
  PricingModel,
  PublisherType,
} from './enums';

/** One gallery entry. The first is the card image. */
export const MarketplaceMedia = z.object({
  url: z.string(),
  alt: z.string().optional(),
  kind: z.enum(['image', 'video']).default('image'),
});
export type MarketplaceMedia = z.infer<typeof MarketplaceMedia>;

/** The publisher identity surfaced on a listing ("by Acme Co"). */
export const MarketplacePublisherDto = z.object({
  id: z.string(),
  type: PublisherType,
  slug: z.string(),
  displayName: z.string(),
  verified: z.boolean(),
  websiteUrl: z.string().nullable(),
});
export type MarketplacePublisherDto = z.infer<typeof MarketplacePublisherDto>;

// ── Per-category blocks ─────────────────────────────────────────────────────

/** "What this creates" counts for a blueprint card — cheap to read (no manifest). */
export const BlueprintContents = z.object({
  products: z.number().int().default(0),
  categories: z.number().int().default(0),
  collections: z.number().int().default(0),
  content: z.number().int().default(0),
  pages: z.number().int().default(0),
  emails: z.number().int().default(0),
  components: z.number().int().default(0),
  theme: z.string().nullable().default(null),
  hasLayout: z.boolean().default(false),
});
export type BlueprintContents = z.infer<typeof BlueprintContents>;

export const BlueprintFacets = z.object({
  vertical: z.string(),
  requiredModules: z.array(z.string()),
  contents: BlueprintContents,
});
export type BlueprintFacets = z.infer<typeof BlueprintFacets>;

export const ThemeFacets = z.object({
  mood: z.string().nullable(),
  colorFamily: z.string().nullable(),
  density: z.string().nullable(),
  industry: z.string().nullable(),
});
export type ThemeFacets = z.infer<typeof ThemeFacets>;

export const ComponentFacets = z.object({
  group: z.string(),
  kind: z.string().nullable(),
  surfaces: z.array(z.string()),
  // True when this is a composed DATA component (a node tree to clone) vs a
  // system-palette pointer. Cheap; present on browse + detail.
  dataBacked: z.boolean().optional(),
  // The DATA payload (docs/85), populated only on DETAIL (loadOne), not browse:
  // the node tree + prop spec the "Add" action clones into a tenant component.
  // Null for system-palette pointers (resolved by builder `type` at copy time).
  tree: z.unknown().nullable().optional(),
  propSpec: z.array(z.unknown()).optional(),
});
export type ComponentFacets = z.infer<typeof ComponentFacets>;

export const IntegrationFacets = z.object({
  providerSlug: z.string(),
  kind: z.string(),
  scopes: z.array(z.string()),
});
export type IntegrationFacets = z.infer<typeof IntegrationFacets>;

// ── Per-tenant overlay ───────────────────────────────────────────────────────

/** A blueprint's install state for the CURRENT tenant (docs/60 §6). This is a
 *  per-tenant OVERLAY the authed route layers on, never part of the
 *  tenant-agnostic catalog — so it's absent/null on the public surface. The same
 *  shape generalizes to a theme's "applied" or an integration's "connected"
 *  state in later phases. */
export const MarketplaceInstallState = z.object({
  id: z.string(),
  status: z.string(),
  version: z.string(),
  updateAvailable: z.boolean(),
});
export type MarketplaceInstallState = z.infer<typeof MarketplaceInstallState>;

// ── The listing ─────────────────────────────────────────────────────────────

export const MarketplaceListing = z.object({
  category: MarketplaceCategory,
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  tagline: z.string().nullable(),
  description: z.string().nullable(),
  media: z.array(MarketplaceMedia),
  icon: z.string().nullable(),
  accent: z.string().nullable(),
  version: z.string(),
  publisher: MarketplacePublisherDto,
  price: z.object({ cents: z.number().int(), model: PricingModel }),
  status: ListingStatus,
  visibility: ListingVisibility,
  installCount: z.number().int(),
  rating: z.object({ average: z.number(), count: z.number().int() }),
  sortWeight: z.number().int(),
  publishedAt: z.string().nullable(),
  // Exactly the block matching `category` is populated; the rest are null.
  blueprint: BlueprintFacets.nullable(),
  theme: ThemeFacets.nullable(),
  component: ComponentFacets.nullable(),
  integration: IntegrationFacets.nullable(),
  // Per-tenant overlay, route-supplied (absent on the public surface + from the
  // tenant-agnostic catalog service).
  install: MarketplaceInstallState.nullish(),
});
export type MarketplaceListing = z.infer<typeof MarketplaceListing>;
