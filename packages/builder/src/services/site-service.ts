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
  type SilicaPage,
  type SilicaSymbolDef,
  type SilicaTheme,
  type StoredSilicaSite,
} from '@sparx/builder-schemas';
import type { BuilderLayout, BuilderPage, BuilderSite } from '@sparx/db';
// @sparx/db re-exports the Prisma namespace as a VALUE (its `DbNull` runtime
// sentinel is needed to write SQL NULL into a nullable Json column).
import { Prisma, withTenant, type TxClient } from '@sparx/db';
// The authoring kit (docs/118 Stage N — the MCP single-item writers below). Only
// the 3 primitives needed to turn a caller's section list into a stamped page
// body; every other kit helper stays in @sparx/silica-catalog / the MCP tools.
import { defaultMakeId, pageBody, stampTree } from '@wizeworks/silicaui-html';

import { writeAuditLog } from '../audit';
import { publishBuilderEvent } from '../events';
import { BuilderValidationError } from '../errors';
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
  const savedThemes = site?.silicaDraftSavedThemes as SilicaTheme[] | null | undefined;
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
    ...(savedThemes && savedThemes.length > 0 ? { savedThemes } : {}),
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

/** The published silica COLLECTION template for a record type (docs/118 Stage 6 —
 *  the silica analogue of pageService.getPublishedByRecordType). The generic
 *  per-record router: the PUBLISHED silica tree that renders a record of
 *  `recordType` (`commerce.product`, `cms.blog_post`), or null when none resolves.
 *
 *  Resolution order (docs/51 §6) — first PUBLISHED candidate wins:
 *    1. per-record OVERRIDE (BuilderPageAssignment for `recordId`, if given)
 *    2. the type DEFAULT     (BuilderPage.isDefault for this recordType)
 *    3. FALLBACK             (lowest-position published)
 *  An unpublished override/default falls through so the storefront never renders a
 *  draft. The caller injects the in-scope record (`product`, `blog_post`) — the buy
 *  box / entry template scopes its descendants to it. Off the `silica_*` published
 *  column; runs parallel to the sparx read until the storefront flips. */
export function getPublishedByRecordType(
  ctx: PropertyContext,
  recordType: string,
  recordId?: string
): Promise<PublishedSilicaPageDto | null> {
  return withTenant(ctx, async (tx) => {
    const [rows, site] = await Promise.all([
      tx.builderPage.findMany({
        where: { recordType, kind: 'collection', propertyId: ctx.propertyId },
        orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
      }),
      tx.builderSite.findUnique({ where: { propertyId: ctx.propertyId } }),
    ]);
    if (rows.length === 0) return null;

    // Per-record override (a specific template pinned to this exact record).
    let overrideId: string | null = null;
    if (recordId) {
      const assignment = await tx.builderPageAssignment.findFirst({
        where: { recordType, itemRef: recordId, propertyId: ctx.propertyId },
        select: { builderPageId: true },
      });
      overrideId = assignment?.builderPageId ?? null;
    }

    const override = overrideId ? rows.find((r) => r.id === overrideId) : undefined;
    const chosen =
      (override && isSilicaPublished(override) ? override : undefined) ??
      rows.find((r) => r.isDefault && isSilicaPublished(r)) ??
      rows.find(isSilicaPublished);

    if (!chosen) return null;
    return toPublishedPage(chosen, publishedSymbols(site));
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
    // Matched by id against EVERY page, not just already-silica ones: a page id
    // can belong to a legacy-only row (the onboarding→silica bridge reuses the
    // legacy page's id so both trees live on one row) — treating that as "new"
    // would `create()` a second row with the same id and collide on the PK.
    const existingById = new Map(allPages.map((r) => [r.id, r] as const));

    // Deletes first (a removed page frees its slug before any create reuses it).
    for (const r of silicaRows) {
      if (!inputIds.has(r.id)) await tx.builderPage.delete({ where: { id: r.id } });
    }

    // Upsert each page; `position` follows the site's page order.
    for (let i = 0; i < input.pages.length; i += 1) {
      const p = input.pages[i]!;
      if (existingById.has(p.id)) {
        const existing = existingById.get(p.id)!;
        // Only stamp `slug` when it actually changed under normalization — a
        // silica `Page.slug` is a non-nullable `string`, so a home page always
        // arrives as `''`; unconditionally writing that would clobber a legacy
        // row's `slug: null` (the LEGACY home-page sentinel `pageService`
        // reads) even though both normalize to the same empty route. Leaving a
        // semantically-unchanged slug alone keeps that legacy sentinel intact
        // for a row a bridge (not the studio editor) materialized in place.
        const slugChanged = normalizeSlug(existing.slug) !== normalizeSlug(p.slug);
        await tx.builderPage.update({
          where: { id: p.id },
          data: {
            name: p.name,
            ...(slugChanged ? { slug: p.slug } : {}),
            silicaDraftTree: asJson(p.root),
            position: i,
          },
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

    // Site-global theme + symbols + saved-theme library → the property's silica
    // site record (docs/118). `theme` and `savedThemes` are only written when the
    // payload carries them, so a tenant on the brand-derived theme never has a null
    // stomped over an authored theme, and a load that didn't send the library never
    // wipes it. An empty `savedThemes: []` IS present (the author cleared it) and is
    // stored as such.
    const themeData = input.theme ? { silicaDraftTheme: asJson(input.theme) } : {};
    const savedThemesData =
      input.savedThemes != null ? { silicaDraftSavedThemes: asJson(input.savedThemes) } : {};
    const symbolsData = { silicaDraftSymbols: asJson(input.symbols ?? {}) };
    await tx.builderSite.upsert({
      where: { propertyId: ctx.propertyId },
      update: { ...themeData, ...savedThemesData, ...symbolsData },
      create: {
        tenantId: ctx.tenantId,
        propertyId: ctx.propertyId,
        ...themeData,
        ...savedThemesData,
        ...symbolsData,
      },
    });
  });
}

/**
 * Discard the property's silica site so the next `load` returns null and the
 * editor re-opens on the CURRENT starter seed — the "re-seed, not backfill"
 * lifecycle (docs/118 Stage 4).
 *
 * Why this exists: catalog composites are STAMPED. `productGrid()` runs once, at
 * insert, and its tree is copied into the page and persisted. Improving the
 * factory — teaching a product card to link to its product, say — cannot reach a
 * tree that was already stamped, and there is no migration for that: the stale
 * tree is perfectly valid JSON. Re-seeding is the answer, and it belongs in the
 * product as a first-class action rather than a one-off script.
 *
 * DESTRUCTIVE for silica content, and deliberately inert for everything else:
 *   · silica-only page rows (materialized by `sync`, carrying a blank sparx tree)
 *     are DELETED — exactly as `sync` deletes a page silica dropped.
 *   · a page row that also carries real legacy sparx content keeps the row and
 *     loses only its silica columns: a reset must never destroy the tree the
 *     legacy storefront is still serving during the parallel run.
 *   · the frame's silica trees and the site-global symbols are cleared.
 *   · the authored THEME survives. Resetting the pages is not the same as throwing
 *     away the tenant's brand, and "reset my layout" should not silently force
 *     them to re-pick a theme.
 */
export async function reset(ctx: PropertyContext): Promise<void> {
  await withTenant(ctx, async (tx) => {
    const allPages = await tx.builderPage.findMany({ where: { propertyId: ctx.propertyId } });
    const silicaRows = allPages.filter(isSilica);

    for (const r of silicaRows) {
      // `publishedTree` is the LEGACY sparx column. A silica-only row never has
      // one (sync parks a blank `draftTree` there and nothing else), so the row
      // exists solely to carry the silica body — drop it.
      if (r.publishedTree == null) {
        await tx.builderPage.delete({ where: { id: r.id } });
      } else {
        await tx.builderPage.update({
          where: { id: r.id },
          data: { silicaDraftTree: Prisma.DbNull, silicaPublishedTree: Prisma.DbNull },
        });
      }
    }

    const layout = await tx.builderLayout.findFirst({
      where: { propertyId: ctx.propertyId, isActive: true },
    });
    if (layout) {
      await tx.builderLayout.update({
        where: { id: layout.id },
        data: { silicaDraftTree: Prisma.DbNull, silicaPublishedTree: Prisma.DbNull },
      });
    }

    const site = await tx.builderSite.findUnique({ where: { propertyId: ctx.propertyId } });
    if (site) {
      await tx.builderSite.update({
        where: { propertyId: ctx.propertyId },
        data: {
          silicaDraftSymbols: asJson({}),
          silicaPublishedSymbols: Prisma.DbNull,
          publishedAt: null,
        },
      });
    }

    await writeAuditLog({
      tx,
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      actorType: 'user',
      action: 'builder.site.reset',
      entityType: 'Property',
      entityId: ctx.propertyId,
      diff: { before: { pages: silicaRows.length } },
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

// ── Single-item safe writers (the Builder MCP silica tools) ───────────────────
//
// `sync()` is a WHOLE-SITE reconcile: any page missing from its payload gets
// DELETED (docs/118 — the editor always hands back the complete `Site`, so a
// missing page unambiguously means "the author removed it"). An MCP tool that
// authors one page — or one theme edit — at a time must never build a
// single-item payload and call `sync()` directly: that would delete every other
// page on the site. These wrappers load the CURRENT site, splice in the one
// change, and sync the whole result back, so a single-item write is safe by
// construction. They reuse `load`/`sync` verbatim — no reconciliation logic is
// duplicated here.

/** The empty site a property with no silica pages yet starts from. */
function emptySite(): StoredSilicaSite {
  return { pages: [] };
}

/** A silica `Site` always needs at least one page (its own schema requires it —
 *  `pages[0]` is the home/default page), so the FIRST write to a fresh or
 *  freshly-reset property must be `upsertPage` — `setFrame`/`setTheme` need a
 *  page to attach to and raise a clear error otherwise, rather than surfacing a
 *  raw schema-validation failure from `sync`. */
function requireAtLeastOnePage(current: StoredSilicaSite): void {
  if (current.pages.length === 0) {
    throw new BuilderValidationError(
      'This site has no pages yet — call upsert_silica_page to create one (e.g. the home page) before setting the frame or theme.'
    );
  }
}

/** Create or replace ONE page's body, leaving every other page/the frame/theme/
 *  symbols untouched. `sections` are the page's top-level children (siblings
 *  under the page-body wrapper) — the caller supplies content nodes only; never
 *  the outer wrapper or ids (`pageBody` + `stampTree` mint both). Omit `id` to
 *  create a new page; a fresh id then becomes its row id. Returns the page's id
 *  so a caller that omitted it learns what was minted. */
export async function upsertPage(
  ctx: PropertyContext,
  input: { id?: string; name: string; slug: string; sections: SilicaNode[] }
): Promise<{ id: string }> {
  const current = (await load(ctx)) ?? emptySite();
  const id = input.id ?? defaultMakeId();
  const root = stampTree(pageBody(input.sections));
  const nextPage: SilicaPage = { id, name: input.name, slug: input.slug, root };
  const exists = current.pages.some((p) => p.id === id);
  const pages = exists
    ? current.pages.map((p) => (p.id === id ? nextPage : p))
    : [...current.pages, nextPage];
  await sync(ctx, { ...current, pages });
  return { id };
}

/** Remove ONE page, leaving the rest of the site untouched. A silica `Site`
 *  cannot have zero pages, so removing the last one is refused with a clear
 *  message rather than left to fail inside `sync`'s schema validation. */
export async function removePage(ctx: PropertyContext, pageId: string): Promise<void> {
  const current = await load(ctx);
  if (!current) return;
  const pages = current.pages.filter((p) => p.id !== pageId);
  if (pages.length === current.pages.length) return;
  if (pages.length === 0) {
    throw new BuilderValidationError(
      `Cannot remove page ${pageId} — it is the site's only page. A site needs at least one page; replace its content with upsert_silica_page instead of deleting it.`
    );
  }
  await sync(ctx, { ...current, pages });
}

/** Replace the site's FRAME (chrome) — the shared navbar/Outlet/footer every
 *  page renders through — leaving pages/theme/symbols untouched. */
export async function setFrame(ctx: PropertyContext, input: { root: SilicaNode }): Promise<void> {
  const current = (await load(ctx)) ?? emptySite();
  requireAtLeastOnePage(current);
  await sync(ctx, { ...current, frame: { root: input.root } });
}

/** Replace the site's authored THEME (and optionally its saved-theme library),
 *  leaving pages/frame/symbols untouched. Passing `savedThemes` REPLACES the
 *  whole library (including `[]` to clear it); omitting it leaves the existing
 *  library alone, mirroring `sync`'s own nullish-vs-absent contract. */
export async function setTheme(
  ctx: PropertyContext,
  input: { theme: SilicaTheme; savedThemes?: SilicaTheme[] }
): Promise<void> {
  const current = (await load(ctx)) ?? emptySite();
  requireAtLeastOnePage(current);
  await sync(ctx, {
    ...current,
    theme: input.theme,
    ...(input.savedThemes !== undefined ? { savedThemes: input.savedThemes } : {}),
  });
}

/** The property's PUBLISHED site — pages + frame + theme + symbols, in one read
 *  (the published-column mirror of `load()`'s draft shape). Used by
 *  verification tooling (confirm what a publish actually made live) and by the
 *  Phase 3 blueprint capture path (docs/118). Null when nothing is published. */
export function getPublishedSite(ctx: PropertyContext): Promise<StoredSilicaSite | null> {
  return withTenant(ctx, async (tx) => {
    const allPages = await tx.builderPage.findMany({
      where: { propertyId: ctx.propertyId },
      orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
    });
    const pages = allPages.filter(isSilicaPublished);
    if (pages.length === 0) return null;
    const [layout, site] = await Promise.all([
      tx.builderLayout.findFirst({ where: { propertyId: ctx.propertyId, isActive: true } }),
      tx.builderSite.findUnique({ where: { propertyId: ctx.propertyId } }),
    ]);
    const symbols = publishedSymbols(site);
    const theme = publishedTheme(site);
    return {
      ...(layout?.silicaPublishedTree != null
        ? { frame: { root: layout.silicaPublishedTree as unknown as SilicaNode, editable: true } }
        : {}),
      pages: pages.map((r) => ({
        id: r.id,
        name: r.name,
        slug: r.slug ?? '/',
        root: r.silicaPublishedTree as unknown as SilicaNode,
      })),
      ...(Object.keys(symbols).length > 0 ? { symbols } : {}),
      ...(theme ? { theme } : {}),
    };
  });
}
