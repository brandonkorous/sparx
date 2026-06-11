// Marketplace catalog types for the dashboard. A local mirror of the API's
// @sparx/marketplace-schemas contract (docs/60), kept as a plain module so both
// server pages and client components can import it. (Defined locally rather than
// imported from the package so the dashboard takes no new workspace dependency —
// the shape is stable; keep it in lockstep with packages/marketplace-schemas.)

export type MarketplaceCategoryId = 'blueprints' | 'themes' | 'components' | 'integrations';

export interface MarketplaceMedia {
  url: string;
  alt?: string;
  kind: 'image' | 'video';
}

export interface MarketplacePublisherDto {
  id: string;
  type: 'sparx' | 'tenant' | 'partner';
  slug: string;
  displayName: string;
  verified: boolean;
  websiteUrl: string | null;
}

export interface BlueprintContents {
  products: number;
  categories: number;
  collections: number;
  content: number;
  pages: number;
  emails: number;
  components: number;
  theme: string | null;
  hasLayout: boolean;
}

export interface BlueprintFacets {
  vertical: string;
  requiredModules: string[];
  contents: BlueprintContents;
}

export interface ThemeFacets {
  mood: string | null;
  colorFamily: string | null;
  density: string | null;
  industry: string | null;
}

export interface ComponentFacets {
  group: string;
  kind: string | null;
  surfaces: string[];
  // True for a composed DATA component (a tree to clone) vs a system pointer.
  dataBacked?: boolean;
  // DATA payload (docs/85) — present only on detail; drives the "Add" clone.
  tree?: unknown;
  propSpec?: unknown[];
}

export interface IntegrationFacets {
  providerSlug: string;
  kind: string;
  scopes: string[];
}

/** A blueprint's per-tenant install state — a route overlay (docs/60 §6). */
export interface MarketplaceInstallState {
  id: string;
  status: string;
  version: string;
  updateAvailable: boolean;
}

/** The normalized listing the browse/detail UI renders for any category. Exactly
 *  the block matching `category` is populated. */
export interface MarketplaceListing {
  category: MarketplaceCategoryId;
  id: string;
  slug: string;
  name: string;
  tagline: string | null;
  description: string | null;
  media: MarketplaceMedia[];
  icon: string | null;
  accent: string | null;
  version: string;
  publisher: MarketplacePublisherDto;
  price: { cents: number; model: 'free' | 'one_time' | 'subscription' };
  status: string;
  visibility: string;
  installCount: number;
  rating: { average: number; count: number };
  sortWeight: number;
  publishedAt: string | null;
  blueprint: BlueprintFacets | null;
  theme: ThemeFacets | null;
  component: ComponentFacets | null;
  integration: IntegrationFacets | null;
  install?: MarketplaceInstallState | null;
}

/** facetKey → (value → count). */
export type MarketplaceFacetBucket = Record<string, number>;

/** The faceted, paged browse response (docs/60 §6). */
export interface MarketplaceListResponse {
  items: MarketplaceListing[];
  total: number;
  facets: Record<string, MarketplaceFacetBucket>;
  next_cursor: string | null;
}
