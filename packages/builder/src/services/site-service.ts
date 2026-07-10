// siteService — the silica-native site persistence seam (docs/118 Stage 3).
//
// silica's `<Builder>` owns the whole multi-page site in memory and hands the
// host the entire `Site` on every edit. This service decomposes that Site back
// into sparx's store and reconstructs it for the editor:
//   · load    — read the property's silica-materialized page bodies + the active
//               layout's frame/symbols into a `StoredSilicaSite` (theme-less; the
//               dashboard attaches the brand-derived theme). Returns null when the
//               property has no silica site yet (the route opens on the in-memory
//               starter seed; the first `sync` materializes it).
//   · sync     — reconcile an extracted `Site` into the store: upsert one
//               `BuilderPage` row per page (by id), delete pages silica removed,
//               and write the frame + symbols onto the active `BuilderLayout`.
//               The high-frequency autosave path — deliberately un-audited.
//   · publish  — snapshot every silica draft tree → its published column (the
//               storefront re-renders on read via `renderSilicaPage`).
//
// Runs PARALLEL to the sparx `draft_tree`/`published_tree` columns: silica trees
// live in the `silica_*` columns, so the still-sparx storefront is untouched
// until the render cutover flips it. Tenant-scoped via withTenant (FORCE RLS).

import {
  STARTER_LAYOUT,
  SiteSyncInput,
  blankPageTree,
  type PublishedSilicaFrameDto,
  type PublishedSilicaPageDto,
  type SilicaFrame,
  type SilicaNode,
  type SilicaSymbolDef,
  type SilicaTheme,
  type StoredSilicaSite,
} from '@sparx/builder-schemas';
import type { BuilderLayout, BuilderPage, BuilderSite } from '@sparx/db';
// @sparx/db re-exports the Prisma namespace as a VALUE (its `DbNull` runtime
// sentinel is needed to write SQL NULL into a nullable Json column).
import { Prisma, withTenant, type TxClient } from '@sparx/db';

import { writeAuditLog } from '../audit';
import { publishBuilderEvent } from '../events';
import type { PropertyContext } from '../errors';

const asJson = (v: unknown): Prisma.InputJsonValue => v as Prisma.InputJsonValue;

/** A page row is "silica-materialized" once it carries a silica body tree. Filtered
 *  in JS rather than the `where` clause: a Json column's NULL check needs Prisma's
 *  runtime sentinel, and the row set here is already small + fully fetched. */
const isSilica = (r: BuilderPage): boolean => r.silicaDraftTree != null;

/** A symbols map, defaulting to empty. Stored as a NOT-NULL `{}` Json column. */
function symbolsOf(value: unknown): Record<string, SilicaSymbolDef> {
  return (value as Record<string, SilicaSymbolDef> | null | undefined) ?? {};
}

/** Rebuild the STORED site from materialized rows: page bodies + the active
 *  layout's frame + the property's site-global theme + symbols (docs/118). Page
 *  identity is the row's (id/name/slug); a null slug (a sparx-seeded home) shows as
 *  "/". A null `theme` means the author never edited it — the caller falls back to
 *  the tenant's brand-derived theme. */
function rowsToStoredSite(
  pages: BuilderPage[],
  layout: BuilderLayout | null,
  site: BuilderSite | null
): StoredSilicaSite {
  const symbols = symbolsOf(site?.silicaDraftSymbols);
  const theme = site?.silicaDraftTheme as SilicaTheme | null | undefined;
  return {
    ...(layout?.silicaDraftTree != null
      ? { frame: { root: layout.silicaDraftTree as unknown as SilicaNode, editable: true } }
      : {}),
    pages: pages.map((r) => ({
      id: r.id,
      name: r.name,
      slug: r.slug ?? '/',
      root: r.silicaDraftTree as unknown as SilicaNode,
    })),
    ...(Object.keys(symbols).length > 0 ? { symbols } : {}),
    ...(theme ? { theme } : {}),
  };
}

/** Load the property's stored silica site, or null if none is materialized yet.
 *  Carries the authored theme when one exists; otherwise the caller composes the
 *  tenant's brand-derived theme. */
export function load(ctx: PropertyContext): Promise<StoredSilicaSite | null> {
  return withTenant(ctx, async (tx) => {
    const allPages = await tx.builderPage.findMany({
      where: { propertyId: ctx.propertyId },
      orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
    });
    const pages = allPages.filter(isSilica);
    if (pages.length === 0) return null;
    const [layout, site] = await Promise.all([
      tx.builderLayout.findFirst({ where: { propertyId: ctx.propertyId, isActive: true } }),
      tx.builderSite.findUnique({ where: { propertyId: ctx.propertyId } }),
    ]);
    return rowsToStoredSite(pages, layout, site);
  });
}

// ── Public storefront reads (docs/118 Stage 6, the render cutover) ────────────
// The PUBLISHED silica trees the storefront renders through `renderSilicaBody`.
// Mirror the sparx pageService/layoutService public reads, but off the `silica_*`
// published columns. Runs parallel to the sparx reads until the storefront flips.

/** A page row is published-in-silica once its silica PUBLISHED tree is set. */
const isSilicaPublished = (r: BuilderPage): boolean => r.silicaPublishedTree != null;

/** Strip a leading slash so a stored silica slug (`/`, `/shop`) and the storefront's
 *  path segment (`shop`, or `''` for home) compare on equal footing. */
function normalizeSlug(slug: string | null | undefined): string {
  return (slug ?? '').replace(/^\/+/, '');
}

/** The property's PUBLISHED site-global symbols (saved components). Read alongside
 *  every page so a body's symbol instances flatten at render. */
function publishedSymbols(site: BuilderSite | null): Record<string, SilicaSymbolDef> {
  return symbolsOf(site?.silicaPublishedSymbols);
}

/** The property's PUBLISHED authored theme, or null when the author never saved one
 *  (the storefront then renders the tenant's brand-derived theme). */
function publishedTheme(site: BuilderSite | null): SilicaTheme | null {
  return (site?.silicaPublishedTheme as SilicaTheme | null | undefined) ?? null;
}

/** SEO + lifecycle projection shared by the published page reads. */
function publishedPageMeta(r: BuilderPage) {
  return {
    seoTitle: r.seoTitle,
    seoDescription: r.seoDescription,
    canonical: r.canonical,
    ogImage: r.ogImage,
    noindex: r.noindex,
    publishedAt: r.publishedAt ? r.publishedAt.toISOString() : null,
  };
}

function toPublishedPage(
  r: BuilderPage,
  symbols: Record<string, SilicaSymbolDef>
): PublishedSilicaPageDto {
  return {
    id: r.id,
    name: r.name,
    slug: r.slug ?? '',
    kind: r.kind,
    recordType: r.recordType,
    root: r.silicaPublishedTree as unknown as SilicaNode,
    symbols,
    ...publishedPageMeta(r),
  };
}

/** The published FRAME (chrome) + the site-global symbols + authored theme — one
 *  read for everything the storefront layout needs. It renders the frame once,
 *  dropping the routed page at its Outlet. `frame` is null when the active layout
 *  has published no silica chrome (the storefront keeps legacy chrome); `theme` is
 *  null when no authored theme is published (brand-derived theme wins). */
export function getPublishedFrame(ctx: PropertyContext): Promise<PublishedSilicaFrameDto> {
  return withTenant(ctx, async (tx) => {
    const [layout, site] = await Promise.all([
      tx.builderLayout.findFirst({ where: { propertyId: ctx.propertyId, isActive: true } }),
      tx.builderSite.findUnique({ where: { propertyId: ctx.propertyId } }),
    ]);
    const frame: SilicaFrame | null =
      layout?.silicaPublishedTree != null
        ? { root: layout.silicaPublishedTree as unknown as SilicaNode, editable: true }
        : null;
    return { frame, symbols: publishedSymbols(site), theme: publishedTheme(site) };
  });
}

/** The published page body for a storefront slug (docs/49 per-site). Matches on the
 *  normalized slug so `/shop` (stored) resolves the `shop` path segment. Null when
 *  no silica-published page owns that slug — the storefront falls through. */
export function getPublishedPageBySlug(
  ctx: PropertyContext,
  slug: string
): Promise<PublishedSilicaPageDto | null> {
  return withTenant(ctx, async (tx) => {
    const [pages, site] = await Promise.all([
      tx.builderPage.findMany({
        where: { propertyId: ctx.propertyId },
        orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
      }),
      tx.builderSite.findUnique({ where: { propertyId: ctx.propertyId } }),
    ]);
    const target = normalizeSlug(slug);
    const row = pages
      .filter(isSilicaPublished)
      .find((r) => normalizeSlug(r.slug) === target && target !== '');
    if (!row) return null;
    return toPublishedPage(row, publishedSymbols(site));
  });
}

/** The published HOME body — the silica page whose slug is `/` (or empty). Lowest
 *  position wins. Null when the property has published no silica home. */
export function getPublishedHome(ctx: PropertyContext): Promise<PublishedSilicaPageDto | null> {
  return withTenant(ctx, async (tx) => {
    const [pages, site] = await Promise.all([
      tx.builderPage.findMany({
        where: { propertyId: ctx.propertyId },
        orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
      }),
      tx.builderSite.findUnique({ where: { propertyId: ctx.propertyId } }),
    ]);
    const row = pages.filter(isSilicaPublished).find((r) => normalizeSlug(r.slug) === '');
    if (!row) return null;
    return toPublishedPage(row, publishedSymbols(site));
  });
}

/** The active layout for the property, seeding the starter shell if the property
 *  has none yet (mirrors layoutService.listOrSeed's lazy materialization) so the
 *  frame always has a home. */
async function activeLayoutTx(tx: TxClient, ctx: PropertyContext): Promise<BuilderLayout> {
  const layouts = await tx.builderLayout.findMany({ where: { propertyId: ctx.propertyId } });
  const active = layouts.find((l) => l.isActive) ?? layouts[0];
  if (active) return active;
  return tx.builderLayout.create({
    data: {
      tenantId: ctx.tenantId,
      propertyId: ctx.propertyId,
      name: STARTER_LAYOUT.name,
      draftTree: asJson(STARTER_LAYOUT.tree),
      isActive: true,
      position: 0,
    },
  });
}

/** Reconcile an extracted silica `Site` into the store. Upserts a `BuilderPage`
 *  per page (by id — silica keeps ids stable), creates a row for a page silica
 *  just added, deletes a silica row absent from the payload (an explicit page
 *  removal), and writes the frame + symbols onto the active layout. */
export async function sync(ctx: PropertyContext, rawInput: unknown): Promise<void> {
  const input = SiteSyncInput.parse(rawInput);
  await withTenant(ctx, async (tx) => {
    const allPages = await tx.builderPage.findMany({ where: { propertyId: ctx.propertyId } });
    const silicaRows = allPages.filter(isSilica);
    const inputIds = new Set(input.pages.map((p) => p.id));
    const existingById = new Map(silicaRows.map((r) => [r.id, r] as const));

    // Deletes first (a removed page frees its slug before any create reuses it).
    for (const r of silicaRows) {
      if (!inputIds.has(r.id)) await tx.builderPage.delete({ where: { id: r.id } });
    }

    // Upsert each page; `position` follows the site's page order.
    for (let i = 0; i < input.pages.length; i += 1) {
      const p = input.pages[i]!;
      if (existingById.has(p.id)) {
        await tx.builderPage.update({
          where: { id: p.id },
          data: { name: p.name, slug: p.slug, silicaDraftTree: asJson(p.root), position: i },
        });
      } else {
        await tx.builderPage.create({
          data: {
            // silica's page id (a uuid) becomes the row id, so later syncs match.
            id: p.id,
            tenantId: ctx.tenantId,
            propertyId: ctx.propertyId,
            name: p.name,
            kind: 'singleton',
            slug: p.slug,
            // The sparx tree column is NOT NULL; a silica-only row parks a blank
            // sparx tree there (the storefront never reads it — it has no sparx
            // published tree, so it falls through the legacy path until cutover).
            draftTree: asJson(blankPageTree()),
            silicaDraftTree: asJson(p.root),
            position: i,
          },
        });
      }
    }

    // Frame → the active layout (the chrome row).
    const layout = await activeLayoutTx(tx, ctx);
    if (input.frame) {
      await tx.builderLayout.update({
        where: { id: layout.id },
        data: { silicaDraftTree: asJson(input.frame.root) },
      });
    }

    // Site-global theme + symbols → the property's silica site record (docs/118).
    // `theme` is only written when the payload carries one, so a tenant on the
    // brand-derived theme never has a null stomped over an authored theme.
    const themeData = input.theme ? { silicaDraftTheme: asJson(input.theme) } : {};
    const symbolsData = { silicaDraftSymbols: asJson(input.symbols ?? {}) };
    await tx.builderSite.upsert({
      where: { propertyId: ctx.propertyId },
      update: { ...themeData, ...symbolsData },
      create: {
        tenantId: ctx.tenantId,
        propertyId: ctx.propertyId,
        ...themeData,
        ...symbolsData,
      },
    });
  });
}

/** Snapshot every silica DRAFT into its published counterpart — the publish
 *  lifecycle. Covers all four parts of the silica `Site`: page bodies, the frame,
 *  and the site-global theme + symbols. The storefront reads only the published
 *  columns and re-renders on read. */
export async function publish(ctx: PropertyContext): Promise<void> {
  await withTenant(ctx, async (tx) => {
    const now = new Date();
    const allPages = await tx.builderPage.findMany({ where: { propertyId: ctx.propertyId } });
    const pages = allPages.filter(isSilica);
    for (const r of pages) {
      await tx.builderPage.update({
        where: { id: r.id },
        data: { silicaPublishedTree: asJson(r.silicaDraftTree), publishedAt: now },
      });
    }
    const layout = await tx.builderLayout.findFirst({
      where: { propertyId: ctx.propertyId, isActive: true },
    });
    if (layout?.silicaDraftTree != null) {
      await tx.builderLayout.update({
        where: { id: layout.id },
        data: { silicaPublishedTree: asJson(layout.silicaDraftTree), publishedAt: now },
      });
    }

    // Site-global theme + symbols: draft → published. A null draft theme publishes
    // as null (the storefront keeps rendering the brand-derived theme), so an author
    // who never touched the theme never freezes one in.
    const site = await tx.builderSite.findUnique({ where: { propertyId: ctx.propertyId } });
    if (site) {
      await tx.builderSite.update({
        where: { propertyId: ctx.propertyId },
        data: {
          silicaPublishedTheme:
            site.silicaDraftTheme == null ? Prisma.DbNull : asJson(site.silicaDraftTheme),
          silicaPublishedSymbols: asJson(site.silicaDraftSymbols),
          publishedAt: now,
        },
      });
    }
    await writeAuditLog({
      tx,
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      actorType: 'user',
      action: 'builder.site.published',
      entityType: 'Property',
      entityId: ctx.propertyId,
      diff: { after: { pages: pages.length } },
    });
  });
  await publishBuilderEvent({
    tenantId: ctx.tenantId,
    topic: 'builder.page.published',
    payload: { pageId: ctx.propertyId, name: 'site' },
  });
}
