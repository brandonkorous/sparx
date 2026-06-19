// Tenant blueprint installer (docs/54 §5) — replays a declarative Blueprint
// manifest through the existing service layer to provision a whole themed tenant:
// brand identity + a shipped SiteTheme, CMS content, a commerce catalog, builder
// pages + the site layout, tenant components, and marketing emails. Everything
// is created as DRAFT (docs/54 D4); `goLiveInstall` publishes it on the tenant's
// explicit "go live".
//
// Synchronous for now (called straight from the route). The doc's target is an
// async `template-installer` Cloud Run worker on `template.install`; this code is
// structured (one pure-ish function, services do their own withTenant) so it can
// move into that worker unchanged later.
//
// Reference resolution: the manifest links by handle/asset-id; this builds an id
// map slice by slice (assets → brand/theme → content → commerce → components →
// pages/layout → emails) so every later reference resolves to a real UUID.

import type { FastifyBaseLogger } from 'fastify';

import { prisma, withTenant, type Prisma } from '@sparx/db';
import {
  categoryService,
  collectionService,
  productService,
  variantService,
} from '@sparx/commerce';
import { componentService, emailService, layoutService, pageService } from '@sparx/builder';
import { publishService, savedThemeService } from '@sparx/sitebuilder';
import {
  parseTypeSchema,
  resolveType,
  validateAndNormalizeBody,
} from '@sparx/api-core/content-types';
import { recordRevision, syncReferences } from '@sparx/api-core/entries';
import { publish } from '@sparx/api-core/pubsub';
import { isAssetRef, type Blueprint } from '@sparx/blueprints';
import type { BuilderNode } from '@sparx/builder-schemas';

import { captureBaselines, resolveBlueprintArtifacts } from './blueprint-baseline.js';

export interface InstallContext {
  tenantId: string;
  userId: string | null;
  /** The property to install into — always the tenant's PRIMARY (docs/54 D6); the
   *  route resolves it via resolvePrimaryPropertyId. */
  propertyId: string;
  logger: FastifyBaseLogger;
}

/** The id map + counts recorded on the install row — powers the review surface
 *  and go-live (publishing exactly what was created). */
export interface InstallResult {
  assets: Record<string, string>; // manifest asset id → MediaAsset id
  categories: Record<string, string>; // handle → id
  collections: Record<string, string>; // handle → id
  products: { handle: string; id: string }[];
  components: { key: string; id: string }[];
  theme: { id: string; name: string } | null;
  layoutId: string | null;
  pages: { name: string; id: string; recordType: string | null; slug: string | null }[];
  emails: { name: string; id: string }[];
  content: { typeKey: string; slug: string | null; id: string }[];
  counts: Record<string, number>;
}

/** Resolve handle-addressed commerce bindings to the real row ids (docs/103).
 *
 *  A blueprint authors collection repeaters and entity pins by stable HANDLE — e.g.
 *  a Menu page's product grid binds `{ source: { from: 'category', id: 'acai-bowls' } }`
 *  — because it cannot know the row ids until install mints them. This walks a page /
 *  layout tree and rewrites every `binding.source.id` (category / collection source)
 *  and entity-pin `binding.id` (product / collection / category) from a handle to the
 *  id this install just created. An id that matches no handle (already real, or `all`)
 *  is left untouched, so it is safe to run on any tree. Returns a fresh tree; the input
 *  blueprint payload is not mutated. */
export function resolveBindingHandles(tree: BuilderNode, result: InstallResult): BuilderNode {
  const categories = result.categories ?? {};
  const collections = result.collections ?? {};
  const products: Record<string, string> = {};
  for (const p of result.products ?? []) products[p.handle] = p.id;
  const byEntity: Record<string, Record<string, string>> = {
    product: products,
    collection: collections,
    category: categories,
  };
  const walk = (n: BuilderNode): BuilderNode => {
    const out: BuilderNode = { ...n };
    if (n.binding) {
      const b = { ...n.binding };
      const src = b.source;
      if (src && (src.from === 'category' || src.from === 'collection') && src.id) {
        const map = src.from === 'category' ? categories : collections;
        const id = map[src.id];
        if (id) b.source = { ...src, id };
      }
      if (b.entity && b.id) {
        const id = byEntity[b.entity]?.[b.id];
        if (id) b.id = id;
      }
      out.binding = b;
    }
    if (n.children) out.children = n.children.map(walk);
    return out;
  };
  return walk(tree);
}

// ── small helpers ──────────────────────────────────────────────────────────────

/** Replace every `{ $asset: id }` sentinel in a JSON value (deep) with the
 *  installed MediaAsset's UUID — content-body asset fields validate as a uuid
 *  string (cms-schemas). Unknown refs collapse to null (the field is optional);
 *  integrity validation already guarantees they resolve. */
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

function mimeFromUrl(url: string): string {
  // A self-contained `data:` asset declares its own mediatype — read it directly
  // rather than guessing from a (non-existent) file extension.
  if (url.startsWith('data:')) {
    return /^data:([^;,]+)/.exec(url)?.[1] ?? 'application/octet-stream';
  }
  const ext = url.split('?')[0]?.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'png':
      return 'image/png';
    case 'webp':
      return 'image/webp';
    case 'gif':
      return 'image/gif';
    case 'svg':
      return 'image/svg+xml';
    case 'avif':
      return 'image/avif';
    default:
      return 'image/jpeg';
  }
}

/** Enable the modules the blueprint needs (so the dashboard surfaces them after
 *  install). `tenants.settings.modules.<slug>.enabled` — the tenants table is
 *  RLS-exempt (the dispatch table), so a direct prisma write is correct. */
async function enableModules(tenantId: string, modules: string[]): Promise<void> {
  // TODO(billing): entitlement gate (docs/54 D7). For now this enables every module
  // the blueprint needs, non-blocking — acceptable while installs are admin-only.
  // When billing (docs/17) + the public marketplace (§15) land, gate this to the
  // tenant's entitled modules and surface the rest as upsell instead of enabling.
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { settings: true },
  });
  const settings = { ...((tenant?.settings as Record<string, unknown>) ?? {}) };
  const mods = { ...((settings.modules as Record<string, { enabled?: boolean }>) ?? {}) };
  for (const m of modules) mods[m] = { ...(mods[m] ?? {}), enabled: true };
  settings.modules = mods;
  await prisma.tenant.update({
    where: { id: tenantId },
    data: { settings: settings as Prisma.InputJsonValue },
  });
}

// ── commerce reconcile-by-natural-key ─────────────────────────────────────────────
//
// Install is idempotent and ADDITIVE, not destroy-and-recreate. Every commerce row is
// matched by its stable natural key (category/collection/product handle, variant SKU):
// an existing row is REUSED as-is, a prior reset's soft-deleted tombstone is RESTORED
// in place, and only a genuinely-absent row is created. This is also the only correct
// path: `product_variants_sku_unique (tenant_id, sku)` reserves a SKU even while
// soft-deleted, and a cart line pins the variant (`onDelete: Restrict`) — so a SKU that
// already exists can NEVER be freed by deletion, only reused. Reusing leaves the
// tenant's catalog untouched and makes reinstall safe to re-run.

interface ReconcileCtx {
  tenantId: string;
  userId?: string;
}

/** Reuse a live product by handle, else restore a tombstone, else null (caller creates). */
async function reuseOrRestoreProduct(ctx: ReconcileCtx, handle: string): Promise<string | null> {
  const tenantId = ctx.tenantId;
  const live = await withTenant(ctx, (tx) =>
    tx.product.findFirst({ where: { tenantId, handle, deletedAt: null }, select: { id: true } })
  );
  if (live) return live.id;
  const dead = await withTenant(ctx, (tx) =>
    tx.product.findFirst({
      where: { tenantId, handle, deletedAt: { not: null } },
      select: { id: true },
    })
  );
  if (!dead) return null;
  await productService.restore(ctx, dead.id); // clears the tombstone + restores variants
  return dead.id;
}

/** Reuse a live variant by SKU, else restore its tombstone, else null. The SKU is
 *  globally unique per tenant, so there is at most one row to find. */
async function reuseOrRestoreVariant(ctx: ReconcileCtx, sku: string): Promise<string | null> {
  const tenantId = ctx.tenantId;
  const row = await withTenant(ctx, (tx) =>
    tx.productVariant.findFirst({
      where: { tenantId, sku },
      select: { id: true, deletedAt: true },
    })
  );
  if (!row) return null;
  if (row.deletedAt) await variantService.restore(ctx, row.id);
  return row.id;
}

/** Reuse a live category by handle, else restore its tombstone, else null. No service
 *  `restore` exists for categories, so the tombstone is cleared in place. */
async function reuseOrRestoreCategory(ctx: ReconcileCtx, handle: string): Promise<string | null> {
  const tenantId = ctx.tenantId;
  return withTenant(ctx, async (tx) => {
    const row = await tx.productCategory.findFirst({
      where: { tenantId, handle },
      select: { id: true, deletedAt: true },
    });
    if (!row) return null;
    if (row.deletedAt)
      await tx.productCategory.update({ where: { id: row.id }, data: { deletedAt: null } });
    return row.id;
  });
}

/** Reuse a live collection by handle, else restore its tombstone, else null. */
async function reuseOrRestoreCollection(ctx: ReconcileCtx, handle: string): Promise<string | null> {
  const tenantId = ctx.tenantId;
  return withTenant(ctx, async (tx) => {
    const row = await tx.productCollection.findFirst({
      where: { tenantId, handle },
      select: { id: true, deletedAt: true },
    });
    if (!row) return null;
    if (row.deletedAt)
      await tx.productCollection.update({ where: { id: row.id }, data: { deletedAt: null } });
    return row.id;
  });
}

/** Seed a REUSED product's blueprint relationships — category + collection membership
 *  and site scope — additively (`skipDuplicates`, so the tenant's own links are never
 *  removed). Reusing the product row avoids a SKU collision, but the blueprint still
 *  needs its products WIRED INTO the categories/collections the bound grids read from;
 *  a prior reset that hard-purged a category cascades its joins away, so a reused
 *  product can come back unlinked. Mirrors the create path's linking (product-service
 *  `create`). `isPrimary` is only claimed when the product currently has no category. */
async function linkProductRelations(
  ctx: ReconcileCtx,
  productId: string,
  categoryIds: string[],
  collectionIds: string[],
  propertyId: string
): Promise<void> {
  await withTenant(ctx, async (tx) => {
    if (categoryIds.length > 0) {
      const existingCats = await tx.categoryProduct.count({ where: { productId } });
      await tx.categoryProduct.createMany({
        data: categoryIds.map((categoryId, idx) => ({
          categoryId,
          productId,
          isPrimary: existingCats === 0 && idx === 0,
          position: idx,
        })),
        skipDuplicates: true,
      });
    }
    if (collectionIds.length > 0) {
      await tx.collectionProduct.createMany({
        data: collectionIds.map((collectionId, idx) => ({
          collectionId,
          productId,
          position: idx,
          addedBy: 'manual',
        })),
        skipDuplicates: true,
      });
    }
    await tx.productProperty.createMany({
      data: [{ propertyId, productId }],
      skipDuplicates: true,
    });
  });
}

/** Re-link a REUSED product's images to the CURRENT media assets. A reused product
 *  keeps the `VariantImage` rows from a PRIOR install, but a reset HARD-deletes the
 *  media assets those rows point at and this install re-creates them with FRESH ids —
 *  so the stored `mediaAssetId` 404s on the storefront (the card renders its alt, no
 *  photo). Surgical + reconcile-safe: drop only the image rows whose asset no longer
 *  exists (the dangling ones), then add the blueprint's images against the freshly
 *  installed assets, idempotently (skip an asset the product already shows). A
 *  tenant's own valid product images are left untouched. `images` is pre-resolved to
 *  live `mediaAssetId`s + the reused product's variant ids. */
async function relinkProductImages(
  ctx: ReconcileCtx,
  productId: string,
  images: {
    mediaAssetId: string;
    variantId?: string;
    position?: number;
    alt?: string;
    isPrimary?: boolean;
  }[]
): Promise<void> {
  // Drop dangling image rows (mediaAssetId points at an asset a prior reset removed).
  await withTenant(ctx, async (tx) => {
    const rows = await tx.variantImage.findMany({
      where: { productId },
      select: { id: true, mediaAssetId: true },
    });
    if (rows.length === 0) return;
    const assetIds = [...new Set(rows.map((r) => r.mediaAssetId))];
    const alive = new Set(
      (await tx.mediaAsset.findMany({ where: { id: { in: assetIds } }, select: { id: true } })).map(
        (a) => a.id
      )
    );
    const staleIds = rows.filter((r) => !alive.has(r.mediaAssetId)).map((r) => r.id);
    if (staleIds.length > 0) {
      await tx.variantImageOptionValue.deleteMany({ where: { variantImageId: { in: staleIds } } });
      await tx.variantImage.deleteMany({ where: { id: { in: staleIds } } });
    }
  });
  // Add the blueprint's images, skipping any the product already shows (idempotent).
  for (const img of images) {
    const existing = await withTenant(ctx, (tx) =>
      tx.variantImage.findFirst({
        where: { productId, mediaAssetId: img.mediaAssetId },
        select: { id: true },
      })
    );
    const id =
      existing?.id ??
      (
        await variantService.addImage(ctx, {
          productId,
          variantId: img.variantId,
          mediaAssetId: img.mediaAssetId,
          position: img.position,
          alt: img.alt,
          optionValueIds: [],
        })
      ).id;
    if (img.isPrimary) await variantService.setPrimaryImage(ctx, id);
  }
}

// ── install ─────────────────────────────────────────────────────────────────────

/** Already-installed guard. Returns the existing row (any status) or null. */
export async function findInstall(
  tenantId: string,
  propertyId: string,
  blueprintKey: string
): Promise<{ id: string; status: string } | null> {
  return withTenant({ tenantId }, (tx) =>
    tx.tenantBlueprintInstall.findFirst({
      where: { propertyId, blueprintKey },
      select: { id: true, status: true },
    })
  );
}

export async function installBlueprint(
  ctxIn: InstallContext,
  blueprint: Blueprint
): Promise<{ installId: string; result: InstallResult }> {
  const { tenantId, userId, propertyId, logger } = ctxIn;
  const ctx = { tenantId, userId: userId ?? undefined };
  const propCtx = { tenantId, userId: userId ?? undefined, propertyId };

  const result: InstallResult = {
    assets: {},
    categories: {},
    collections: {},
    products: [],
    components: [],
    theme: null,
    layoutId: null,
    pages: [],
    emails: [],
    content: [],
    counts: {},
  };
  const assetMap = new Map<string, string>();

  // Declared outside the try so the catch can flip the row to `failed`.
  let installId: string | null = null;

  try {
    // Install row FIRST, as `running` — a partial failure is then recorded (with its
    // partial id-map) for Reset & reinstall, never silently orphaned. The route
    // guarantees no prior row for (tenant, property, blueprint): an installed/live one
    // returns 409, a failed/running one must be reset first (docs/54 §5, D8).
    const installRow = await withTenant(ctx, (tx) =>
      tx.tenantBlueprintInstall.create({
        data: {
          tenantId,
          propertyId,
          blueprintKey: blueprint.key,
          blueprintVersion: blueprint.version,
          status: 'running',
          result: {},
        },
        select: { id: true },
      })
    );
    installId = installRow.id;

    // 1. Modules
    await enableModules(tenantId, blueprint.requiresModules);

    // 2. Assets → MediaAsset rows (one tx). Hot-linked: key holds the absolute
    //    URL; mediaPublicUrl() passes it through (docs/54 §6). Idempotent: an asset
    //    whose key already exists for this tenant is reused, so a reinstall doesn't
    //    pile up duplicate media rows (reconcile, never destroy-and-recreate).
    if (blueprint.assets.length > 0) {
      await withTenant(ctx, async (tx) => {
        for (const a of blueprint.assets) {
          const existing = await tx.mediaAsset.findFirst({
            where: { tenantId, key: a.url },
            select: { id: true },
          });
          const row =
            existing ??
            (await tx.mediaAsset.create({
              data: {
                tenantId,
                key: a.url,
                originalFilename: `${a.id}.${mimeFromUrl(a.url).split('/')[1] ?? 'jpg'}`,
                mimeType: a.mimeType ?? mimeFromUrl(a.url),
                byteSize: BigInt(0),
                status: 'ready',
                ...(a.width !== undefined ? { width: a.width } : {}),
                ...(a.height !== undefined ? { height: a.height } : {}),
                ...(a.alt !== undefined ? { altText: a.alt } : {}),
              },
              select: { id: true },
            }));
          assetMap.set(a.id, row.id);
          result.assets[a.id] = row.id;
        }
      });
    }
    const asset = (id?: string): string | undefined => (id ? assetMap.get(id) : undefined);

    // Is the target the tenant's PRIMARY site? The brand step scopes on this
    // (docs/49 §3): the primary writes the tenant-wide brand; a SECONDARY site
    // writes its own per-property `brand_override`, so installing onto one site
    // never rebrands its siblings.
    const prop = await withTenant(ctx, (tx) =>
      tx.property.findUnique({
        where: { id: propertyId },
        select: { isPrimary: true, name: true, settings: true },
      })
    );
    const isPrimary = prop?.isPrimary ?? true;

    // 3. Brand identity
    const b = blueprint.brand;
    if (isPrimary) {
      await withTenant(ctx, async (tx) => {
        const data: Prisma.TenantBrandUncheckedCreateInput = {
          tenantId,
          businessName: b.businessName,
          ...(b.tagline !== undefined ? { tagline: b.tagline } : {}),
          colorPrimary: b.colors.primary,
          ...(b.colors.primaryForeground
            ? { colorPrimaryForeground: b.colors.primaryForeground }
            : {}),
          ...(b.colors.accent ? { colorAccent: b.colors.accent } : {}),
          ...(b.colors.accentForeground
            ? { colorAccentForeground: b.colors.accentForeground }
            : {}),
          ...(b.colors.secondary ? { colorSecondary: b.colors.secondary } : {}),
          ...(b.colors.secondaryForeground
            ? { colorSecondaryForeground: b.colors.secondaryForeground }
            : {}),
          fontHeading: b.fonts.heading,
          fontBody: b.fonts.body,
          ...(asset(b.logoLightAssetId) ? { logoLightMediaId: asset(b.logoLightAssetId) } : {}),
          ...(asset(b.logoDarkAssetId) ? { logoDarkMediaId: asset(b.logoDarkAssetId) } : {}),
          ...(asset(b.faviconAssetId) ? { faviconMediaId: asset(b.faviconAssetId) } : {}),
        };
        const { tenantId: _t, ...update } = data;
        await tx.tenantBrand.upsert({ where: { tenantId }, create: data, update });
      });
    } else {
      // Secondary site: the per-site override (docs/49 §3) carries only the
      // identity fields it supports (businessName + the brand colors + logo);
      // everything else inherits the tenant brand.
      const override: Record<string, string> = {
        businessName: b.businessName,
        colorPrimary: b.colors.primary,
      };
      if (b.colors.primaryForeground) override.colorPrimaryForeground = b.colors.primaryForeground;
      if (b.colors.accent) override.colorAccent = b.colors.accent;
      const logo = asset(b.logoLightAssetId);
      if (logo) override.logoMediaId = logo;
      await withTenant(ctx, (tx) =>
        tx.property.update({
          where: { id: propertyId },
          data: { brandOverride: override },
        })
      );
    }

    // 3b. Site name + social links on the TARGET property (docs/49). The customer-
    // facing site name is Property.name (storefront chrome/title/OG read it), seeded
    // from the tenant name at provisioning — so brand it from the blueprint ONLY when
    // it's still the seed placeholder 'Default'/empty, never clobbering a name the
    // merchant already chose (mirrors db:backfill:property-name). Seed the per-site
    // social links the footer's SocialLinks renders, but only when the site has none
    // (placeholder handles the tenant swaps post-install, like the placeholder imagery).
    {
      const update: Prisma.PropertyUpdateInput = {};
      const currentName = (prop?.name ?? '').trim();
      if (currentName === '' || currentName === 'Default') update.name = b.businessName;

      const seedSocials = b.socials ?? [];
      const settings =
        prop?.settings && typeof prop.settings === 'object' && !Array.isArray(prop.settings)
          ? (prop.settings as Record<string, unknown>)
          : {};
      const existingSocials = (settings as { socials?: unknown }).socials;
      const hasSocials = Array.isArray(existingSocials) && existingSocials.length > 0;
      if (seedSocials.length > 0 && !hasSocials) {
        update.settings = { ...settings, socials: seedSocials };
      }

      if (Object.keys(update).length > 0) {
        await withTenant(ctx, (tx) =>
          tx.property.update({ where: { id: propertyId }, data: update })
        );
      }
    }

    // 4. Theme — create the shipped SiteTheme, apply it (working draft), and apply
    //    its captured brand "look". (docs/54 D5)
    const theme = await savedThemeService.create(ctx, {
      name: blueprint.theme.name,
      basePresetKey: blueprint.theme.basePresetKey,
      presentation: blueprint.theme.presentation ?? {},
      ...(blueprint.theme.brand ? { brand: blueprint.theme.brand } : {}),
    });
    result.theme = { id: theme.id, name: theme.name };
    if (blueprint.theme.apply) {
      // apply writes the target site's draft config (docs/49 Phase 6) → propCtx.
      await savedThemeService.apply(propCtx, theme.id);
      await withTenant(ctx, (tx) =>
        savedThemeService.applyThemeBrandWithinTx(tx, tenantId, theme.brand)
      );
    }

    // 5. Content entries (draft)
    for (const entry of blueprint.content) {
      await withTenant(ctx, async (tx) => {
        const type = await resolveType(tx, entry.typeKey);
        const schema = parseTypeSchema(type);
        const rawBody = resolveAssetRefs(entry.body, assetMap) as Record<string, unknown>;
        const body = validateAndNormalizeBody(schema, rawBody);
        const seo: Record<string, unknown> = {};
        if (entry.seo?.title) seo.title = entry.seo.title;
        if (entry.seo?.description) seo.description = entry.seo.description;
        if (entry.seo?.canonical) seo.canonical = entry.seo.canonical;
        if (entry.seo?.robots) seo.robots = entry.seo.robots;
        const ogId = asset(entry.seo?.ogImageAssetId);
        if (ogId) seo.ogImage = ogId;
        const row = await tx.contentEntry.create({
          data: {
            tenantId,
            typeKey: entry.typeKey,
            slug: entry.slug ?? null,
            status: entry.status,
            body: body as Prisma.InputJsonValue,
            seoJson: seo as Prisma.InputJsonValue,
            // `author_id` FKs to the CMS `authors` table, NOT `users` — the
            // installing staff user is not a content author, so a template's
            // entries have no author (the manifest doesn't model one yet).
            // (recordRevision's authorId is a plain audit field, not FK-bound,
            // so the installing user is fine to record there.)
            authorId: null,
          },
        });
        // Scope to the installed site so content doesn't bleed into other sites.
        await tx.contentEntryProperty.create({
          data: { entryId: row.id, propertyId },
        });
        await syncReferences(tx, tenantId, row.id, schema, body);
        await recordRevision(tx, {
          tenantId,
          entryId: row.id,
          body,
          seoJson: seo,
          status: entry.status,
          kind: 'manual',
          authorId: userId ?? null,
          summary: 'Installed from template',
        });
        result.content.push({ typeKey: entry.typeKey, slug: entry.slug ?? null, id: row.id });
      });
    }

    // 6. Commerce
    const commerce = blueprint.commerce;
    if (commerce) {
      // Reconcile by natural key (see the helpers above): reuse/restore-then-create,
      // never destroy-and-recreate. Existing rows are left alone.

      // 6a. Categories — parent-first (resolve parentHandle as we go).
      const catMap = new Map<string, string>();
      const pending = [...commerce.categories];
      let guard = pending.length + 1;
      while (pending.length > 0 && guard-- > 0) {
        for (let i = pending.length - 1; i >= 0; i--) {
          const c = pending[i]!;
          if (c.parentHandle && !catMap.has(c.parentHandle)) continue; // wait for parent
          let id = await reuseOrRestoreCategory(ctx, c.handle);
          if (!id) {
            const created = await categoryService.create(ctx, {
              name: c.name,
              handle: c.handle,
              description: c.description,
              parentId: c.parentHandle ? catMap.get(c.parentHandle) : null,
              position: c.position,
              featured: c.featured,
              iconMediaId: asset(c.iconAssetId),
              heroMediaId: asset(c.heroAssetId),
              seoTitle: c.seoTitle,
              seoDescription: c.seoDescription,
              ogImageId: asset(c.ogImageAssetId),
            });
            id = created.id;
          }
          catMap.set(c.handle, id);
          result.categories[c.handle] = id;
          pending.splice(i, 1);
        }
      }

      // 6b. Collections (empty; membership set from products below).
      const collMap = new Map<string, string>();
      for (const c of commerce.collections) {
        let id = await reuseOrRestoreCollection(ctx, c.handle);
        if (!id) {
          const created = await collectionService.create(ctx, {
            name: c.name,
            handle: c.handle,
            description: c.description,
            type: c.type,
            ruleSet: c.ruleSet,
            heroMediaId: asset(c.heroAssetId),
            featured: c.featured,
            seoTitle: c.seoTitle,
            seoDescription: c.seoDescription,
            ogImageId: asset(c.ogImageAssetId),
          });
          id = created.id;
        }
        collMap.set(c.handle, id);
        result.collections[c.handle] = id;
      }

      // Precompute each product's collections (union of its collectionHandles and
      // any collection whose productHandles names it).
      const collsForProduct = new Map<string, Set<string>>();
      for (const p of commerce.products)
        collsForProduct.set(p.handle, new Set(p.collectionHandles));
      for (const c of commerce.collections) {
        for (const ph of c.productHandles) collsForProduct.get(ph)?.add(c.handle);
      }

      // 6c. Products → options → variants → images.
      for (const p of commerce.products) {
        // Reconcile first: if a product with this handle already exists (live, or a
        // tombstone from a prior reset), reuse it and leave its content alone — only
        // bring back any of the blueprint's variant SKUs that are tombstoned so the
        // product is sellable. The SKU unique constraint makes reuse the ONLY way to
        // reinstall; recreating would collide. Missing variants under an already-living
        // product are intentionally not added (leave the existing product untouched).
        const reusedId = await reuseOrRestoreProduct(ctx, p.handle);
        if (reusedId) {
          const skuToVariant = new Map<string, string>();
          for (const v of p.variants) {
            const vid = await reuseOrRestoreVariant(ctx, v.sku);
            if (vid) skuToVariant.set(v.sku, vid);
          }
          // Wire the reused product into the blueprint's categories/collections + site
          // so the bound grids actually render it (additive — see linkProductRelations).
          const categoryIds = p.categoryHandles
            .map((h) => catMap.get(h))
            .filter((x): x is string => !!x);
          const collectionIds = [...(collsForProduct.get(p.handle) ?? [])]
            .map((h) => collMap.get(h))
            .filter((x): x is string => !!x);
          await linkProductRelations(ctx, reusedId, categoryIds, collectionIds, propertyId);
          // Re-link images to the CURRENT assets: a reused product's stored image rows
          // point at assets a prior reset deleted, so the storefront 404s the photo.
          const reuseImages: Parameters<typeof relinkProductImages>[2] = [];
          for (const img of p.images) {
            const mediaAssetId = asset(img.assetId);
            if (!mediaAssetId) continue;
            reuseImages.push({
              mediaAssetId,
              variantId: img.variantSku ? skuToVariant.get(img.variantSku) : undefined,
              position: img.position,
              alt: img.alt,
              isPrimary: img.isPrimary,
            });
          }
          await relinkProductImages(ctx, reusedId, reuseImages);
          result.products.push({ handle: p.handle, id: reusedId });
          continue;
        }

        const created = await productService.create(ctx, {
          title: p.title,
          handle: p.handle,
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
          categoryIds: p.categoryHandles.map((h) => catMap.get(h)).filter((x): x is string => !!x),
          collectionIds: [...(collsForProduct.get(p.handle) ?? [])]
            .map((h) => collMap.get(h))
            .filter((x): x is string => !!x),
          seoTitle: p.seoTitle,
          seoDescription: p.seoDescription,
          ogImageId: asset(p.ogImageAssetId),
          // Scope to the installed site so it doesn't bleed into other sites.
          propertyIds: [propertyId],
        });
        result.products.push({ handle: p.handle, id: created.id });

        // Options → value id map keyed by `${name}::${value}`.
        const valueIds = new Map<string, string>();
        if (p.options.length > 0) {
          const rows = await variantService.setOptions(ctx, created.id, {
            options: p.options.map((o) => ({
              name: o.name,
              displayType: o.displayType,
              position: o.position,
              values: o.values.map((v) => ({
                value: v.value,
                swatchHex: v.swatchHex,
                swatchImageId: asset(v.swatchImageAssetId),
                position: v.position,
              })),
            })),
          });
          for (const o of rows)
            for (const v of o.values) valueIds.set(`${o.name}::${v.value}`, v.id);
        }

        // Variants.
        const skuToVariant = new Map<string, string>();
        for (const v of p.variants) {
          const optionValueIds = Object.entries(v.optionValues)
            .map(([name, val]) => valueIds.get(`${name}::${val}`))
            .filter((x): x is string => !!x);
          const variant = await variantService.create(ctx, created.id, {
            sku: v.sku,
            barcode: v.barcode,
            title: v.title,
            optionValueIds,
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
          });
          skuToVariant.set(v.sku, variant.id);
        }

        // Images.
        for (const img of p.images) {
          const mediaAssetId = asset(img.assetId);
          if (!mediaAssetId) continue;
          const optionValueIds = Object.entries(img.optionValues)
            .map(([name, val]) => valueIds.get(`${name}::${val}`))
            .filter((x): x is string => !!x);
          const created2 = await variantService.addImage(ctx, {
            productId: created.id,
            variantId: img.variantSku ? skuToVariant.get(img.variantSku) : undefined,
            mediaAssetId,
            position: img.position,
            alt: img.alt,
            optionValueIds,
          });
          if (img.isPrimary) await variantService.setPrimaryImage(ctx, created2.id);
        }
      }
    }

    // 7. Components (before pages that place them).
    for (const c of blueprint.components) {
      const created = await componentService.create(ctx, {
        key: c.key,
        name: c.name,
        group: c.group,
        icon: c.icon,
        description: c.description,
        surfaces: c.surfaces,
        tree: c.tree,
        propSpec: c.propSpec,
      });
      result.components.push({ key: c.key, id: created.id });
    }

    // 8. Site layout (draft; go-live publishes + activates).
    if (blueprint.layout) {
      const layout = await layoutService.create(propCtx, {
        name: blueprint.layout.name,
        tree: resolveBindingHandles(blueprint.layout.tree, result),
      });
      result.layoutId = layout.id;
    }

    // 9. Pages (draft; set defaults for collection templates). A slugless
    //    singleton is the site HOME (docs/49 — it serves at `/`). A property has
    //    exactly one `/`, so if one already exists (the seeded starter, or a prior
    //    home), REPLACE its tree/SEO rather than adding a second home — otherwise
    //    the storefront can't tell which slugless singleton is the homepage.
    for (const pg of blueprint.pages) {
      const isHome = pg.kind === 'singleton' && !pg.slug;
      let pageId: string;
      const existingHome = isHome
        ? await withTenant(propCtx, (tx) =>
            tx.builderPage.findFirst({
              where: { propertyId, kind: 'singleton', slug: null },
              orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
              select: { id: true },
            })
          )
        : null;
      if (existingHome) {
        const updated = await pageService.update(propCtx, existingHome.id, {
          name: pg.name,
          tree: resolveBindingHandles(pg.tree, result),
          seoTitle: pg.seoTitle,
          seoDescription: pg.seoDescription,
          canonical: pg.canonical,
          ogImage: pg.ogImage,
          noindex: pg.noindex,
        });
        pageId = updated.id;
      } else {
        const page = await pageService.create(propCtx, {
          name: pg.name,
          kind: pg.kind,
          recordType: pg.recordType ?? null,
          slug: pg.slug ?? null,
          tree: resolveBindingHandles(pg.tree, result),
          seoTitle: pg.seoTitle,
          seoDescription: pg.seoDescription,
          canonical: pg.canonical,
          ogImage: pg.ogImage,
          noindex: pg.noindex,
        });
        if (pg.isDefault) await pageService.setDefault(propCtx, page.id);
        pageId = page.id;
      }
      result.pages.push({
        name: pg.name,
        id: pageId,
        recordType: pg.recordType ?? null,
        slug: pg.slug ?? null,
      });
    }

    // A blueprint may ship only collection templates (or omit a home). Guarantee a
    // landing page so the property has a `/` — and register it for the go-live
    // publish so the storefront root renders immediately, not the fallback.
    const injectedHome = await pageService.ensureHome(propCtx);
    if (injectedHome) {
      result.pages.push({
        name: injectedHome.name,
        id: injectedHome.id,
        recordType: null,
        slug: null,
      });
    }

    // 10. Emails (draft unless publish flagged).
    for (const e of blueprint.emails) {
      const email = await emailService.create(ctx, {
        name: e.name,
        subject: e.subject,
        preheader: e.preheader,
        tree: e.tree,
      });
      if (e.publish) await emailService.publish(ctx, email.id);
      result.emails.push({ name: e.name, id: email.id });
    }

    result.counts = {
      assets: blueprint.assets.length,
      content: result.content.length,
      categories: Object.keys(result.categories).length,
      collections: Object.keys(result.collections).length,
      products: result.products.length,
      components: result.components.length,
      pages: result.pages.length,
      emails: result.emails.length,
    };

    // 10b. Baseline capture (docs/55 §4) — record the per-artifact merge ANCESTOR so
    //      a later blueprint update can reconcile non-destructively (tell a tenant
    //      edit from a blueprint change). One row per artifact in
    //      tenant_blueprint_install_artifacts, holding the stamped content for this
    //      version. Without this, an update could only two-way-merge and would
    //      false-conflict on every edit.
    await captureBaselines(
      ctx,
      installRow.id,
      blueprint.version,
      resolveBlueprintArtifacts(blueprint, result, assetMap)
    );

    // 11. Finalize the install row → `installed`, with the full id-map. Use
    //     installRow.id (definitely set here) so the closure sees a non-null id.
    await withTenant(ctx, (tx) =>
      tx.tenantBlueprintInstall.update({
        where: { id: installRow.id },
        data: { status: 'installed', result: result as unknown as Prisma.InputJsonValue },
      })
    );

    await publish(logger, 'template.installed', tenantId, userId, {
      installId: installRow.id,
      blueprintKey: blueprint.key,
      propertyId,
      counts: result.counts,
    });

    logger.info(
      { tenantId, propertyId, blueprint: blueprint.key, counts: result.counts },
      'blueprint installed'
    );
    return { installId: installRow.id, result };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error({ err, tenantId, blueprint: blueprint.key }, 'blueprint install failed');
    // Persist `failed` + the partial id-map so the dashboard offers Reset & retry and
    // the reset deletes exactly what was created before the failure (D8).
    if (installId) {
      const failedId = installId;
      await withTenant(ctx, (tx) =>
        tx.tenantBlueprintInstall.update({
          where: { id: failedId },
          data: {
            status: 'failed',
            error: message,
            result: result as unknown as Prisma.InputJsonValue,
          },
        })
      ).catch(() => undefined);
    }
    await publish(logger, 'template.install_failed', tenantId, userId, {
      installId,
      blueprintKey: blueprint.key,
      propertyId,
      error: message,
    }).catch(() => undefined);
    throw err;
  }
}

// ── go live ─────────────────────────────────────────────────────────────────────

/** Publish everything an install created: pages, the layout (publish + activate),
 *  products (→ active), content entries (→ published), and emails. Reads the id
 *  map off the install row so it touches exactly what the template added. */
export async function goLiveInstall(ctxIn: InstallContext, installId: string): Promise<void> {
  const { tenantId, userId, propertyId, logger } = ctxIn;
  const ctx = { tenantId, userId: userId ?? undefined };
  const propCtx = { tenantId, userId: userId ?? undefined, propertyId };

  const row = await withTenant({ tenantId }, (tx) =>
    tx.tenantBlueprintInstall.findFirst({
      where: { id: installId },
      select: { id: true, result: true, status: true },
    })
  );
  if (!row) throw new Error(`Install ${installId} not found`);
  const r = row.result as unknown as InstallResult;

  // Pages.
  for (const p of r.pages ?? []) {
    await pageService
      .publish(propCtx, p.id)
      .catch((err) => logger.warn({ err, id: p.id }, 'page publish failed'));
  }
  // Layout — publish then activate (activate requires a published tree).
  if (r.layoutId) {
    await layoutService.publish(propCtx, r.layoutId).catch(() => undefined);
    await layoutService
      .setActive(propCtx, r.layoutId)
      .catch((err) => logger.warn({ err, id: r.layoutId }, 'layout activate failed'));
  }
  // Products → active.
  for (const p of r.products ?? []) {
    await productService
      .publish(ctx, p.id)
      .catch((err) => logger.warn({ err, id: p.id }, 'product publish failed'));
  }
  // Content entries → published.
  for (const c of r.content ?? []) {
    await withTenant(ctx, async (tx) => {
      const entry = await tx.contentEntry.findFirst({
        where: { id: c.id },
        select: { body: true, seoJson: true },
      });
      if (!entry) return;
      await tx.contentEntry.update({
        where: { id: c.id },
        data: { status: 'published', publishedAt: new Date() },
      });
      await recordRevision(tx, {
        tenantId,
        entryId: c.id,
        body: (entry.body ?? {}) as Record<string, unknown>,
        seoJson: (entry.seoJson ?? {}) as Record<string, unknown>,
        status: 'published',
        kind: 'manual',
        authorId: userId ?? null,
        summary: 'Published (go live)',
      });
    }).catch((err) => logger.warn({ err, id: c.id }, 'content publish failed'));
  }
  // Emails.
  for (const e of r.emails ?? []) {
    await emailService.publish(ctx, e.id).catch(() => undefined);
  }

  // Site theme — PUBLISH the draft into a SiteVersion. Install applied the shipped
  // theme to the DRAFT only (savedThemeService.apply → sitebuilder_configs draft);
  // the storefront reads its --st-* tokens from the PUBLISHED snapshot, so without
  // this the live site keeps serving whatever was last published (a prior theme, or
  // the default) and the blueprint's theme never reaches the page. publishNow
  // snapshots the draft's themeKey + presentation and write-throughs the compiled
  // tokens, so the shipped theme goes live with the rest of the blueprint. Best-
  // effort: a theme that fails to publish shouldn't block the content go-live.
  await publishService
    .publishNow(propCtx, { note: `Blueprint go-live (${installId})` })
    .catch((err) => logger.warn({ err, installId }, 'site theme publish failed'));

  await withTenant(ctx, (tx) =>
    tx.tenantBlueprintInstall.update({
      where: { id: installId },
      data: { status: 'live', liveAt: new Date() },
    })
  );
  logger.info({ tenantId, propertyId, installId }, 'blueprint install went live');
}

// ── reset & reinstall ─────────────────────────────────────────────────────────────

/** Reset & reinstall (D8): delete everything an install created — read from the
 *  id-map on the row — then delete the row, so the blueprint can be installed
 *  fresh. Best-effort per artifact (an already-removed one is skipped) and in
 *  reverse dependency order so "has descendants" / "is placed" / FK guards don't
 *  block teardown. Destructive — gated behind a confirm in the dashboard.
 *
 *  Commerce rows (products/categories/collections) soft-delete via the service, so
 *  their handles/SKUs stay reserved after a reset — that is intentional: a reinstall
 *  RECONCILES by natural key (step 6 `reuseOrRestore*`), restoring those exact
 *  tombstones in place rather than recreating, so it reuses the handles/SKUs cleanly
 *  (the SKU unique constraint + cart-pin `Restrict` make reuse the only safe path).
 *  Pages/emails/components/theme hard delete; content hard deletes and cascades its
 *  revisions + references; the layout is deactivated then removed so a LIVE install
 *  tears down fully. */
export async function resetInstall(ctxIn: InstallContext, installId: string): Promise<void> {
  const { tenantId, userId, propertyId, logger } = ctxIn;
  const ctx = { tenantId, userId: userId ?? undefined };
  const propCtx = { tenantId, userId: userId ?? undefined, propertyId };

  const row = await withTenant({ tenantId }, (tx) =>
    tx.tenantBlueprintInstall.findFirst({
      where: { id: installId },
      select: { result: true },
    })
  );
  if (!row) throw new Error(`Install ${installId} not found`);
  const r = (row.result ?? {}) as unknown as InstallResult;

  const warn = (label: string, id: string) => (err: unknown) =>
    logger.warn({ err, id }, `reset: ${label} delete failed (left in place)`);

  // Reverse dependency order, so each delete's "is placed" / "has descendants" /
  // FK guard is already satisfied by the time we reach the parent.
  for (const e of r.emails ?? []) await emailService.remove(ctx, e.id).catch(warn('email', e.id));
  for (const p of r.pages ?? []) await pageService.remove(propCtx, p.id).catch(warn('page', p.id));
  if (r.layoutId) {
    // Reset uninstalls the whole template, so its layout must go even if it's the
    // live one. remove() refuses to delete an active layout (a guard that protects
    // the merchant-facing delete) — deactivate it first so uninstall completes
    // instead of orphaning the layout (which then blocks a clean reinstall+go-live).
    const layoutId = r.layoutId;
    await withTenant(ctx, (tx) =>
      tx.builderLayout.updateMany({
        where: { id: layoutId, propertyId },
        data: { isActive: false },
      })
    ).catch(warn('layout deactivate', layoutId));
    await layoutService.remove(propCtx, layoutId).catch(warn('layout', layoutId));
  }
  for (const c of r.components ?? [])
    await componentService.remove(ctx, c.key).catch(warn('component', c.key));
  for (const p of r.products ?? [])
    await productService.softDelete(ctx, p.id).catch(warn('product', p.id));
  for (const id of Object.values(r.collections ?? {}))
    await collectionService.remove(ctx, id).catch(warn('collection', id));
  // Categories leaf-first: the id-map is parent-first (insertion order), so reverse.
  for (const id of Object.values(r.categories ?? {}).reverse())
    await categoryService.remove(ctx, id).catch(warn('category', id));
  for (const c of r.content ?? [])
    await withTenant(ctx, (tx) => tx.contentEntry.delete({ where: { id: c.id } })).catch(
      warn('content', c.id)
    );
  if (r.theme) await savedThemeService.remove(ctx, r.theme.id).catch(warn('theme', r.theme.id));
  for (const id of Object.values(r.assets ?? {}))
    await withTenant(ctx, (tx) => tx.mediaAsset.delete({ where: { id } })).catch(warn('asset', id));

  await withTenant(ctx, (tx) => tx.tenantBlueprintInstall.delete({ where: { id: installId } }));
  logger.info({ tenantId, propertyId, installId }, 'blueprint install reset');
}
