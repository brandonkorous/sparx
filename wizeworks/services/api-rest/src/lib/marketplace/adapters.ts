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

import type { TxClient } from '@wizeworks/db';
import { readSilicaComponentTree } from '@wizeworks/marketplace-schemas';
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
} from '@wizeworks/marketplace-schemas';

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
  // The stored silica Theme payload ({ name, tokens, dark?, fonts? }) — the row's
  // `tokens` JSON column. Rendered as the live preview (docs/118); null on a legacy row.
  tokens: unknown;
}

/** The stored silica payload shape (mirrors @wizeworks/marketplace-schemas SilicaThemePayload),
 *  narrowed defensively — a legacy/hand-edited row may hold anything or NULL. */
function themePreview(raw: unknown): Pick<ThemeFacets, 'tokens' | 'dark' | 'fonts'> {
  if (!raw || typeof raw !== 'object') return { tokens: null, dark: null, fonts: null };
  const p = raw as Record<string, unknown>;
  const bag = (v: unknown): Record<string, string> | null =>
    v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, string>) : null;
  return {
    tokens: bag(p.tokens),
    dark: bag(p.dark),
    fonts: p.fonts ?? null,
  };
}

function themeListing(row: ThemeRow): MarketplaceListing {
  const theme: ThemeFacets = {
    mood: row.mood,
    colorFamily: row.colorFamily,
    density: row.density,
    industry: row.industry,
    ...themePreview(row.tokens),
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
  // The UNION of the themes sparx SHIPS and the themes anyone UPLOADS.
  //
  // ONE SHELF, MANY PUBLISHERS. Every theme is a row, whoever published it — sparx
  // included. sparx's own catalog reaches these rows by publishing itself at boot
  // (lib/marketplace/self-register.ts) rather than by a deploy-time copy step, so
  // "what does the marketplace list" has exactly one answer and a collaborator's
  // upload is not a second-class citizen in a different code path.
  //
  // This briefly served the code catalog directly and filtered sparx's rows out.
  // That fixed the empty-shelf bug but bought it with a split: sparx content came
  // from one place and everyone else's from another, which is the shape that
  // produced two theme systems in the first place.
  loadVisible: async (tx) => {
    const rows = await tx.marketplaceTheme.findMany({
      where: BROWSE_WHERE,
      include: { publisher: PUBLISHER_SELECT },
    });
    return rows.map((row) => themeListing(row));
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
  // The stored silica node tree — the row's `tree` JSON column. Rendered as the
  // live preview (docs/118); null on a legacy row (a BuilderNode tree or NULL).
  tree: unknown;
}

function componentListing(row: ComponentRow): MarketplaceListing {
  // The silica tree travels on BOTH browse + detail (the card renders it live), the
  // same posture as the theme token bag. `readSilicaComponentTree` narrows the
  // stored column: a legacy BuilderNode / NULL row yields null and the preview
  // degrades to a neutral placeholder.
  const tree = readSilicaComponentTree(row.tree);
  const component: ComponentFacets = {
    group: row.group,
    kind: row.kind,
    surfaces: row.surfaces,
    dataBacked: tree != null,
    tree,
    propSpec: [],
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
  // ONE SHELF, MANY PUBLISHERS — see the theme adapter's note. sparx's sections
  // reach these rows by publishing themselves at boot from `SPARX_CATALOG`, the
  // same catalog the Builder's Insert palette reads, so the marketplace lists
  // exactly what the Builder can insert and a collaborator's upload lands in the
  // same table through the same columns.
  loadVisible: async (tx) => {
    const rows = await tx.marketplaceComponent.findMany({
      where: BROWSE_WHERE,
      include: { publisher: PUBLISHER_SELECT },
    });
    return rows.map(componentListing);
  },
  loadOne: async (tx, slug) => {
    const row = await tx.marketplaceComponent.findFirst({
      where: { slug },
      include: { publisher: PUBLISHER_SELECT },
    });
    return row ? componentListing(row) : null;
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
