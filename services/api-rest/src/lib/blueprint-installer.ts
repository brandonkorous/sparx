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
import { savedThemeService } from '@sparx/sitebuilder';
import {
  parseTypeSchema,
  resolveType,
  validateAndNormalizeBody,
} from '@sparx/api-core/content-types';
import { recordRevision, syncReferences } from '@sparx/api-core/entries';
import { publish } from '@sparx/api-core/pubsub';
import { isAssetRef, type Blueprint } from '@sparx/blueprints';

export interface InstallContext {
  tenantId: string;
  userId: string | null;
  /** The ACTIVE property to install into (resolved by the caller from the site
   *  switcher header, else the tenant's primary). Docs/54 §5. */
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

  try {
    // 1. Modules
    await enableModules(tenantId, blueprint.requiresModules);

    // 2. Assets → MediaAsset rows (one tx). Hot-linked: key holds the absolute
    //    URL; mediaPublicUrl() passes it through (docs/54 §6).
    if (blueprint.assets.length > 0) {
      await withTenant(ctx, async (tx) => {
        for (const a of blueprint.assets) {
          const row = await tx.mediaAsset.create({
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
          });
          assetMap.set(a.id, row.id);
          result.assets[a.id] = row.id;
        }
      });
    }
    const asset = (id?: string): string | undefined => (id ? assetMap.get(id) : undefined);

    // 3. Brand identity
    const b = blueprint.brand;
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
        ...(b.colors.accentForeground ? { colorAccentForeground: b.colors.accentForeground } : {}),
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
      await savedThemeService.apply(ctx, theme.id);
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
      // 6a. Categories — parent-first (resolve parentHandle as we go).
      const catMap = new Map<string, string>();
      const pending = [...commerce.categories];
      let guard = pending.length + 1;
      while (pending.length > 0 && guard-- > 0) {
        for (let i = pending.length - 1; i >= 0; i--) {
          const c = pending[i]!;
          if (c.parentHandle && !catMap.has(c.parentHandle)) continue; // wait for parent
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
          catMap.set(c.handle, created.id);
          result.categories[c.handle] = created.id;
          pending.splice(i, 1);
        }
      }

      // 6b. Collections (empty; membership set from products below).
      const collMap = new Map<string, string>();
      for (const c of commerce.collections) {
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
        collMap.set(c.handle, created.id);
        result.collections[c.handle] = created.id;
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
        tree: blueprint.layout.tree,
      });
      result.layoutId = layout.id;
    }

    // 9. Pages (draft; set defaults for collection templates).
    for (const pg of blueprint.pages) {
      const page = await pageService.create(propCtx, {
        name: pg.name,
        kind: pg.kind,
        recordType: pg.recordType ?? null,
        slug: pg.slug ?? null,
        tree: pg.tree,
        seoTitle: pg.seoTitle,
        seoDescription: pg.seoDescription,
        canonical: pg.canonical,
        ogImage: pg.ogImage,
        noindex: pg.noindex,
      });
      if (pg.isDefault) await pageService.setDefault(propCtx, page.id);
      result.pages.push({
        name: pg.name,
        id: page.id,
        recordType: pg.recordType ?? null,
        slug: pg.slug ?? null,
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

    // 11. Record the install (idempotency + review + go-live).
    const row = await withTenant(ctx, (tx) =>
      tx.tenantBlueprintInstall.create({
        data: {
          tenantId,
          propertyId,
          blueprintKey: blueprint.key,
          blueprintVersion: blueprint.version,
          status: 'installed',
          result: result as unknown as Prisma.InputJsonValue,
        },
        select: { id: true },
      })
    );

    await publish(logger, 'template.installed', tenantId, userId, {
      installId: row.id,
      blueprintKey: blueprint.key,
      propertyId,
      counts: result.counts,
    });

    logger.info(
      { tenantId, propertyId, blueprint: blueprint.key, counts: result.counts },
      'blueprint installed'
    );
    return { installId: row.id, result };
  } catch (err) {
    logger.error({ err, tenantId, blueprint: blueprint.key }, 'blueprint install failed');
    await publish(logger, 'template.install_failed', tenantId, userId, {
      blueprintKey: blueprint.key,
      propertyId,
      error: err instanceof Error ? err.message : String(err),
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

  await withTenant(ctx, (tx) =>
    tx.tenantBlueprintInstall.update({
      where: { id: installId },
      data: { status: 'live', liveAt: new Date() },
    })
  );
  logger.info({ tenantId, propertyId, installId }, 'blueprint install went live');
}
