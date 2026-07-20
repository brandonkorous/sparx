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
  type SitePublishState,
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
// The starter chrome factory — the one definition of "the default header + footer",
// shared with the studio's seed path so a reset restores today's chrome, not a copy.
import { starterFrame, type SiteChromeOptions } from '@sparx/silica-catalog';

import { writeAuditLog } from '../audit';
import { publishBuilderEvent } from '../events';
import { invalidatePublishedStylesheet } from './surface-css-service';
import { BuilderConflictError, BuilderValidationError } from '../errors';
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
const isSilicaPublished = (r: Pick<BuilderPage, 'silicaPublishedTree'>): boolean =>
  r.silicaPublishedTree != null;

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

/**
 * The columns a PUBLISHED page read actually uses (docs/127 §2).
 *
 * `builder_pages` carries FOUR Json tree columns — `draft_tree`, `published_tree`,
 * `silica_draft_tree`, `silica_published_tree` — and these reads were unselected, so
 * serving one page transferred every tree of every page in the property (drafts
 * included), deserialized all of it in Prisma, then discarded everything but one
 * column of one row. On a 40-page site with 150 KB trees that is ~24 MB per request.
 *
 * Naming the columns is the whole fix. `silicaPublishedTree` is the only tree here;
 * the other three never leave the database on a storefront read.
 */
const PUBLISHED_PAGE_SELECT = {
  id: true,
  name: true,
  slug: true,
  kind: true,
  recordType: true,
  isDefault: true,
  silicaPublishedTree: true,
  seoTitle: true,
  seoDescription: true,
  canonical: true,
  ogImage: true,
  noindex: true,
  publishedAt: true,
} as const;

/** A page row narrowed to {@link PUBLISHED_PAGE_SELECT}. The published-page helpers
 *  take this rather than the full `BuilderPage` so a future column addition cannot
 *  silently re-widen the read back to every tree. */
type PublishedPageRow = Pick<BuilderPage, keyof typeof PUBLISHED_PAGE_SELECT>;

/** SEO + lifecycle projection shared by the published page reads. */
function publishedPageMeta(r: PublishedPageRow) {
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
  r: PublishedPageRow,
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
  const target = normalizeSlug(slug);
  // Home has its own reader; an empty target here can never resolve.
  if (target === '') return Promise.resolve(null);
  return withTenant(ctx, async (tx) => {
    const [pages, site] = await Promise.all([
      tx.builderPage.findMany({
        // Match in the WHERE clause, not in JS over every page in the property. Slugs
        // are stored either `/`-prefixed or bare depending on their vintage, so both
        // forms are queried rather than normalized on write — normalizing would need a
        // backfill migration, and an `IN` on the `(tenant, property, slug)` unique index
        // is exact and index-backed regardless.
        where: { propertyId: ctx.propertyId, slug: { in: [target, `/${target}`] } },
        select: PUBLISHED_PAGE_SELECT,
        orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
      }),
      tx.builderSite.findUnique({ where: { propertyId: ctx.propertyId } }),
    ]);
    // The published-tree check stays in JS: a Json column's NULL test needs Prisma's
    // runtime sentinel and this module imports Prisma as a type only.
    const row = pages.find(isSilicaPublished);
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
        // Home is the slugless page: stored as NULL (a sparx-seeded home), '' or '/'.
        where: { propertyId: ctx.propertyId, OR: [{ slug: null }, { slug: { in: ['', '/'] } }] },
        select: PUBLISHED_PAGE_SELECT,
        orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
      }),
      tx.builderSite.findUnique({ where: { propertyId: ctx.propertyId } }),
    ]);
    const row = pages.find(isSilicaPublished);
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
        select: PUBLISHED_PAGE_SELECT,
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
/** Would this sync payload CLOBBER the stored site — i.e. delete every page it has?
 *
 *  True when a non-empty stored site shares NO page id with the incoming pages. See
 *  the guard in `sync` for the full rationale; extracted here so the decision is pure
 *  and directly testable (`sync` itself needs a database).
 *
 *  · stored empty        → false (a fresh property seeding its starter — the legit path)
 *  · any id in common    → false (a normal edit, however many pages were removed)
 *  · no id in common     → TRUE  (the caller holds a different site than the store) */
export function wouldClobberSite(
  storedPageIds: readonly string[],
  incomingPageIds: readonly string[]
): boolean {
  if (storedPageIds.length === 0) return false;
  const incoming = new Set(incomingPageIds);
  return !storedPageIds.some((id) => incoming.has(id));
}

export interface SyncOptions {
  /** Permit a WHOLESALE REPLACEMENT — a sync whose pages share no id with the stored
   *  site, which otherwise trips the clobber guard below. Only for callers that mean
   *  to swap the whole site (a blueprint install, a reset→reseed). NEVER set this on
   *  the editor autosave path. */
  allowReplace?: boolean;
}

/** What a successful {@link sync} hands back: the post-write `updatedAt` for every
 *  page in the property, so the caller can advance its optimistic-concurrency map. */
export interface SiteSyncResult {
  pageUpdatedAt: Record<string, string>;
}

export async function sync(
  ctx: PropertyContext,
  rawInput: unknown,
  opts: SyncOptions = {}
): Promise<SiteSyncResult> {
  const input = SiteSyncInput.parse(rawInput);
  return withTenant(ctx, async (tx) => {
    const allPages = await tx.builderPage.findMany({ where: { propertyId: ctx.propertyId } });
    const silicaRows = allPages.filter(isSilica);

    // The COMPLETE page roster in site order (docs/126 Phase 0). When the caller sends
    // `pageIds`, `input.pages` carries only the bodies that actually changed and the
    // roster drives deletion + ordering. Without it, `input.pages` IS the roster —
    // the original whole-site semantics every other caller still uses.
    const roster = input.pageIds ?? input.pages.map((p) => p.id);
    const inputIds = new Set(roster);
    const positionOf = new Map(roster.map((id, i) => [id, i] as const));

    // ── Clobber guard ────────────────────────────────────────────────────────
    // This reconcile DELETES every stored page missing from the payload, published
    // trees and all — so a payload that is not actually "this site, edited" destroys
    // the tenant's live content irrecoverably.
    //
    // A real edit always keeps most page ids: silica hands back the same `Site` it
    // was given, mutated. ZERO id overlap against a NON-EMPTY site therefore never
    // means "the author deleted every page and made new ones" — the editor cannot
    // even express that in one step. It means the caller is holding a DIFFERENT site
    // than the one on disk, and the only outcomes are (a) destroy everything, or
    // (b) refuse. Refuse.
    //
    // This is not hypothetical: a transient read failure made the studio seed a
    // pristine STARTER (fresh ids) over a real tenant, and the first autosave deleted
    // every page. The route no longer swallows that error, but the guard lives HERE
    // so the store is safe from ANY caller — a future route, an MCP tool, a bug.
    // Seeding a brand-new property is unaffected (no stored rows ⇒ nothing to clobber).
    if (
      !opts.allowReplace &&
      wouldClobberSite(
        silicaRows.map((r) => r.id),
        roster
      )
    ) {
      throw new BuilderConflictError(
        `Refusing to sync: none of the ${roster.length} incoming page(s) match any of ` +
          `the ${silicaRows.length} stored page(s) for this site, so this write would delete ` +
          `every existing page. This usually means the editor loaded a starter or a different ` +
          `site instead of yours. Reload the editor; if you meant to replace the whole site, ` +
          `use the explicit replace path.`
      );
    }
    // Matched by id against EVERY page, not just already-silica ones: a page id
    // can belong to a legacy-only row (the onboarding→silica bridge reuses the
    // legacy page's id so both trees live on one row) — treating that as "new"
    // would `create()` a second row with the same id and collide on the PK.
    const existingById = new Map(allPages.map((r) => [r.id, r] as const));

    // ── Optimistic-concurrency precondition (docs/126 Phase 1) ───────────────
    // Reject rather than overwrite when a page moved under the author. Checked for
    // EVERY page being written, before ANY of them is written, so a conflict leaves
    // the site untouched instead of half-applied.
    //
    // Callers that legitimately own the whole site (the MCP writers, the blueprint
    // installer) send no map and keep last-write-wins.
    if (input.pageUpdatedAt) {
      const stale = input.pages.filter((p) => {
        const seen = input.pageUpdatedAt?.[p.id];
        const row = existingById.get(p.id);
        // A page the client has never seen (no entry) or that does not exist yet is
        // not a conflict — it is a create, or a caller that simply didn't track it.
        if (!seen || !row) return false;
        return row.updatedAt.getTime() > new Date(seen).getTime();
      });
      if (stale.length > 0) {
        const names = stale.map((p) => p.name).join(', ');
        throw new BuilderConflictError(
          `Someone else saved changes to ${stale.length === 1 ? 'this page' : 'these pages'} ` +
            `while you were editing: ${names}. Reload the editor to pick up their version — ` +
            `saving now would overwrite it.`,
          'pages'
        );
      }
    }

    // Deletes first (a removed page frees its slug before any create reuses it).
    for (const r of silicaRows) {
      if (!inputIds.has(r.id)) await tx.builderPage.delete({ where: { id: r.id } });
    }

    // Upsert each page whose body was sent. `position` comes from the ROSTER, not the
    // loop index — with a partial payload the index is meaningless.
    for (const p of input.pages) {
      const i = positionOf.get(p.id) ?? 0;
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

    // Reordering changes no page BODY, so with a partial payload the pages that moved
    // may not be in `input.pages` at all. Their position still has to follow the
    // roster, or a drag in the page list would appear to do nothing after a reload.
    if (input.pageIds) {
      const sent = new Set(input.pages.map((p) => p.id));
      for (const row of silicaRows) {
        if (sent.has(row.id)) continue;
        const next = positionOf.get(row.id);
        if (next === undefined || next === row.position) continue;
        await tx.builderPage.update({ where: { id: row.id }, data: { position: next } });
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

    // Hand back each page's post-write `updatedAt` so the client can advance its
    // precondition map (docs/126 Phase 1). Without this the client's timestamps would
    // go stale the instant it saved, and its own next write would look like a conflict
    // against itself.
    const after = await tx.builderPage.findMany({
      where: { propertyId: ctx.propertyId },
      select: { id: true, updatedAt: true },
    });
    return {
      pageUpdatedAt: Object.fromEntries(after.map((r) => [r.id, r.updatedAt.toISOString()])),
    };
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

/**
 * Restore the property's header + footer to the CURRENT starter chrome, leaving
 * every page body, the theme, and the symbols exactly as they are.
 *
 * Why this exists, and why it is not `reset`. Catalog composites are STAMPED: the
 * frame a tenant is using was copied out of `starterFrame()` at seed time and has
 * been frozen ever since. When the platform improves that chrome — teaching the
 * brand mark to read the tenant's uploaded logo, say — `upgradeFrameChrome` heals
 * the trees it can recognize on read, but it deliberately does NOT match a frame
 * whose brand is a bare text `<a>`: any anchor in a nav could be a real menu link,
 * and silently rewriting one would be worse than leaving it. That cohort has no
 * path forward at all — no amount of logo uploading reaches their header. This is
 * that path.
 *
 * BLAST RADIUS, deliberately narrow (`reset` is the whole-site sledgehammer and is
 * NOT what an author asking for "put my header back" means):
 *   · ONLY the active layout's silica DRAFT tree is rewritten.
 *   · The layout's PUBLISHED tree is untouched, so visitors keep the header they
 *     have until the author reviews the restored chrome and publishes it — the same
 *     draft-only contract `upgradeFrameChrome` follows on read.
 *   · No page row is read, written, or deleted. No theme, no symbols, no
 *     `publishedAt`.
 *
 * The module flags shape the restored nav exactly as they shape the starter seed:
 * a tenant with no Commerce module must not get a Shop link back.
 */
export async function resetFrame(
  ctx: PropertyContext,
  opts: SiteChromeOptions = {}
): Promise<SilicaFrame> {
  const frame = starterFrame(opts);
  await withTenant(ctx, async (tx) => {
    const layout = await activeLayoutTx(tx, ctx);
    await tx.builderLayout.update({
      where: { id: layout.id },
      data: { silicaDraftTree: asJson(frame.root) },
    });
    await writeAuditLog({
      tx,
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      actorType: 'user',
      action: 'builder.site.frame.reset',
      entityType: 'BuilderLayout',
      entityId: layout.id,
      diff: { before: { frame: layout.silicaDraftTree ?? null } },
    });
  });
  return frame;
}

/** Deep-equal for two stored trees. `JSON.stringify` is exact HERE (though not in
 *  general — key order matters) precisely because the published tree is a verbatim
 *  copy of the draft: same producer, same key order. A false "changed" would only
 *  ever nag; it can't lose work. */
const treeDiffers = (draft: unknown, published: unknown): boolean =>
  JSON.stringify(draft ?? null) !== JSON.stringify(published ?? null);

/** Compare every silica draft tree against its published counterpart. Read-only. */
export function publishState(ctx: PropertyContext): Promise<SitePublishState> {
  return withTenant(ctx, async (tx) => {
    const [allPages, layout] = await Promise.all([
      tx.builderPage.findMany({ where: { propertyId: ctx.propertyId } }),
      tx.builderLayout.findFirst({ where: { propertyId: ctx.propertyId, isActive: true } }),
    ]);
    const pages = allPages.filter(isSilica);
    const unpublishedPages = pages.filter((r) =>
      treeDiffers(r.silicaDraftTree, r.silicaPublishedTree)
    ).length;
    const frameUnpublished =
      layout?.silicaDraftTree != null &&
      treeDiffers(layout.silicaDraftTree, layout.silicaPublishedTree);

    // The most recent publish across pages + frame — the timestamp the author reads
    // as "what visitors currently see".
    const stamps = [...pages.map((r) => r.publishedAt), layout?.publishedAt ?? null].filter(
      (d): d is Date => d != null
    );
    const last = stamps.length ? new Date(Math.max(...stamps.map((d) => d.getTime()))) : null;

    return {
      hasUnpublished: unpublishedPages > 0 || frameUnpublished,
      unpublishedPages,
      frameUnpublished,
      lastPublishedAt: last?.toISOString() ?? null,
      neverPublished: last === null,
    };
  });
}

/** Snapshot every silica DRAFT into its published counterpart — the publish
 *  lifecycle. Covers all four parts of the silica `Site`: page bodies, the frame,
 *  and the site-global theme + symbols. The storefront reads only the published
 *  columns and re-renders on read. */
export async function publish(ctx: PropertyContext): Promise<void> {
  let publishedPageCount = 0;
  await withTenant(ctx, async (tx) => {
    const now = new Date();
    const allPages = await tx.builderPage.findMany({ where: { propertyId: ctx.propertyId } });
    const pages = allPages.filter(isSilica);
    publishedPageCount = pages.length;
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
  // The compiled Surface stylesheet is memoized per property (docs/127 §4). Publishing
  // is the only thing that changes a PUBLISHED tree, so this is the invalidation point —
  // without it a newly published class renders unstyled until the TTL backstop lapses.
  invalidatePublishedStylesheet(ctx);
  await publishBuilderEvent({
    tenantId: ctx.tenantId,
    topic: 'builder.page.published',
    // A whole-site publish, not one page — so it carries the propertyId and the page
    // count, NOT a `pageId`. It previously put `ctx.propertyId` in a field named
    // `pageId` (docs/127 §6), which was harmless only for as long as nothing consumed
    // it; cache-revalidation-worker now does.
    payload: { propertyId: ctx.propertyId, scope: 'site', pages: publishedPageCount },
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

/** Replace ONE page's body with a COMPLETE root, leaving the rest of the site
 *  untouched. The blueprint update path needs this: it three-way-merges a whole
 *  stored root and must write that root back verbatim. `upsertPage` cannot serve —
 *  it takes loose `sections` and re-wraps them through `pageBody` + `stampTree`,
 *  which would both double-wrap an already-complete body and re-mint every node id
 *  (severing the correspondence the merge keys on). */
export async function setPageRoot(
  ctx: PropertyContext,
  pageId: string,
  root: SilicaNode
): Promise<void> {
  const current = await load(ctx);
  if (!current) return;
  const pages = current.pages.map((p) => (p.id === pageId ? { ...p, root } : p));
  if (pages.every((p, i) => p === current.pages[i])) return; // no such page — nothing to write
  await sync(ctx, { ...current, pages });
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

// ── Blueprint install (docs/54 + docs/118 Phase 3) ────────────────────────────

/** One page a blueprint install lays down. No `id` — a manifest cannot know
 *  runtime UUIDs (the handle-not-id rule), so `installSite` mints one per page.
 *  `root` is the page's FULL silica body tree, taken verbatim. */
export interface InstallPageInput {
  name: string;
  slug: string;
  root: SilicaNode;
  kind?: string;
  recordType?: string | null;
  isDefault?: boolean;
  seoTitle?: string | null;
  seoDescription?: string | null;
  canonical?: string | null;
  ogImage?: string | null;
  noindex?: boolean;
}

export interface InstallSiteInput {
  pages: InstallPageInput[];
  frame?: { root: SilicaNode } | null;
  theme?: SilicaTheme | null;
  symbols?: Record<string, unknown> | null;
}

/**
 * Lay a whole authored site down over this property — the blueprint install seam.
 *
 * Deliberately NOT `stampTree`d. `stampTree` mints a fresh id on every node, which
 * would sever the correspondence the blueprint UPDATE path merges on (docs/55 §7.2
 * keys by node id across versions), so a re-stamped install would make every later
 * template update look like "the author replaced every node". The manifest's ids
 * are authored, stable, and written through unchanged. Page ROW ids are different —
 * those must be unique per property, so they are minted here.
 *
 * `allowReplace` is set on purpose: an install intentionally swaps the whole site,
 * which is exactly the wholesale replacement `sync`'s clobber guard exists to stop
 * on the editor path. This is the sanctioned caller.
 *
 * The per-page domain columns (`kind`/`recordType`/`isDefault`/SEO) are applied
 * AFTER the reconcile: `sync` speaks silica's flat `Page` shape, which does not
 * model them, so a page created by `sync` alone would be a plain singleton with no
 * SEO — a collection template would silently never bind to its recordType.
 */
export async function installSite(
  ctx: PropertyContext,
  input: InstallSiteInput
): Promise<{ pageIds: string[] }> {
  const pages = input.pages.map((p) => ({ ...p, id: defaultMakeId() }));

  await sync(
    ctx,
    {
      pages: pages.map((p) => ({ id: p.id, name: p.name, slug: p.slug, root: p.root })),
      ...(input.frame ? { frame: input.frame } : {}),
      ...(input.theme ? { theme: input.theme } : {}),
      ...(input.symbols ? { symbols: input.symbols } : {}),
    },
    { allowReplace: true }
  );

  await withTenant(ctx, async (tx) => {
    for (const p of pages) {
      const isCollection = p.kind === 'collection';
      await tx.builderPage.update({
        where: { id: p.id },
        data: {
          ...(p.kind ? { kind: p.kind } : {}),
          recordType: p.recordType ?? null,
          ...(p.seoTitle !== undefined ? { seoTitle: p.seoTitle } : {}),
          ...(p.seoDescription !== undefined ? { seoDescription: p.seoDescription } : {}),
          ...(p.canonical !== undefined ? { canonical: p.canonical } : {}),
          ...(p.ogImage !== undefined ? { ogImage: p.ogImage } : {}),
          ...(p.noindex !== undefined ? { noindex: p.noindex } : {}),
        },
      });
      // A recordType default is exclusive per (property, recordType) — clear any
      // incumbent before promoting this one, or two templates both claim the type
      // and which one renders becomes row-order luck.
      if (isCollection && p.isDefault && p.recordType) {
        await tx.builderPage.updateMany({
          where: { propertyId: ctx.propertyId, recordType: p.recordType, id: { not: p.id } },
          data: { isDefault: false },
        });
        await tx.builderPage.update({ where: { id: p.id }, data: { isDefault: true } });
      }
    }
  });

  return { pageIds: pages.map((p) => p.id) };
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
