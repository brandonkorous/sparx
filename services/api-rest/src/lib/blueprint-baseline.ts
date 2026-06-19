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

import { withTenant, type Prisma } from '@sparx/db';
import { isAssetRef, type Blueprint } from '@sparx/blueprints';
import { normalizeEmailTree, type BuilderNode } from '@sparx/builder-schemas';

import { resolveBindingHandles, type InstallResult } from './blueprint-installer.js';

export type ArtifactKind =
  | 'theme'
  | 'brand'
  | 'layout'
  | 'page'
  | 'email'
  | 'component'
  | 'product'
  | 'content'
  | 'category'
  | 'collection';

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
 *  collection template by recordType, the home (slugless singleton) by `home`. */
export function pageNaturalKey(slug: string | null, recordType: string | null): string {
  if (slug) return `slug:${slug}`;
  if (recordType) return `type:${recordType}`;
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
 *  respective versions. */
export function resolveBlueprintArtifacts(
  blueprint: Blueprint,
  result: InstallResult,
  assetMap: Map<string, string>
): ResolvedArtifact[] {
  const asset = (id?: string): string | null => (id ? (assetMap.get(id) ?? null) : null);
  const tree = (t: BuilderNode): BuilderNode => resolveBindingHandles(t, result);
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

  // Layout.
  if (result.layoutId && blueprint.layout) {
    out.push({
      kind: 'layout',
      naturalKey: 'layout',
      refId: result.layoutId,
      content: compact({ name: blueprint.layout.name, tree: tree(blueprint.layout.tree) }),
    });
  }

  // Pages (blueprint-declared only — the injected ensureHome fallback is platform
  // chrome, not blueprint content, so it carries no baseline).
  for (const pg of blueprint.pages) {
    const key = pageNaturalKey(pg.slug ?? null, pg.recordType ?? null);
    const refId =
      result.pages.find((p) => pageNaturalKey(p.slug, p.recordType) === key)?.id ?? null;
    out.push({
      kind: 'page',
      naturalKey: key,
      refId,
      content: compact({
        name: pg.name,
        kind: pg.kind,
        recordType: pg.recordType ?? null,
        slug: pg.slug ?? null,
        tree: tree(pg.tree),
        seoTitle: pg.seoTitle,
        seoDescription: pg.seoDescription,
        canonical: pg.canonical,
        ogImage: pg.ogImage,
        noindex: pg.noindex,
      }),
    });
  }

  // Emails (trees are not data-bound, but emailService.get normalizes on read, so
  // the baseline must store the SAME normalized shape or an untouched email would
  // falsely diff — docs/55 §7.2 parity).
  for (const e of blueprint.emails) {
    const refId = result.emails.find((x) => x.name === e.name)?.id ?? null;
    out.push({
      kind: 'email',
      naturalKey: e.name,
      refId,
      content: compact({
        name: e.name,
        subject: e.subject,
        preheader: e.preheader,
        tree: normalizeEmailTree(e.tree),
      }),
    });
  }

  // Components.
  for (const c of blueprint.components) {
    const refId = result.components.find((x) => x.key === c.key)?.id ?? null;
    out.push({
      kind: 'component',
      naturalKey: c.key,
      refId,
      content: compact({
        key: c.key,
        name: c.name,
        group: c.group,
        icon: c.icon,
        description: c.description,
        surfaces: c.surfaces,
        tree: c.tree,
        propSpec: c.propSpec,
      }),
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
          parentHandle: c.parentHandle,
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
          type: c.type,
          ruleSet: c.ruleSet,
          productHandles: c.productHandles,
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
        content: compact({
          handle: p.handle,
          title: p.title,
          description: p.description,
          status: p.status,
          productType: p.productType,
          vendor: p.vendor,
          tags: p.tags,
          fulfillmentType: p.fulfillmentType,
          weight: p.weight,
          dimensions: p.dimensions,
          taxClass: p.taxClass,
          requiresShipping: p.requiresShipping,
          seoTitle: p.seoTitle,
          seoDescription: p.seoDescription,
          ogImage: asset(p.ogImageAssetId) ?? undefined,
          categoryHandles: p.categoryHandles,
          collectionHandles: p.collectionHandles,
          options: p.options,
          variants: p.variants.map((v) =>
            compact({
              sku: v.sku,
              title: v.title,
              optionValues: v.optionValues,
              priceCents: v.priceCents,
              compareAtPriceCents: v.compareAtPriceCents,
              costCents: v.costCents,
              currency: v.currency,
              weight: v.weight,
              dimensions: v.dimensions,
              inventoryPolicy: v.inventoryPolicy,
              requiresShipping: v.requiresShipping,
              isDefault: v.isDefault,
              position: v.position,
            })
          ),
          images: p.images.map((img) =>
            compact({
              assetId: asset(img.assetId),
              variantSku: img.variantSku,
              optionValues: img.optionValues,
              position: img.position,
              alt: img.alt,
              isPrimary: img.isPrimary,
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

  return out;
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
