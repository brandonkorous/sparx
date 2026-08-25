// Blueprint baseline capture (docs/55 §4) — turns a Blueprint manifest + the
// install id-map into the per-artifact BASELINE rows (the three-way-merge
// ancestor). One `tenant_blueprint_install_artifacts` row per artifact, holding
// the canonical "blueprint-side" content for the installed version.
//
// This is the shared content layer for BOTH directions of a merge:
//   · install / update-apply call `resolveBlueprintArtifacts` to compute the
//     content for a given blueprint VERSION (the `base` at install, the `incoming`
//     at update), then `captureBaselines` persists it as the new ancestor.
//   · the merge engine (docs/55 §8) reads these baselines back as `base` and
//     compares them to the live rows (`current`) extracted in the same canonical
//     shape, so an untouched artifact satisfies base == current and fast-forwards.
//
// Resolution mirrors what the installer wrote: tree bindings are resolved
// handle→id (so a page baseline matches its stored draftTree), and image / asset
// refs are resolved manifest-id→MediaAsset-id (so a product baseline matches its
// VariantImage rows). Optional fields are omitted when unset to keep the canonical
// JSON stable.

import { withTenant, type Prisma } from '@wizeworks/db';
import { isAssetRef, type Blueprint } from '@wizeworks/blueprints';
import type { SilicaNode } from '@wizeworks/builder-schemas';

import { resolveBindingHandles, type InstallResult } from './blueprint-installer.js';

export type ArtifactKind =
  | 'theme'
  | 'brand'
  // The site chrome. Was `layout` (a BuilderLayout row the install created); it is
  // now the silica FRAME written onto the property's existing active layout, so the
  // baseline tracks the tree rather than a row it owns.
  | 'frame'
  | 'page'
  | 'email'
  | 'product'
  | 'content'
  | 'category'
  | 'collection';

/**
 * The artifact kinds that are the design's EXAMPLES rather than its structure
 * (issue 098) — the rows an install leaves out when the owner asks for the
 * design without its furniture.
 *
 * Products and articles, and nothing else. A category, a collection and the
 * pages are the design's shape: an empty "Knitwear" is a shelf waiting for her
 * own stock, whereas "Cashmere Crew, $180" is somebody else's stock sitting on
 * it. The scheduling rows are examples too, but they carry no baseline of their
 * own, so the installer skips that whole slice instead of filtering here.
 */
export const EXAMPLE_ARTIFACT_KINDS: ReadonlySet<ArtifactKind> = new Set<ArtifactKind>([
  'product',
  'content',
]);

export interface ResolvedArtifact {
  kind: ArtifactKind;
  /** Correlation key back to the manifest (docs/55 §4). */
  naturalKey: string;
  /** The created row id this baseline tracks (null for the tenant-level `brand`). */
  refId: string | null;
  /** The canonical blueprint-side content for this artifact + version. */
  content: Record<string, unknown>;
}

/** A page's stable correlation key across versions: a singleton by slug, a
 *  collection template by recordType, the home (slugless singleton) by `home`.
 *  A per-TYPE product page (docs/143 Option B) is keyed by recordType + subtype, so
 *  the default product page and the Apparel product page — both `commerce.product`
 *  with no slug — stay distinct artifacts instead of colliding on one key. */
export function pageNaturalKey(
  slug: string | null,
  recordType: string | null,
  recordSubtype: string | null = null
): string {
  if (slug) return `slug:${slug}`;
  if (recordType)
    return recordSubtype ? `type:${recordType}:${recordSubtype}` : `type:${recordType}`;
  return 'home';
}

/** Drop `undefined` values so the stored JSON is stable (an unset optional must
 *  not read as a tenant edit later). */
function compact<T extends Record<string, unknown>>(obj: T): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) if (v !== undefined) out[k] = v;
  return out;
}

/** Resolve `{ $asset: id }` sentinels in a content body to MediaAsset ids (mirrors
 *  the installer's resolveAssetRefs — kept local so baseline has no install-time
 *  coupling beyond the id-map). */
function resolveAssetRefs(value: unknown, assets: Map<string, string>): unknown {
  if (isAssetRef(value)) return assets.get(value.$asset) ?? null;
  if (Array.isArray(value)) return value.map((v) => resolveAssetRefs(v, assets));
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = resolveAssetRefs(v, assets);
    }
    return out;
  }
  return value;
}

/** Build the canonical content for every artifact a blueprint version declares,
 *  paired with the row id this install created for it (from the id-map). The
 *  `base` at install and the `incoming` at update are both this, for their
 *  respective versions.
 *
 *  `sampleData: false` drops the example kinds (issue 098). It has to apply on
 *  BOTH sides of the merge: at install so no baseline claims a product that was
 *  never written, and at update so a newer version of the design cannot deliver
 *  the examples through the back door of "an artifact this version adds". */
export function resolveBlueprintArtifacts(
  blueprint: Blueprint,
  result: InstallResult,
  assetMap: Map<string, string>,
  options: { sampleData?: boolean } = {}
): ResolvedArtifact[] {
  const sampleData = options.sampleData ?? true;
  const asset = (id?: string): string | null => (id ? (assetMap.get(id) ?? null) : null);
  const tree = (t: SilicaNode): SilicaNode => resolveBindingHandles(t, result);
  const out: ResolvedArtifact[] = [];

  // Theme — the shipped SiteTheme (basePresetKey + presentation overlay + look).
  if (result.theme) {
    out.push({
      kind: 'theme',
      naturalKey: 'theme',
      refId: result.theme.id,
      content: compact({
        name: blueprint.theme.name,
        basePresetKey: blueprint.theme.basePresetKey,
        presentation: blueprint.theme.presentation ?? {},
        brand: blueprint.theme.brand ?? null,
      }),
    });
  }

  // Brand identity (TenantBrand on the primary / brand_override on a secondary).
  // Socials + the customer-facing site name are seed-once on Property (not part of
  // the TenantBrand merge surface), so they are intentionally NOT baselined here.
  const b = blueprint.brand;
  out.push({
    kind: 'brand',
    naturalKey: 'brand',
    refId: null,
    content: compact({
      businessName: b.businessName,
      tagline: b.tagline,
      colors: compact({ ...b.colors }),
      fonts: { heading: b.fonts.heading, body: b.fonts.body },
      logoLight: asset(b.logoLightAssetId) ?? undefined,
      logoDark: asset(b.logoDarkAssetId) ?? undefined,
      favicon: asset(b.faviconAssetId) ?? undefined,
    }),
  });

  // The site frame (chrome). Keyed `frame` rather than `layout`: it is no longer a
  // layout ROW the install owns, it is the silica frame written onto the property's
  // active layout, so the baseline tracks the tree itself.
  if (blueprint.site?.frame) {
    out.push({
      kind: 'frame',
      naturalKey: 'frame',
      refId: null,
      content: compact({ tree: tree(blueprint.site.frame.root) }),
    });
  }

  // Pages.
  for (const pg of blueprint.site?.pages ?? []) {
    const key = pageNaturalKey(pg.slug ?? null, pg.recordType ?? null, pg.recordSubtype ?? null);
    const refId =
      result.pages.find(
        (p) => pageNaturalKey(p.slug, p.recordType, p.recordSubtype ?? null) === key
      )?.id ?? null;
    out.push({
      kind: 'page',
      naturalKey: key,
      refId,
      content: compact({
        name: pg.name,
        kind: pg.kind,
        recordType: pg.recordType ?? null,
        recordSubtype: pg.recordSubtype ?? null,
        slug: pg.slug ?? null,
        tree: tree(pg.root),
        seoTitle: pg.seoTitle,
        seoDescription: pg.seoDescription,
        canonical: pg.canonical,
        ogImage: pg.ogImage,
        noindex: pg.noindex,
      }),
    });
  }

  // Emails. The silica document is stored verbatim — it is what the row holds and
  // what a later version diffs against, so no normalization pass can drift them apart.
  for (const e of blueprint.emails) {
    const refId = result.emails.find((x) => x.name === e.name)?.id ?? null;
    out.push({
      kind: 'email',
      naturalKey: e.name,
      refId,
      content: compact({ name: e.name, doc: e.doc }),
    });
  }

  // Commerce.
  const commerce = blueprint.commerce;
  if (commerce) {
    for (const c of commerce.categories) {
      out.push({
        kind: 'category',
        naturalKey: c.handle,
        refId: result.categories[c.handle] ?? null,
        content: compact({
          handle: c.handle,
          name: c.name,
          description: c.description,
          position: c.position,
          featured: c.featured,
          seoTitle: c.seoTitle,
          seoDescription: c.seoDescription,
        }),
      });
    }
    for (const c of commerce.collections) {
      out.push({
        kind: 'collection',
        naturalKey: c.handle,
        refId: result.collections[c.handle] ?? null,
        content: compact({
          handle: c.handle,
          name: c.name,
          description: c.description,
          featured: c.featured,
          seoTitle: c.seoTitle,
          seoDescription: c.seoDescription,
        }),
      });
    }
    for (const p of commerce.products) {
      const refId = result.products.find((x) => x.handle === p.handle)?.id ?? null;
      out.push({
        kind: 'product',
        naturalKey: p.handle,
        refId,
        // The merge surface (docs/55 §7.3): tenant-editable scalar fields + variant
        // prices by SKU. Structural fields (options, images, category/collection
        // membership) are install-set, not field-merged in v1 — so they're left out
        // of the baseline to keep base == live-extract exact.
        content: compact({
          handle: p.handle,
          title: p.title,
          description: p.description,
          status: p.status,
          productType: p.productType,
          // Typed product type + attributes (docs/143) — field-merged like the other
          // tenant-editable scalars, so a blueprint update can adjust a product's type
          // or attribute values without stomping a tenant's own edits.
          productTypeKey: p.productTypeKey,
          attributes: p.attributes,
          vendor: p.vendor,
          tags: p.tags,
          fulfillmentType: p.fulfillmentType,
          weight: p.weight,
          taxClass: p.taxClass,
          requiresShipping: p.requiresShipping,
          seoTitle: p.seoTitle,
          seoDescription: p.seoDescription,
          variants: p.variants.map((v) =>
            compact({
              sku: v.sku,
              priceCents: v.priceCents,
              compareAtPriceCents: v.compareAtPriceCents,
              costCents: v.costCents,
            })
          ),
        }),
      });
    }
  }

  // Content entries.
  for (const entry of blueprint.content) {
    const slug = entry.slug ?? null;
    const refId =
      result.content.find((x) => x.typeKey === entry.typeKey && x.slug === slug)?.id ?? null;
    const seo = entry.seo
      ? compact({
          title: entry.seo.title,
          description: entry.seo.description,
          canonical: entry.seo.canonical,
          robots: entry.seo.robots,
          ogImage: asset(entry.seo.ogImageAssetId) ?? undefined,
        })
      : {};
    out.push({
      kind: 'content',
      naturalKey: `${entry.typeKey}:${entry.slug ?? ''}`,
      refId,
      content: compact({
        typeKey: entry.typeKey,
        slug,
        status: entry.status,
        body: resolveAssetRefs(entry.body, assetMap),
        seo,
      }),
    });
  }

  return sampleData ? out : out.filter((a) => !EXAMPLE_ARTIFACT_KINDS.has(a.kind));
}

/** Persist (upsert) the per-artifact baselines for an install at a given blueprint
 *  version. Called after install (the v1 ancestor) and after an applied update (the
 *  vN ancestor, docs/55 §4). Re-managing an artifact clears any orphan flag; a
 *  tenant `detach` is sticky and never re-managed here. */
export async function captureBaselines(
  ctx: { tenantId: string; userId?: string },
  installId: string,
  version: string,
  artifacts: ResolvedArtifact[]
): Promise<void> {
  await withTenant(ctx, async (tx) => {
    for (const a of artifacts) {
      await tx.tenantBlueprintInstallArtifact.upsert({
        where: {
          installId_kind_naturalKey: { installId, kind: a.kind, naturalKey: a.naturalKey },
        },
        create: {
          tenantId: ctx.tenantId,
          installId,
          kind: a.kind,
          refId: a.refId,
          naturalKey: a.naturalKey,
          baseline: a.content as Prisma.InputJsonValue,
          baselineVersion: version,
        },
        update: {
          refId: a.refId,
          baseline: a.content as Prisma.InputJsonValue,
          baselineVersion: version,
          managed: true,
        },
      });
    }
  });
}

/** Read an install's baseline rows (the merge ancestors), keyed for lookup. */
export async function loadBaselines(
  ctx: { tenantId: string; userId?: string },
  installId: string
): Promise<
  Map<
    string,
    {
      id: string;
      kind: ArtifactKind;
      naturalKey: string;
      refId: string | null;
      baseline: Record<string, unknown>;
      baselineVersion: string;
      managed: boolean;
      detached: boolean;
    }
  >
> {
  const rows = await withTenant(ctx, (tx) =>
    tx.tenantBlueprintInstallArtifact.findMany({ where: { installId } })
  );
  const map = new Map<
    string,
    {
      id: string;
      kind: ArtifactKind;
      naturalKey: string;
      refId: string | null;
      baseline: Record<string, unknown>;
      baselineVersion: string;
      managed: boolean;
      detached: boolean;
    }
  >();
  for (const r of rows) {
    map.set(`${r.kind}:${r.naturalKey}`, {
      id: r.id,
      kind: r.kind as ArtifactKind,
      naturalKey: r.naturalKey,
      refId: r.refId,
      baseline: (r.baseline ?? {}) as Record<string, unknown>,
      baselineVersion: r.baselineVersion,
      managed: r.managed,
      detached: r.detached,
    });
  }
  return map;
}
