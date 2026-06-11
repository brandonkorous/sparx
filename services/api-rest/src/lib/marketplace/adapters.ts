// Per-category marketplace adapters (docs/60 §6, D4). Each adapter owns the
// Prisma specifics for ONE catalog table and normalizes its rows into the
// uniform MarketplaceListing the browse/detail UI renders. The catalog SERVICE
// (./catalog-service) is then pure list-algebra over MarketplaceListing[] —
// blind to which table it came from — so a new category is one adapter here plus
// a registry entry, no service change.
//
// Loading is RLS-bound: `loadVisible`/`loadOne` run inside the caller's
// withTenant/withSystem tx, so the `marketplace_visibility` policy already scopes
// rows (published to everyone; a tenant its own drafts too). Browse additionally
// pins to status=published + visibility=public so a future draft never leaks into
// the public list; detail-by-slug allows unlisted-published (a shared install
// link).

import type { TxClient } from '@sparx/db';
import type {
  BlueprintContents,
  ComponentFacets,
  IntegrationFacets,
  ListingStatus,
  ListingVisibility,
  MarketplaceCategory,
  MarketplaceListing,
  MarketplaceMedia,
  PricingModel,
  PublisherType,
  ThemeFacets,
} from '@sparx/marketplace-schemas';

// A facet dimension: its query/bucket key + the values a listing contributes.
export interface FacetDef {
  key: string;
  values: (listing: MarketplaceListing) => string[];
}

export interface CategoryAdapter {
  category: MarketplaceCategory;
  /** Browse rows: published + public, RLS-scoped, mapped to listings. */
  loadVisible: (tx: TxClient) => Promise<MarketplaceListing[]>;
  /** One listing by slug (published any-visibility, or the tenant's own). */
  loadOne: (tx: TxClient, slug: string) => Promise<MarketplaceListing | null>;
  /** The free-text haystack `q` matches against. */
  searchText: (listing: MarketplaceListing) => string;
  /** The facet dimensions this category exposes. */
  facets: FacetDef[];
}

// ── Shared spine mapping ────────────────────────────────────────────────────

interface SpineRow {
  id: string;
  slug: string;
  name: string;
  tagline: string | null;
  description: string | null;
  media: unknown;
  icon: string | null;
  accent: string | null;
  version: string;
  priceCents: number;
  pricingModel: string;
  status: string;
  visibility: string;
  installCount: number;
  ratingCount: number;
  ratingAvg: { toString(): string };
  sortWeight: number;
  publishedAt: Date | null;
  publisher: {
    id: string;
    type: string;
    slug: string;
    displayName: string;
    verified: boolean;
    websiteUrl: string | null;
  };
}

type SpineListing = Omit<MarketplaceListing, 'blueprint' | 'theme' | 'component' | 'integration'>;

function baseListing(row: SpineRow, category: MarketplaceCategory): SpineListing {
  return {
    category,
    id: row.id,
    slug: row.slug,
    name: row.name,
    tagline: row.tagline,
    description: row.description,
    media: (Array.isArray(row.media) ? row.media : []) as MarketplaceMedia[],
    icon: row.icon,
    accent: row.accent,
    version: row.version,
    publisher: {
      id: row.publisher.id,
      type: row.publisher.type as PublisherType,
      slug: row.publisher.slug,
      displayName: row.publisher.displayName,
      verified: row.publisher.verified,
      websiteUrl: row.publisher.websiteUrl,
    },
    price: { cents: row.priceCents, model: row.pricingModel as PricingModel },
    status: row.status as ListingStatus,
    visibility: row.visibility as ListingVisibility,
    installCount: row.installCount,
    rating: { average: Number(row.ratingAvg), count: row.ratingCount },
    sortWeight: row.sortWeight,
    publishedAt: row.publishedAt ? row.publishedAt.toISOString() : null,
  };
}

const PUBLISHER_SELECT = {
  select: {
    id: true,
    type: true,
    slug: true,
    displayName: true,
    verified: true,
    websiteUrl: true,
  },
} as const;

/** Browse predicate: published + publicly listed. RLS is the backstop; this is
 *  the product rule (drafts/unlisted never appear in the public list). */
const BROWSE_WHERE = { status: 'published', visibility: 'public' } as const;

// ── Blueprints ──────────────────────────────────────────────────────────────

interface BlueprintRow extends SpineRow {
  vertical: string;
  requiredModules: string[];
  contents: unknown;
}

function blueprintListing(row: BlueprintRow): MarketplaceListing {
  return {
    ...baseListing(row, 'blueprints'),
    blueprint: {
      vertical: row.vertical,
      requiredModules: row.requiredModules,
      contents: (row.contents ?? {}) as BlueprintContents,
    },
    theme: null,
    component: null,
    integration: null,
  };
}

const blueprintAdapter: CategoryAdapter = {
  category: 'blueprints',
  loadVisible: async (tx) => {
    const rows = await tx.marketplaceBlueprint.findMany({
      where: BROWSE_WHERE,
      include: { publisher: PUBLISHER_SELECT },
    });
    return rows.map(blueprintListing);
  },
  loadOne: async (tx, slug) => {
    const row = await tx.marketplaceBlueprint.findFirst({
      where: { slug },
      include: { publisher: PUBLISHER_SELECT },
    });
    return row ? blueprintListing(row) : null;
  },
  searchText: (l) => `${l.name} ${l.tagline ?? ''} ${l.blueprint?.vertical ?? ''}`,
  facets: [
    { key: 'vertical', values: (l) => (l.blueprint ? [l.blueprint.vertical] : []) },
    { key: 'modules', values: (l) => l.blueprint?.requiredModules ?? [] },
  ],
};

// ── Themes ──────────────────────────────────────────────────────────────────

interface ThemeRow extends SpineRow {
  mood: string | null;
  colorFamily: string | null;
  density: string | null;
  industry: string | null;
}

function themeListing(row: ThemeRow): MarketplaceListing {
  const theme: ThemeFacets = {
    mood: row.mood,
    colorFamily: row.colorFamily,
    density: row.density,
    industry: row.industry,
  };
  return {
    ...baseListing(row, 'themes'),
    blueprint: null,
    theme,
    component: null,
    integration: null,
  };
}

const themeAdapter: CategoryAdapter = {
  category: 'themes',
  loadVisible: async (tx) => {
    const rows = await tx.marketplaceTheme.findMany({
      where: BROWSE_WHERE,
      include: { publisher: PUBLISHER_SELECT },
    });
    return rows.map(themeListing);
  },
  loadOne: async (tx, slug) => {
    const row = await tx.marketplaceTheme.findFirst({
      where: { slug },
      include: { publisher: PUBLISHER_SELECT },
    });
    return row ? themeListing(row) : null;
  },
  searchText: (l) =>
    `${l.name} ${l.tagline ?? ''} ${l.theme?.industry ?? ''} ${l.theme?.mood ?? ''}`,
  facets: [
    { key: 'mood', values: (l) => (l.theme?.mood ? [l.theme.mood] : []) },
    { key: 'colorFamily', values: (l) => (l.theme?.colorFamily ? [l.theme.colorFamily] : []) },
    { key: 'industry', values: (l) => (l.theme?.industry ? [l.theme.industry] : []) },
  ],
};

// ── Components ──────────────────────────────────────────────────────────────

interface ComponentRow extends SpineRow {
  group: string;
  kind: string | null;
  surfaces: string[];
  tree?: unknown;
  propSpec?: unknown;
}

// `detail` surfaces the DATA payload (tree + propSpec) for the "Add" clone path
// (docs/85). Browse omits it — the node tree is heavy and unused on a card.
function componentListing(row: ComponentRow, detail = false): MarketplaceListing {
  const component: ComponentFacets = {
    group: row.group,
    kind: row.kind,
    surfaces: row.surfaces,
    // Cheap flag on every row (browse + detail): does this carry a DATA tree to
    // clone, vs a system-palette pointer resolved by builder `type`? The heavy
    // tree/propSpec themselves ride only on detail.
    dataBacked: row.tree != null,
    ...(detail
      ? { tree: row.tree ?? null, propSpec: Array.isArray(row.propSpec) ? row.propSpec : [] }
      : {}),
  };
  return {
    ...baseListing(row, 'components'),
    blueprint: null,
    theme: null,
    component,
    integration: null,
  };
}

const componentAdapter: CategoryAdapter = {
  category: 'components',
  loadVisible: async (tx) => {
    const rows = await tx.marketplaceComponent.findMany({
      where: BROWSE_WHERE,
      include: { publisher: PUBLISHER_SELECT },
    });
    return rows.map((r) => componentListing(r));
  },
  loadOne: async (tx, slug) => {
    const row = await tx.marketplaceComponent.findFirst({
      where: { slug },
      include: { publisher: PUBLISHER_SELECT },
    });
    return row ? componentListing(row, true) : null;
  },
  searchText: (l) => `${l.name} ${l.tagline ?? ''} ${l.component?.group ?? ''}`,
  facets: [
    { key: 'group', values: (l) => (l.component ? [l.component.group] : []) },
    { key: 'surface', values: (l) => l.component?.surfaces ?? [] },
  ],
};

// ── Integrations ────────────────────────────────────────────────────────────

interface IntegrationRow extends SpineRow {
  providerSlug: string;
  kind: string;
  scopes: string[];
}

function integrationListing(row: IntegrationRow): MarketplaceListing {
  const integration: IntegrationFacets = {
    providerSlug: row.providerSlug,
    kind: row.kind,
    scopes: row.scopes,
  };
  return {
    ...baseListing(row, 'integrations'),
    blueprint: null,
    theme: null,
    component: null,
    integration,
  };
}

const integrationAdapter: CategoryAdapter = {
  category: 'integrations',
  loadVisible: async (tx) => {
    const rows = await tx.marketplaceIntegration.findMany({
      where: BROWSE_WHERE,
      include: { publisher: PUBLISHER_SELECT },
    });
    return rows.map(integrationListing);
  },
  loadOne: async (tx, slug) => {
    const row = await tx.marketplaceIntegration.findFirst({
      where: { slug },
      include: { publisher: PUBLISHER_SELECT },
    });
    return row ? integrationListing(row) : null;
  },
  searchText: (l) => `${l.name} ${l.tagline ?? ''} ${l.integration?.kind ?? ''}`,
  facets: [{ key: 'kind', values: (l) => (l.integration ? [l.integration.kind] : []) }],
};

export const ADAPTERS: Record<MarketplaceCategory, CategoryAdapter> = {
  blueprints: blueprintAdapter,
  themes: themeAdapter,
  components: componentAdapter,
  integrations: integrationAdapter,
};
