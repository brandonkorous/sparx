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
  resolvePageFrame,
  storedToFrameId,
  type BuilderOpEnvelope,
  type BuilderPageKind,
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
import {
  RECORD_ADDRESSES,
  RECORD_ADDRESS_SLUGS,
  isRecordAddress,
  recordAddressAt,
  recordAddressFor,
  recordPage,
  slugCandidatesForPath,
  starterFrame,
  type RecordAddress,
  type SiteChromeOptions,
} from '@sparx/silica-catalog';

import { writeAuditLog } from '../audit';
import { publishBuilderEvent } from '../events';
import { invalidatePublishedStylesheet } from './surface-css-service';
import { dropOwnerTx, reindexTreeTx } from './node-index-service';
import { createReleaseTx, recordArtifactTx, type ManifestEntry } from './artifact-service';
import { appendOpsTx } from './op-log-service';
import { captureDraftVersionTx, type DraftVersionSource } from './draft-version-service';
import { newOpBatch, pageCreateOp, pageDeleteOp, savedThemesSetOp, themeSetOp } from './silica-ops';
import { BuilderConflictError, BuilderValidationError } from '../errors';
import type { PropertyContext } from '../errors';

const asJson = (v: unknown): Prisma.InputJsonValue => v as Prisma.InputJsonValue;

/** A stored tree column read back as a silica node. The DB types it `JsonValue` —
 *  Prisma cannot know a JSONB column holds a `Node` — and only the extractor consumes
 *  it, which tolerates any shape (an unrecognized node simply contributes no rows).
 *  So this asserts what the column has always held rather than widening anything. */
const asNode = (v: unknown): SilicaNode => v as SilicaNode;

/** A page row is "silica-materialized" once it carries a silica DRAFT body. Filtered
 *  in JS rather than the `where` clause: a Json column's NULL check needs Prisma's
 *  runtime sentinel, and the row set here is already small + fully fetched.
 *
 *  DRAFT is the right test for every AUTHORING read (`load`, `sync`, `publish`,
 *  `publishState`): those speak about the site an author is editing, and a row with no
 *  draft body has nothing for them to edit, diff or re-snapshot. It is the WRONG test
 *  for anything that speaks about what VISITORS are served — see `hasSilicaContent`. */
const isSilica = (r: BuilderPage): boolean => r.silicaDraftTree != null;

/**
 * A page row that carries silica content in EITHER stage.
 *
 * The storefront reads `silica_published_tree` and never consults the draft
 * (`PUBLISHED_PAGE_SELECT`). So a row whose draft body is null while its published body
 * survives is **live and unreachable**: it wins its slug over any legacy sparx page,
 * and every tool that reasons about silica pages filters on `isSilica` — the draft
 * column — so it does not appear in the editor and `reset` skips it. Observed on a real
 * site, where `/contact` served a seeded starter page that no listing showed and no
 * tool could remove, while the page the tenant had actually authored never rendered.
 *
 * Use this ONLY where the question is "what is on the live site" rather than "what is
 * the author editing". Widening the authoring reads instead would surface bodyless
 * pages into the editor, which is a different bug with the same root.
 *
 * Exported for tests: the difference between this and `isSilica` is one `||`, and it
 * decides whether content a tenant asked to remove actually leaves their site.
 */
export const hasSilicaContent = (r: Pick<BuilderPage, 'silicaDraftTree' | 'silicaPublishedTree'>) =>
  r.silicaDraftTree != null || r.silicaPublishedTree != null;

/**
 * The `silicaDraftSymbols` write for a sync payload — `{}` (write nothing) when the
 * payload carries NO symbols map (docs/125 §9.3).
 *
 * ABSENT and EMPTY mean different things and must not collapse. Absent = "this caller
 * isn't speaking about symbols", which has to preserve the stored library. Empty =
 * "the author deleted their last saved component", which has to persist.
 *
 * Extracted as a pure function purely so it can be tested: it guards a whole-library
 * data loss that only reproduces through a transaction.
 */
export function symbolsUpdateFor(
  symbols: unknown
): Record<string, never> | { silicaDraftSymbols: Prisma.InputJsonValue } {
  return symbols != null ? { silicaDraftSymbols: asJson(symbols) } : {};
}

/** A symbols map, defaulting to empty. Stored as a NOT-NULL `{}` Json column. */
function symbolsOf(value: unknown): Record<string, SilicaSymbolDef> {
  return (value as Record<string, SilicaSymbolDef> | null | undefined) ?? {};
}

/** Rebuild the STORED site from materialized rows: page bodies + the active
 *  layout's frame + the property's site-global theme + symbols (docs/118). Page
 *  identity is the row's (id/name/slug); a null slug (a sparx-seeded home) shows as
 *  "/". A null `theme` means the author never edited it — the caller falls back to
 *  the tenant's brand-derived theme.
 *
 *  EXPORTED for tests. It is the READ half of the named-layout round trip whose write
 *  half is `syncNamedLayoutsTx`, and the two have to agree on three separate conventions
 *  — which layout is `frame` vs `frames`, that the key IS the row id, and that a
 *  tree-less row is skipped. Nothing about a disagreement is loud: the author's second
 *  layout would simply not come back after a reload, which is indistinguishable from
 *  never having saved. Not part of the service's public surface. */
export function rowsToStoredSite(
  pages: BuilderPage[],
  layouts: BuilderLayout[],
  site: BuilderSite | null
): StoredSilicaSite {
  const symbols = symbolsOf(site?.silicaDraftSymbols);
  const theme = site?.silicaDraftTheme as SilicaTheme | null | undefined;
  const savedThemes = site?.silicaDraftSavedThemes as SilicaTheme[] | null | undefined;
  const layout = layouts.find((l) => l.isActive) ?? null;
  // The catalog splits the way silica's `Site` does: the LIVE layout is the default
  // shell (`frame`), every other one is a named alternative (`frames[id]`). Keyed by
  // the row id, which is exactly what `builder_pages.frame_id` stores — so a page's
  // pointer needs no translation between the engine and the storefront.
  //
  // A layout with no silica tree yet (created through the legacy `.bx-*` catalog, or
  // never opened) is SKIPPED rather than sent as an empty shell: the engine would show
  // it in the switcher as a layout with no Outlet, which is not a thing an author can
  // repair from inside the editor.
  const named = layouts.filter((l) => !l.isActive && l.silicaDraftTree != null);
  return {
    ...(layout?.silicaDraftTree != null
      ? { frame: { root: layout.silicaDraftTree as unknown as SilicaNode, editable: true } }
      : {}),
    ...(named.length > 0
      ? {
          frames: Object.fromEntries(
            named.map((l) => [
              l.id,
              {
                root: l.silicaDraftTree as unknown as SilicaNode,
                editable: true,
                name: l.name,
              },
            ])
          ),
        }
      : {}),
    pages: pages.map((r) => ({
      id: r.id,
      name: r.name,
      // A PRE-ADDRESS RECORD TEMPLATE HAS ITS ADDRESS DERIVED, not defaulted to `/`.
      //
      // A page that renders one record used to be identified by `recordType` with no
      // slug at all, and rows like that are already in production — the DB seed writes
      // them, `STARTER_PAGES` ships them, and every blueprint install creates them. The
      // bare `?? '/'` loaded each one into the editor as a SECOND HOME PAGE: two entries
      // in the switcher both claiming `/`, one of them a product template.
      //
      // Its address was always implied by its `recordType`. Stating it here does three
      // things at once: the switcher shows it where it belongs, the ensure below reads
      // the address as occupied so it does not seed a duplicate, and the tenant's own
      // template — not a fresh copy of the factory — is the one they edit. The row
      // self-migrates on their next save, when `sync` writes the derived slug back.
      slug: recordAddressFor(r.recordType ?? '')?.slug ?? r.slug ?? '/',
      root: r.silicaDraftTree as unknown as SilicaNode,
      // The stored chrome choice, in the engine's spelling — so its own per-page layout
      // picker opens showing what this page actually does, rather than defaulting every
      // page to "Default layout" and inviting the author to re-pick what they already
      // picked. `undefined` is omitted by JSON, which IS the default case.
      frameId: storedToFrameId(r.frameId),
    })),
    ...(Object.keys(symbols).length > 0 ? { symbols } : {}),
    ...(theme ? { theme } : {}),
    ...(savedThemes && savedThemes.length > 0 ? { savedThemes } : {}),
  };
}

/** Load the property's stored silica site, or null if none is materialized yet.
 *  Carries the authored theme when one exists; otherwise the caller composes the
 *  tenant's brand-derived theme.
 *
 *  `modules` decides which record detail pages this property should have. Omitted, it
 *  defaults the same way `starterPages` does (Commerce on, Scheduling and CMS off), so
 *  a caller that has no flags to hand — a test, a script — behaves predictably rather
 *  than seeding a publisher a product page. */
export function load(
  ctx: PropertyContext,
  modules: SiteChromeOptions = {}
): Promise<StoredSilicaSite | null> {
  return withTenant(ctx, async (tx) => {
    let allPages = await tx.builderPage.findMany({
      where: { propertyId: ctx.propertyId },
      orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
    });
    // Only for a property that already HAS a site. With no pages at all the studio opens
    // on `starterSite`, which composes the record pages itself, and materializing them
    // here would leave a half-seeded site — record pages and no Home.
    const silicaPages = allPages.filter(isSilica);
    if (silicaPages.length > 0) {
      // SILICA ROWS ONLY decide whether an address is taken. A legacy sparx-tier
      // template (`STARTER_PAGES` seeds one per record type, with a null slug and no
      // silica tree) never reaches the switcher, so counting it as the occupant would
      // mean seeding nothing and leaving the tenant exactly as unable to edit their
      // product page as before. It cannot collide either — its slug is null.
      const seeded = await ensureRecordPagesTx(tx, ctx, silicaPages, modules);
      if (seeded) {
        allPages = await tx.builderPage.findMany({
          where: { propertyId: ctx.propertyId },
          orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
        });
      }
    }
    const pages = allPages.filter(isSilica);
    if (pages.length === 0) return null;
    const [layouts, site] = await Promise.all([
      tx.builderLayout.findMany({
        where: { propertyId: ctx.propertyId },
        orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
      }),
      tx.builderSite.findUnique({ where: { propertyId: ctx.propertyId } }),
    ]);
    return rowsToStoredSite(pages, layouts, site);
  });
}

// ── Public storefront reads (docs/118 Stage 6, the render cutover) ────────────
// The PUBLISHED silica trees the storefront renders through `renderSilicaBody`.
// Mirror the sparx pageService/layoutService public reads, but off the `silica_*`
// published columns. Runs parallel to the sparx reads until the storefront flips.

/**
 * WHICH tree a storefront read serves.
 *
 * `published` is the visitor's site. `draft` is the same read against the columns the
 * EDITOR writes — the editor's Preview, and nothing else. Preview is not a nicety: an
 * author who cannot see unpublished work before it goes live is publishing blind, and
 * before this existed the Preview button showed the last published version (or, for a
 * tenant who had never published, the code starter — i.e. never their own work).
 *
 * Modelled as a stage parameter rather than a parallel set of `getDraft*` functions
 * because the RESOLUTION rules — slug normalization, the home-is-slugless cases, the
 * override → default → fallback precedence for record templates — must be identical in
 * both. Two copies of that precedence chain is exactly how a preview starts lying about
 * which template a product will actually render on.
 */
export type SiteStage = 'published' | 'draft';

/** A page row carries a tree for `stage` once that stage's column is set. Published
 *  gates the storefront; draft gates preview (a page saved but never published still
 *  previews, which is the whole point).
 *
 *  Exported for tests: this one predicate decides whether a visitor sees a page at all,
 *  so "a published read never consults the draft column" is an invariant worth pinning
 *  rather than trusting to a two-branch ternary. Getting it backwards would serve
 *  unpublished work to the public. */
export function hasStagedTree(r: StagedPageRow, stage: SiteStage): boolean {
  return stagedTree(r, stage) != null;
}

/** The tree column for `stage` — the ONLY place the stage→column mapping is written. */
export function stagedTree(r: StagedPageRow, stage: SiteStage): unknown {
  return stage === 'draft' ? r.silicaDraftTree : r.silicaPublishedTree;
}

/** The frame-pointer column for `stage`, and the same invariant as {@link stagedTree}
 *  applied to chrome: a PUBLISHED render must never consult the draft choice.
 *
 *  Exported for tests for a sharper reason than symmetry. The two columns hold the same
 *  three values, so reading the wrong one is silent — no type error, no exception, just
 *  a live site that quietly changed shape when somebody pressed Save in an editor. That
 *  is the exact failure the staged pointer was added to prevent, so it gets a test
 *  rather than trust in a ternary. */
export function stagedFrameId(
  r: { frameId: string | null; publishedFrameId: string | null },
  stage: SiteStage
): string | null {
  return stage === 'draft' ? r.frameId : r.publishedFrameId;
}

/** Strip a leading slash so a stored silica slug (`/`, `/shop`) and the storefront's
 *  path segment (`shop`, or `''` for home) compare on equal footing. */
function normalizeSlug(slug: string | null | undefined): string {
  return (slug ?? '').replace(/^\/+/, '');
}

/**
 * The first row whose slug matches the earliest candidate — the literal page before the
 * record page that would also serve the path.
 *
 * `slugCandidatesForPath` documents its result as being in precedence order, and this is
 * what honours it. Both readers use this rather than an `orderBy`, because a SQL `IN`
 * has no order and the only stable ordering available (`position`) is something the
 * author controls by dragging pages around.
 *
 * `target === ''` (home) is passed through unchanged: its candidates are the NULL/''/'/'
 * spellings, which are alternates of one identity rather than a precedence chain, so the
 * caller's `position` ordering already decided it and there is nothing to re-rank.
 */
function pickByCandidate<T extends { slug: string | null }>(
  rows: readonly T[],
  candidates: readonly string[],
  target: string
): T | undefined {
  if (target === '' || rows.length <= 1) return rows[0];
  for (const candidate of candidates) {
    const row = rows.find((r) => r.slug === candidate);
    if (row) return row;
  }
  return rows[0];
}

/**
 * What a page's slug makes it — and the gate on `:`.
 *
 * A slug containing a colon is a RECORD ADDRESS or it is a mistake; there is no third
 * case, because `:` is not a pattern language here. `RECORD_ADDRESSES` is a closed,
 * platform-authored set of five, and every lookup that consumes one — the storefront's
 * per-record read, the frame resolver, the sitemap's skip, the link checker — is an exact
 * string comparison. Refusing anything else is precisely what keeps it that way: the
 * moment a free-form `:` slug can be stored, every one of those readers has to grow a
 * route matcher, and the ones that forget will fail silently.
 *
 * `sync` is the single door. Every silica write funnels through it — the studio, the MCP
 * `upsertPage`, the blueprint installer — so this is the one place the rule has to hold,
 * and the reason `PageSlug`'s regex is deliberately left alone (it guards the *authoring*
 * inputs, where a `:` must be impossible to type in the first place).
 */
function addressOf(slug: string): RecordAddress | null {
  const address = recordAddressAt(slug);
  if (!address && slug.includes(':')) {
    throw new BuilderValidationError(
      `"${slug}" is not a valid page address. Page addresses use lowercase letters, ` +
        `numbers and hyphens; the only addresses containing ":" are the pages sparx ` +
        `provides for your records (${RECORD_ADDRESS_SLUGS.join(', ')}), which cannot ` +
        `be created or renamed.`,
      [{ field: 'slug', message: 'Not a valid page address.' }]
    );
  }
  return address;
}

/**
 * Give a property the record detail pages its active modules call for.
 *
 * WHY THIS RUNS ON LOAD. A product detail page is an ordinary page now — it has an
 * address, so it belongs in the page switcher like Home and Shop. But every site created
 * before addresses existed was seeded without one, and there are a lot of them. This is
 * the only thing that puts the page in front of an existing tenant, and it follows the
 * house pattern for exactly that problem: `pageService.ensureHomeTx` heals a home-less
 * property on read, `listOrSeed` materializes the starters on first list. Same shape,
 * same idempotence.
 *
 * WHY ROWS RATHER THAN AN IN-MEMORY INJECTION. Handing the editor pages that have no row
 * looks cheaper and is not: two co-editors would mint different ids for the same page,
 * the op relay would carry edits against ids the other client has never seen, and the
 * durable op log would replay them at every later `catchup`. Writing the row first means
 * every client, every session and every op agrees on one identity — the same reason every
 * other seeded page is a row.
 *
 * Appended at the end, so no existing page's `position` moves. Both published readers
 * tiebreak on `position asc`, and renumbering pages on a read would be a real change
 * wearing the clothes of a no-op.
 */
async function ensureRecordPagesTx(
  tx: TxClient,
  ctx: PropertyContext,
  rows: readonly { slug: string | null; recordType: string | null; position: number }[],
  modules: SiteChromeOptions
): Promise<boolean> {
  const active = {
    commerce: modules.commerceEnabled ?? true,
    scheduling: modules.schedulingEnabled ?? false,
    cms: modules.cmsEnabled ?? false,
  };
  // An address counts as taken by its slug OR by a legacy row's `recordType`, because
  // `rowsToStoredSite` presents those at the same address — seeding a second one would
  // put two pages in the switcher for one route and collide on the unique index.
  const taken = new Set(
    rows.flatMap((r) => {
      const address = recordAddressAt(r.slug) ?? recordAddressFor(r.recordType ?? '');
      return address ? [address.recordType] : [];
    })
  );
  const missing = RECORD_ADDRESSES.filter((a) => active[a.module] && !taken.has(a.recordType));
  if (missing.length === 0) return false;

  let position = Math.max(0, ...rows.map((r) => r.position)) + 1;
  for (const address of missing) {
    const page = recordPage(address);
    await tx.builderPage.create({
      data: {
        id: page.id,
        tenantId: ctx.tenantId,
        propertyId: ctx.propertyId,
        name: page.name,
        kind: 'collection',
        recordType: address.recordType,
        slug: address.slug,
        draftTree: asJson(blankPageTree()),
        silicaDraftTree: asJson(page.root),
        position: position++,
      },
    });
  }
  return true;
}

/** The property's site-global symbols for `stage` (saved components). Read alongside
 *  every page so a body's symbol instances flatten at render. Preview reads the DRAFT
 *  map so a symbol edited but not yet published previews inside every page using it. */
function stagedSymbols(
  site: BuilderSite | null,
  stage: SiteStage
): Record<string, SilicaSymbolDef> {
  return symbolsOf(stage === 'draft' ? site?.silicaDraftSymbols : site?.silicaPublishedSymbols);
}

/** The property's authored theme for `stage`, or null when the author never saved one
 *  (the storefront then renders the tenant's brand-derived theme). */
function stagedTheme(site: BuilderSite | null, stage: SiteStage): SilicaTheme | null {
  const value = stage === 'draft' ? site?.silicaDraftTheme : site?.silicaPublishedTheme;
  return (value as SilicaTheme | null | undefined) ?? null;
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
const PAGE_META_SELECT = {
  id: true,
  name: true,
  slug: true,
  kind: true,
  recordType: true,
  isDefault: true,
  // Which chrome wraps this page (docs/silicaui/01 §5). A scalar, so it costs nothing on the
  // read that already refuses to drag trees it will discard.
  frameId: true,
  seoTitle: true,
  seoDescription: true,
  canonical: true,
  ogImage: true,
  noindex: true,
  publishedAt: true,
} as const;

const PUBLISHED_PAGE_SELECT = { ...PAGE_META_SELECT, silicaPublishedTree: true } as const;
const DRAFT_PAGE_SELECT = { ...PAGE_META_SELECT, silicaDraftTree: true } as const;

/** ONE tree column per read, chosen by stage — never both. The point of the note above
 *  is that a storefront read must not drag trees it will discard, and that holds just as
 *  hard for a preview read: serving the draft is not a licence to select the published
 *  column too. */
function pageSelectFor(stage: SiteStage) {
  return stage === 'draft' ? DRAFT_PAGE_SELECT : PUBLISHED_PAGE_SELECT;
}

/** A page row narrowed to {@link PAGE_META_SELECT} plus whichever ONE tree column the
 *  stage asked for. The page helpers take this rather than the full `BuilderPage` so a
 *  future column addition cannot silently re-widen the read back to every tree. */
export type StagedPageRow = Pick<BuilderPage, keyof typeof PAGE_META_SELECT> &
  Partial<Pick<BuilderPage, 'silicaPublishedTree' | 'silicaDraftTree'>>;

/** SEO + lifecycle projection shared by the page reads. */
function publishedPageMeta(r: StagedPageRow) {
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
  r: StagedPageRow,
  symbols: Record<string, SilicaSymbolDef>,
  stage: SiteStage
): PublishedSilicaPageDto {
  return {
    id: r.id,
    name: r.name,
    slug: r.slug ?? '',
    kind: r.kind,
    recordType: r.recordType,
    root: stagedTree(r, stage) as SilicaNode,
    symbols,
    ...publishedPageMeta(r),
  };
}

/** The published FRAME (chrome) + the site-global symbols + authored theme — one
 *  read for everything the storefront layout needs. It renders the frame once,
 *  dropping the routed page at its Outlet. `frame` is null when the active layout
 *  has published no silica chrome (the storefront keeps legacy chrome); `theme` is
 *  null when no authored theme is published (brand-derived theme wins).
 *
 *  `path` asks for the chrome THIS ROUTE should wear, rather than the site's default
 *  (docs/silicaui/01 §5). It exists because of an App Router constraint: `layout.tsx` wraps
 *  `page.tsx` and cannot see what the page resolved, so per-page frames are impossible
 *  while the layout asks for "the frame". Resolving by path here keeps the chrome in
 *  ONE place instead of duplicating `<SilicaChrome>` into a dozen routes.
 *
 *  A path matching no page (a product detail, a blog post — anything rendered by a
 *  collection template rather than a slug) falls back to the default, which is what
 *  those routes have always had. */
export function getPublishedFrame(
  ctx: PropertyContext,
  stage: SiteStage = 'published',
  path?: string
): Promise<PublishedSilicaFrameDto> {
  return withTenant(ctx, async (tx) => {
    const [layout, site, pageFrameId] = await Promise.all([
      tx.builderLayout.findFirst({ where: { propertyId: ctx.propertyId, isActive: true } }),
      tx.builderSite.findUnique({ where: { propertyId: ctx.propertyId } }),
      path == null ? undefined : findPageFrameId(tx, ctx.propertyId, path, stage),
    ]);

    const meta = { symbols: stagedSymbols(site, stage), theme: stagedTheme(site, stage) };
    const treeOf = (l: { silicaDraftTree: unknown; silicaPublishedTree: unknown } | null) =>
      stage === 'draft' ? l?.silicaDraftTree : l?.silicaPublishedTree;
    const asFrame = (root: unknown): SilicaFrame | null =>
      root != null ? { root: root as SilicaNode, editable: true } : null;

    const choice = resolvePageFrame(pageFrameId, EMPTY_IDS);
    // `default` covers both "no path given" and "this page takes the site default".
    if (choice.kind === 'default') return { frame: asFrame(treeOf(layout)), ...meta };
    // Explicitly bare. `frameless` matters as much as the null: the storefront falls
    // back to the code starter frame when a property has published no chrome, and
    // without the flag that fallback would put a header straight back onto the landing
    // page built to avoid one.
    if (choice.kind === 'none') return { frame: null, frameless: true, ...meta };

    const named = await tx.builderLayout.findFirst({
      where: { id: choice.frameId, propertyId: ctx.propertyId },
      select: { silicaDraftTree: true, silicaPublishedTree: true },
    });
    const frame = asFrame(treeOf(named));
    // A named layout that is GONE (deleted, or never published its silica chrome) also
    // renders bare, and is equally deliberate: the author moved this page off the
    // default, so quietly restoring the default is the wrong repair.
    return frame ? { frame, ...meta } : { frame: null, frameless: true, ...meta };
  });
}

/**
 * Which named layouts a sync may DELETE — the layout counterpart of `pagesToDelete`.
 *
 * Two rules, both of which cost a site real work if they are wrong:
 *
 * 1. **Absence never deletes.** Only ids the caller NAMES are removed. The engine hands
 *    a client the whole `Site`, so a stale client's payload is missing every layout
 *    created since it loaded — and inferring deletion from that is exactly the bug that
 *    once let one autosave wipe every page an agent had just authored (docs/126 §4.4).
 * 2. **The active layout is never deleted**, however loudly it is named. It is the site's
 *    default shell; removing it leaves every page that takes the default with no chrome
 *    at all. Silently ignoring the id is right here rather than throwing — the engine
 *    already refuses to delete the default, so an id arriving in this list means a stale
 *    client whose idea of "active" is out of date, not an author asking for this.
 *
 * Exported for tests: both rules are about data that is gone if they fail.
 */
export function framesToDelete(
  deletedFrameIds: readonly string[] | null | undefined,
  activeId: string
): string[] {
  return (deletedFrameIds ?? []).filter((id) => id !== activeId);
}

/**
 * Upsert the property's NAMED layouts from a sync payload (silicaui 0.37 `Site.frames`).
 *
 * `activeId` is excluded on the way in AND on the way out. The engine keeps the default
 * shell in `Site.frame`, never in `Site.frames`, so an id matching the live layout can
 * only be a stale client — and writing it here would let one payload carry two different
 * trees for the same row.
 *
 * A frame the property has never seen is CREATED with the engine's id as its primary
 * key. That is the whole reason this needs no translation table: `Page.frameId` in the
 * engine, `builder_pages.frame_id` in the database, and `builder_layouts.id` are one
 * value, so the storefront resolves a page's chrome without ever consulting the editor's
 * idea of it.
 */
async function syncNamedLayoutsTx(
  tx: TxClient,
  ctx: PropertyContext,
  frames: NonNullable<SiteSyncInput['frames']>,
  activeId: string
): Promise<void> {
  const existing = await tx.builderLayout.findMany({
    where: { propertyId: ctx.propertyId },
    select: { id: true, position: true },
  });
  const known = new Map(existing.map((l) => [l.id, l]));
  let nextPosition = existing.reduce((max, l) => Math.max(max, l.position), -1) + 1;

  for (const [frameId, frame] of Object.entries(frames)) {
    if (frameId === activeId) continue;
    const tree = asJson(frame.root);
    if (known.has(frameId)) {
      await tx.builderLayout.update({
        where: { id: frameId },
        // The label is only written when the payload carries one — `frame.rename` is an
        // op the engine emits, and a body-only save must not reset a layout's name.
        data: { silicaDraftTree: tree, ...(frame.name ? { name: frame.name } : {}) },
      });
    } else {
      await tx.builderLayout.create({
        data: {
          id: frameId,
          tenantId: ctx.tenantId,
          propertyId: ctx.propertyId,
          name: frame.name ?? 'Layout',
          // `draftTree` is the LEGACY `.bx-*` column and is non-null in the schema. A
          // silica-native layout has no legacy tree, so it takes the starter shell —
          // the same thing `activeLayoutTx` does when it materializes the first one.
          draftTree: asJson(STARTER_LAYOUT.tree as unknown as SilicaNode),
          silicaDraftTree: tree,
          // Never live on arrival. Activation is its own deliberate act (docs/45), and
          // a layout the author just created has not been published, so making it live
          // would swap the site's chrome for an unpublished shell.
          isActive: false,
          position: nextPosition++,
        },
      });
    }
    await reindexTreeTx(tx, ctx, { ownerKind: 'layout', ownerId: frameId, tree: frame.root });
  }
}

/** `resolvePageFrame` takes the ids that exist only to tell `named` from `missing`, and
 *  this read looks the named one up directly instead — building the set would be the
 *  same round trip twice. An id resolving to no row lands on the same `frame: null` as
 *  `none`, which is the behaviour `missing` prescribes anyway. */
const EMPTY_IDS: readonly string[] = [];

/** Which chrome the page at `path` asks for, or undefined when no page owns that path.
 *
 *  Stage-aware for the same reason the tree columns are: `frameId` is what the author is
 *  editing and `publishedFrameId` is what visitors are served, so a preview shows the
 *  chrome they are about to publish and the live site does not change until they do.
 *  Reading the draft column on a published render would mean pressing Save in the editor
 *  silently restyled production.
 *
 *  THE INVARIANT IS "SAME PAGE", NOT "SAME QUERY". This used to say it mirrored
 *  `getPublishedPageBySlug` exactly, and that was the right rule while every page was
 *  found by a literal slug. It is not any more: the body at `/products/brake-kit` comes
 *  from `getPublishedByRecordType`, which resolves the record page at `/products/:handle`
 *  — a slug no literal match would ever reach. Mirroring the old query would leave a
 *  product page taking the site-default chrome while its body came from a page that had
 *  chosen a different shell, which is the wrong-shell bug this comment has always warned
 *  about, arriving through the door the comment left open.
 *
 *  So both readers ask `slugCandidatesForPath` instead. One matcher, one answer. */
async function findPageFrameId(
  tx: TxClient,
  propertyId: string,
  path: string,
  stage: SiteStage
): Promise<string | null | undefined> {
  const target = normalizeSlug(path);
  const candidates = slugCandidatesForPath(target);
  const rows = await tx.builderPage.findMany({
    where: {
      propertyId,
      // Home is the slugless page — stored as NULL, '' or '/' depending on how it was
      // seeded; every other page is stored bare or `/`-prefixed by vintage.
      ...(target === ''
        ? { OR: [{ slug: null }, { slug: { in: ['', '/'] } }] }
        : { slug: { in: candidates } }),
    },
    select: { slug: true, frameId: true, publishedFrameId: true },
    orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
  });
  // PRECEDENCE COMES FROM THE CANDIDATE ORDER, NOT FROM `position`. A tenant who owns a
  // real page at `/products/brake-kit` must get THAT page's chrome, not the record
  // page's, and `IN` returns rows in no particular order. Ordering by position would
  // usually give the right answer — a seeded record page is appended last — and "usually"
  // is exactly the kind of thing that renders one tenant's page in the wrong shell after
  // they drag their pages into a different order.
  const row = pickByCandidate(rows, candidates, target);
  // `undefined` (no page owns this path) and `null` (this page takes the site default)
  // both land on `default`, which is what those routes have always rendered.
  if (!row) return undefined;
  return stagedFrameId(row, stage);
}

/** The published page body for a storefront slug (docs/49 per-site). Matches on the
 *  normalized slug so `/shop` (stored) resolves the `shop` path segment. Null when
 *  no silica-published page owns that slug — the storefront falls through. */
export function getPublishedPageBySlug(
  ctx: PropertyContext,
  slug: string,
  stage: SiteStage = 'published'
): Promise<PublishedSilicaPageDto | null> {
  const target = normalizeSlug(slug);
  // Home has its own reader; an empty target here can never resolve.
  if (target === '') return Promise.resolve(null);
  // A RECORD ADDRESS IS NOT A LOCATION. `/products/:handle` is where the page lives, not
  // somewhere a visitor goes, and answering it would hand back a template with nothing
  // bound into it — an empty buy box, a post with no post. Next's routing precedence
  // means the storefront never asks (the `[handle]` route wins over the catch-all), but
  // the auth-exempt `GET /v1/public/builder/silica/page?slug=…` takes any string a caller
  // sends. Refusing here is the difference between that being safe by design and safe by
  // coincidence.
  if (isRecordAddress(target)) return Promise.resolve(null);
  const candidates = slugCandidatesForPath(target);
  return withTenant(ctx, async (tx) => {
    const [pages, site] = await Promise.all([
      tx.builderPage.findMany({
        // Match in the WHERE clause, not in JS over every page in the property. Slugs
        // are stored either `/`-prefixed or bare depending on their vintage, so both
        // forms are queried rather than normalized on write — normalizing would need a
        // backfill migration, and an `IN` on the `(tenant, property, slug)` unique index
        // is exact and index-backed regardless.
        where: { propertyId: ctx.propertyId, slug: { in: candidates } },
        select: pageSelectFor(stage),
        orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
      }),
      tx.builderSite.findUnique({ where: { propertyId: ctx.propertyId } }),
    ]);
    // The tree check stays in JS: a Json column's NULL test needs Prisma's runtime
    // sentinel and this module imports Prisma as a type only.
    const publishable = pages.filter((p) => hasStagedTree(p, stage));
    const row = pickByCandidate(publishable, candidates, target);
    if (!row) return null;
    return toPublishedPage(row, stagedSymbols(site, stage), stage);
  });
}

/** The published HOME body — the silica page whose slug is `/` (or empty). Lowest
 *  position wins. Null when the property has published no silica home. */
export function getPublishedHome(
  ctx: PropertyContext,
  stage: SiteStage = 'published'
): Promise<PublishedSilicaPageDto | null> {
  return withTenant(ctx, async (tx) => {
    const [pages, site] = await Promise.all([
      tx.builderPage.findMany({
        // Home is the slugless page: stored as NULL (a sparx-seeded home), '' or '/'.
        where: { propertyId: ctx.propertyId, OR: [{ slug: null }, { slug: { in: ['', '/'] } }] },
        select: pageSelectFor(stage),
        orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
      }),
      tx.builderSite.findUnique({ where: { propertyId: ctx.propertyId } }),
    ]);
    const row = pages.find((p) => hasStagedTree(p, stage));
    if (!row) return null;
    return toPublishedPage(row, stagedSymbols(site, stage), stage);
  });
}

/** The published silica COLLECTION template for a record type (docs/118 Stage 6 —
 *  the silica analogue of pageService.getPublishedByRecordType). The generic
 *  per-record router: the PUBLISHED silica tree that renders a record of
 *  `recordType` (`commerce.product`, `cms.blog_post`), or null when none resolves.
 *
 *  RESOLUTION ORDER. The ADDRESS wins first: the page stored at `/products/:handle` is
 *  the product page, and because `(tenant, property, slug)` is UNIQUE that tier resolves
 *  to at most one row and needs no precedence rule at all. That is the whole point of
 *  giving these pages an address — the override table, the `isDefault` flag and the
 *  lowest-position tiebreak below exist only to pick between several rows claiming one
 *  record type, and an address makes several impossible.
 *
 *  Everything after it is the LEGACY tier, kept verbatim so Stage 1 regresses nobody
 *  whose template predates addresses (docs/51 §6) — per-record override, then
 *  `isDefault`, then lowest-position published. It goes away with the columns in Stage 2.
 *
 *  An unpublished override/default falls through so the storefront never renders a
 *  draft. The caller injects the in-scope record (`product`, `blog_post`) — the buy
 *  box / entry template scopes its descendants to it. Off the `silica_*` published
 *  column; runs parallel to the sparx read until the storefront flips. */
export function getPublishedByRecordType(
  ctx: PropertyContext,
  recordType: string,
  recordId?: string,
  stage: SiteStage = 'published'
): Promise<PublishedSilicaPageDto | null> {
  const address = recordAddressFor(recordType);
  return withTenant(ctx, async (tx) => {
    const [rows, site] = await Promise.all([
      tx.builderPage.findMany({
        where: {
          propertyId: ctx.propertyId,
          OR: [
            ...(address ? [{ slug: { in: [normalizeSlug(address.slug), address.slug] } }] : []),
            { recordType, kind: 'collection' },
          ],
        },
        select: pageSelectFor(stage),
        orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
      }),
      tx.builderSite.findUnique({ where: { propertyId: ctx.propertyId } }),
    ]);
    if (rows.length === 0) return null;

    const addressed = rows.find((r) => recordAddressAt(r.slug)?.recordType === recordType);
    if (addressed && hasStagedTree(addressed, stage)) {
      return toPublishedPage(addressed, stagedSymbols(site, stage), stage);
    }

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
      (override && hasStagedTree(override, stage) ? override : undefined) ??
      rows.find((r) => r.isDefault && hasStagedTree(r, stage)) ??
      rows.find((r) => hasStagedTree(r, stage));

    if (!chosen) return null;
    return toPublishedPage(chosen, stagedSymbols(site, stage), stage);
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
 *  just added, deletes ONLY the pages the caller explicitly named (never a page
 *  merely absent from the payload — see {@link pagesToDelete}), and writes the
 *  frame + symbols onto the active layout. */
/** Which stored silica pages a {@link sync} should DELETE.
 *
 *  Deletion is EXPLICIT, never inferred from a page's absence from the payload. A
 *  page missing from an autosave roster is as likely a concurrent create (an agent
 *  authoring over MCP while the operator has the studio open) as a removal, and the
 *  two are indistinguishable from the roster alone — so treating absence as deletion
 *  is exactly what let one autosave wipe every page an agent had just authored.
 *  Extracted as a pure function so the decision is directly testable (`sync` itself
 *  needs a database).
 *
 *  · allowReplace  → wholesale swap: every stored page absent from the roster (the
 *                    blueprint install / reset path that legitimately owns the site).
 *  · otherwise     → ONLY the ids the caller named in `deletedPageIds`, intersected
 *                    with what actually exists (a stale entry is a harmless no-op). */
export function pagesToDelete(args: {
  allowReplace: boolean;
  storedSilicaIds: readonly string[];
  roster: readonly string[];
  deletedPageIds: readonly string[];
}): string[] {
  const { allowReplace, storedSilicaIds, roster, deletedPageIds } = args;
  if (allowReplace) {
    const inRoster = new Set(roster);
    return storedSilicaIds.filter((id) => !inRoster.has(id));
  }
  const stored = new Set(storedSilicaIds);
  return deletedPageIds.filter((id) => stored.has(id));
}

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
  /** Who authored this save, for the draft version history (docs/126 §4.6). A human
   *  editor save is `save` (the default); an agent's MCP write is `agent`. */
  versionSource?: DraftVersionSource;
}

/** What a successful {@link sync} hands back: the post-write `updatedAt` for every
 *  page in the property, so the caller can advance its optimistic-concurrency map. */
export interface SiteSyncResult {
  pageUpdatedAt: Record<string, string>;
  /** The op log's new high-water sequence (docs/126 Phase 2), when this sync carried
   *  ops. The client `ackSeq()`s it so its `baseSeq` advances to what the server
   *  assigned. Null when the caller sent no ops (MCP writers, blueprint installer). */
  seq: number | null;
  /** The ops just persisted, for the caller to RELAY to co-editors (docs/126 Phase 4).
   *  Server-side only — the api-rest route hands this to the socket broadcaster and
   *  strips it from the HTTP response (the sender already has these ops). Null when no
   *  ops were recorded. */
  relay: { batchId: string; seq: number; ops: BuilderOpEnvelope[] } | null;
}

export async function sync(
  ctx: PropertyContext,
  rawInput: unknown,
  opts: SyncOptions = {}
): Promise<SiteSyncResult> {
  const input = SiteSyncInput.parse(rawInput);
  return asSlugConflict(input, () => syncTx(ctx, input, opts));
}

/**
 * Turn a duplicate-address constraint violation into a sentence the author can act on.
 *
 * `(tenantId, propertyId, slug)` is UNIQUE, so two pages claiming one address is a raw
 * Prisma P2002. Nothing downstream handled it: the builder error mapper knows only its
 * own three error classes, so it fell through to the generic handler as a 500 — and the
 * studio only forwards 4xx messages, which left the author with "Could not save —
 * Nothing was saved. Try again in a moment." on every subsequent attempt, forever, with
 * nothing anywhere naming the page or the address.
 *
 * Pre-existing, and reachable now that a record page has an address a second page could
 * collide with. `BuilderConflictError` maps to a 409 with the real message.
 */
async function asSlugConflict<T>(
  input: { pages: readonly { slug: string; name: string }[] },
  run: () => Promise<T>
): Promise<T> {
  try {
    return await run();
  } catch (err) {
    const code = (err as { code?: string })?.code;
    const target = (err as { meta?: { target?: unknown } })?.meta?.target;
    const onSlug =
      code === 'P2002' && (Array.isArray(target) ? target.includes('slug') : target === 'slug');
    if (!onSlug) throw err;
    const page = input.pages.find((p) => isRecordAddress(p.slug)) ?? input.pages[0];
    throw new BuilderConflictError(
      page
        ? `Another page already uses the address "${page.slug}". Two pages cannot share one address.`
        : 'Another page already uses that address. Two pages cannot share one address.',
      'slug'
    );
  }
}

function syncTx(
  ctx: PropertyContext,
  input: SiteSyncInput,
  opts: SyncOptions
): Promise<SiteSyncResult> {
  return withTenant(ctx, async (tx) => {
    const allPages = await tx.builderPage.findMany({ where: { propertyId: ctx.propertyId } });
    const silicaRows = allPages.filter(isSilica);

    // The COMPLETE page roster in site order (docs/126 Phase 0). When the caller sends
    // `pageIds`, `input.pages` carries only the bodies that actually changed and the
    // roster drives ordering (deletion is explicit — see `deletedPageIds`). Without it,
    // `input.pages` IS the roster — the original whole-site semantics.
    const roster = input.pageIds ?? input.pages.map((p) => p.id);
    const positionOf = new Map(roster.map((id, i) => [id, i] as const));

    // ── Clobber guard ────────────────────────────────────────────────────────
    // Deletion itself is explicit now (see the delete step below), so a stale roster
    // can no longer silently remove pages. But ZERO id overlap against a NON-EMPTY
    // site is still a red flag worth refusing: a real edit always keeps most page ids
    // (silica hands back the same `Site` it was given, mutated), so no overlap means
    // the caller is holding a DIFFERENT site than the one on disk. Writing it would
    // graft a foreign site's pages alongside the tenant's real ones — recoverable, but
    // wrong. Refuse rather than pollute.
    //
    // This is not hypothetical: a transient read failure made the studio seed a
    // pristine STARTER (fresh ids) over a real tenant. The route no longer swallows
    // that error, but the guard lives HERE so the store is safe from ANY caller — a
    // future route, an MCP tool, a bug. Seeding a brand-new property is unaffected
    // (no stored rows ⇒ nothing to clobber).
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
    // EXPLICIT only: a page absent from the roster is preserved, never deleted — it
    // may be a page a concurrent MCP writer just added that this client never loaded.
    // Only ids the caller named in `deletedPageIds` (or, on the wholesale-replace path,
    // roster-absent pages) are removed. See {@link pagesToDelete}.
    const toDelete = pagesToDelete({
      allowReplace: opts.allowReplace ?? false,
      storedSilicaIds: silicaRows.map((r) => r.id),
      roster,
      deletedPageIds: input.deletedPageIds ?? [],
    });
    for (const id of toDelete) {
      await tx.builderPage.delete({ where: { id } });
      // The index is derived, so a deleted page's rows are dead weight that would
      // otherwise keep answering "this symbol is used here" for a page that is gone.
      await dropOwnerTx(tx, ctx, 'page', id);
    }

    // Upsert each page whose body was sent. `position` comes from the ROSTER, not the
    // loop index — with a partial payload the index is meaningless.
    for (const p of input.pages) {
      const i = positionOf.get(p.id) ?? 0;
      const address = addressOf(p.slug);
      if (existingById.has(p.id)) {
        const existing = existingById.get(p.id)!;
        // Only stamp `slug` when it actually changed under normalization — a
        // silica `Page.slug` is a non-nullable `string`, so a home page always
        // arrives as `''`; unconditionally writing that would clobber a legacy
        // row's `slug: null` (the LEGACY home-page sentinel `pageService`
        // reads) even though both normalize to the same empty route. Leaving a
        // semantically-unchanged slug alone keeps that legacy sentinel intact
        // for a row a bridge (not the studio editor) materialized in place.
        //
        // A RECORD ADDRESS IS NOT THE AUTHOR'S TO CHANGE. It is how the storefront finds
        // the page at all: rename `/products/:handle` and every product page on the site
        // silently falls back to the platform template, with the tenant's own design
        // still sitting in the editor looking applied. silica's page settings will
        // happily offer the rename, so it is refused here rather than trusted not to
        // happen. The write is dropped, not thrown on — the page still saves, it just
        // keeps its address.
        const slugChanged =
          !isRecordAddress(existing.slug) && normalizeSlug(existing.slug) !== normalizeSlug(p.slug);
        await tx.builderPage.update({
          where: { id: p.id },
          data: {
            name: p.name,
            ...(slugChanged ? { slug: p.slug } : {}),
            // Re-derived on every save, which is what self-heals a legacy row: an
            // MCP- or blueprint-authored template arrives carrying the right
            // `recordType` and no slug, `rowsToStoredSite` gives it its address on the
            // way out, and this writes the address back. No migration needed for the
            // rows that were already correct in the old vocabulary.
            ...(address ? { kind: 'collection', recordType: address.recordType } : {}),
            silicaDraftTree: asJson(p.root),
            // Chrome only when the payload SPEAKS about it. `undefined` here is the
            // scripted writer that has no opinion, and overwriting on its behalf would
            // put a header back on every landing page it happened to touch.
            ...(p.frameId !== undefined ? { frameId: p.frameId } : {}),
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
            // DERIVED FROM THE ADDRESS, never sent. The address is the fact now; these
            // two columns are a projection of it that half a dozen consumers still read
            // — the sitemap's `kind:'singleton'` filter, the Pages report's prefix
            // rollup, the link checker's relative-path rule, the storefront's legacy
            // per-record tier. Writing them keeps every one of those correct with no
            // change of its own, and Stage 2 deletes the columns and their readers
            // together rather than one ahead of the other.
            kind: address ? 'collection' : 'singleton',
            recordType: address?.recordType ?? null,
            slug: p.slug,
            // The sparx tree column is NOT NULL; a silica-only row parks a blank
            // sparx tree there (the storefront never reads it — it has no sparx
            // published tree, so it falls through the legacy path until cutover).
            draftTree: asJson(blankPageTree()),
            silicaDraftTree: asJson(p.root),
            ...(p.frameId !== undefined ? { frameId: p.frameId } : {}),
            position: i,
          },
        });
      }
    }

    // Reindex the pages whose bodies this payload actually carried (docs/126 §5.4).
    // Rides the same transaction, so a rolled-back write leaves no index rows behind;
    // scoped to the sent pages, so a partial payload does not re-walk the whole site.
    for (const p of input.pages) {
      await reindexTreeTx(tx, ctx, { ownerKind: 'page', ownerId: p.id, tree: p.root });
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
      // The chrome holds symbol instances and bindings like any other tree.
      await reindexTreeTx(tx, ctx, {
        ownerKind: 'layout',
        ownerId: layout.id,
        tree: input.frame.root,
      });
    }

    // Named layouts → the rest of the catalog (silicaui 0.37). The engine mints their
    // ids with `crypto.randomUUID`, so an id it invents IS a valid `builder_layouts`
    // primary key and a valid `builder_pages.frame_id` — no id mapping to keep honest.
    if (input.frames) await syncNamedLayoutsTx(tx, ctx, input.frames, layout.id);
    const droppedFrames = framesToDelete(input.deletedFrameIds, layout.id);
    if (droppedFrames.length > 0) {
      await tx.builderLayout.deleteMany({
        where: { id: { in: droppedFrames }, propertyId: ctx.propertyId, isActive: false },
      });
      // Pages pointing at a deleted layout fall back to the site DEFAULT, not to
      // `null`-as-bare: losing your header is a much louder change than the author
      // asked for, and it is what the engine's own `deleteLayout` does.
      await tx.builderPage.updateMany({
        where: { propertyId: ctx.propertyId, frameId: { in: droppedFrames } },
        data: { frameId: null },
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
    // ABSENT and EMPTY are different (docs/125 §9.3). This was an unconditional
    // `input.symbols ?? {}`, so any payload that didn't carry symbols WIPED the
    // tenant's whole saved-component library — and `toSyncInput` only includes them
    // when `site.symbols` is truthy, so an engine handing back an empty/absent map
    // silently destroyed every saved component. Theme and savedThemes one line up
    // already guarded against exactly this; symbols did not.
    //
    // `{}` sent explicitly still stores `{}` — that IS "the author deleted their last
    // symbol", and a library you can never empty is its own bug.
    const symbolsData = symbolsUpdateFor(input.symbols);

    // Symbol MASTERS are trees too — one can instantiate another, and can bind a
    // pinned record. Reindexed only when the payload speaks about symbols at all
    // (see symbolsUpdateFor): an absent map must not be read as "no symbols exist".
    if (input.symbols != null) {
      const masters = input.symbols as Record<string, { root?: SilicaNode } | undefined>;
      // The library is replaced wholesale on write, so drop every symbol row for the
      // property first — a master removed from the map has no other signal it is gone.
      await tx.builderNodeIndex.deleteMany({
        where: { propertyId: ctx.propertyId, ownerKind: 'symbol' },
      });
      for (const [key, def] of Object.entries(masters)) {
        if (!def?.root) continue;
        await reindexTreeTx(tx, ctx, { ownerKind: 'symbol', ownerId: key, tree: asNode(def.root) });
      }
    }
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

    // Record the engine's ops in the SAME transaction as the snapshot write (docs/126
    // Phase 2). Additive — the snapshot above stays authoritative — but co-committed, so
    // the log can never claim an edit that rolled back. Only the collaborative editor
    // sends ops; scripted callers (MCP, blueprint installer) send none and get seq=null.
    let seq: number | null = null;
    let relay: SiteSyncResult['relay'] = null;
    if (input.ops && input.ops.length > 0) {
      const batchId = input.batchId ?? `sync-${input.baseSeq ?? 0}`;
      const result = await appendOpsTx(tx, ctx, input.ops, batchId, input.baseSeq ?? 0);
      seq = result.newSeq;
      // Relay only a batch we ACTUALLY recorded — an idempotent retry (alreadyApplied)
      // was already relayed on its first pass, and re-broadcasting it would make peers
      // apply the same ops twice.
      if (!result.alreadyApplied) {
        relay = { batchId, seq: result.newSeq, ops: input.ops };
      }
    }

    // Seal this save as a restorable draft version (docs/126 §4.6) — rides the SAME
    // transaction as the snapshot, so a rolled-back save leaves no orphan version, and a
    // save that changed nothing is skipped (no duplicate row). This is what makes a
    // last-write-wins overwrite recoverable rather than permanent.
    await captureDraftVersionTx(tx, ctx, opts.versionSource ?? 'save');

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
      seq,
      relay,
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
    // `hasSilicaContent`, not `isSilica`. Reset is the tool for "take this silica content
    // off my site", so it has to reason about what is SERVED, and the storefront serves
    // the published column. Filtering on the draft made reset skip precisely the rows a
    // tenant most needs it for: a published body with no draft is live, invisible to
    // every listing, and — before this — permanently so, because the one tool that
    // clears silica content could not see it either. The branch below already clears
    // BOTH columns; it was simply never reached for these rows.
    const silicaRows = allPages.filter(hasSilicaContent);

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
    const [allPages, layouts] = await Promise.all([
      tx.builderPage.findMany({ where: { propertyId: ctx.propertyId } }),
      tx.builderLayout.findMany({ where: { propertyId: ctx.propertyId } }),
    ]);
    const pages = allPages.filter(isSilica);
    // A page counts as unpublished when its BODY or its CHROME CHOICE differs from what
    // visitors are served. Counting only the tree would let "no header on this page" sit
    // in the editor with Publish greyed out, which is the same silence the staged
    // pointer exists to end.
    const unpublishedPages = pages.filter(
      (r) =>
        treeDiffers(r.silicaDraftTree, r.silicaPublishedTree) || r.frameId !== r.publishedFrameId
    ).length;
    // ANY layout, not just the live one — an edit to a named layout is unpublished work
    // a visitor is not seeing, and a signal that only watched the default shell would
    // tell the author there is nothing to publish while a page renders the old one.
    const frameUnpublished = layouts.some(
      (l) => l.silicaDraftTree != null && treeDiffers(l.silicaDraftTree, l.silicaPublishedTree)
    );

    // The most recent publish across pages + frame — the timestamp the author reads
    // as "what visitors currently see".
    const stamps = [
      ...pages.map((r) => r.publishedAt),
      ...layouts.map((l) => l.publishedAt),
    ].filter((d): d is Date => d != null);
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
 *  columns and re-renders on read.
 *
 *  Each part is ALSO written to the immutable artifact store and sealed into a
 *  release (docs/126 §5.3), which is what makes the publish reversible. The
 *  published columns stay authoritative for rendering until Phase 6 flips reads
 *  onto the artifacts — the two are written in the same transaction, so they
 *  cannot disagree. */
export async function publish(ctx: PropertyContext): Promise<{ id: string; hash: string }> {
  let publishedPageCount = 0;
  let release = { id: '', hash: '' };
  await withTenant(ctx, async (tx) => {
    const now = new Date();
    const manifest: ManifestEntry[] = [];
    const allPages = await tx.builderPage.findMany({ where: { propertyId: ctx.propertyId } });
    const pages = allPages.filter(isSilica);
    publishedPageCount = pages.length;
    for (const r of pages) {
      await tx.builderPage.update({
        where: { id: r.id },
        data: {
          silicaPublishedTree: asJson(r.silicaDraftTree),
          // The chrome POINTER publishes with the body, so a page and the shell around
          // it always go live together. Without this the editor's frame picker would
          // reach production on Save rather than on Publish.
          publishedFrameId: r.frameId,
          publishedAt: now,
        },
      });
      const hash = await recordArtifactTx(tx, ctx, 'page', r.id, r.silicaDraftTree);
      manifest.push({ ownerKind: 'page', ownerId: r.id, hash });
      // Also rebuild the node index here, not only in `sync` (docs/126 §5.4).
      //
      // `sync` alone leaves a real hole: it only ever indexes trees the editor just
      // saved, so a page nobody has touched since the index shipped is invisible to
      // every where-used query — and "which pages show this product?" silently
      // answering "none" is worse than not offering the answer at all. Publish is the
      // one operation guaranteed to visit EVERY tree in the property, so putting the
      // rebuild here means any published site has a complete index. Cheap: the trees
      // are already loaded and the rebuild rides this transaction.
      await reindexTreeTx(tx, ctx, {
        ownerKind: 'page',
        ownerId: r.id,
        tree: asNode(r.silicaDraftTree),
      });
    }
    // EVERY layout, not just the live one. A page pointed at a named layout renders
    // through that layout's PUBLISHED tree, so publishing only the active shell would
    // leave such a page serving whatever the alternative looked like when it was last
    // published — or, for one created since, nothing at all.
    const layouts = await tx.builderLayout.findMany({ where: { propertyId: ctx.propertyId } });
    for (const layout of layouts) {
      if (layout.silicaDraftTree == null) continue;
      await tx.builderLayout.update({
        where: { id: layout.id },
        data: { silicaPublishedTree: asJson(layout.silicaDraftTree), publishedAt: now },
      });
      const hash = await recordArtifactTx(tx, ctx, 'layout', layout.id, layout.silicaDraftTree);
      manifest.push({ ownerKind: 'layout', ownerId: layout.id, hash });
      await reindexTreeTx(tx, ctx, {
        ownerKind: 'layout',
        ownerId: layout.id,
        tree: asNode(layout.silicaDraftTree),
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
      const symbolsHash = await recordArtifactTx(
        tx,
        ctx,
        'symbols',
        ctx.propertyId,
        site.silicaDraftSymbols
      );
      manifest.push({ ownerKind: 'symbols', ownerId: ctx.propertyId, hash: symbolsHash });
      // Symbol masters, same completeness argument as the pages above. Wholesale
      // replace: a master dropped from the library has no other signal it is gone.
      await tx.builderNodeIndex.deleteMany({
        where: { propertyId: ctx.propertyId, ownerKind: 'symbol' },
      });
      const masters = (site.silicaDraftSymbols ?? {}) as Record<
        string,
        { root?: SilicaNode } | undefined
      >;
      for (const [key, def] of Object.entries(masters)) {
        if (!def?.root) continue;
        await reindexTreeTx(tx, ctx, { ownerKind: 'symbol', ownerId: key, tree: asNode(def.root) });
      }
      // A null theme records NO entry rather than an artifact holding `null`. Absence is
      // how a restore knows to clear the published theme, and it keeps the artifact table
      // free of rows that carry nothing.
      if (site.silicaDraftTheme != null) {
        const themeHash = await recordArtifactTx(
          tx,
          ctx,
          'theme',
          ctx.propertyId,
          site.silicaDraftTheme
        );
        manifest.push({ ownerKind: 'theme', ownerId: ctx.propertyId, hash: themeHash });
      }
    }

    release = await createReleaseTx(tx, ctx, manifest);

    await writeAuditLog({
      tx,
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      actorType: 'user',
      action: 'builder.site.published',
      entityType: 'Property',
      entityId: ctx.propertyId,
      diff: { after: { pages: pages.length, release: release.hash } },
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
    // `hash` is the release address (docs/126 §5.3) — the value a consumer can use as a
    // cache key, because it changes if and only if the published bytes did.
    payload: {
      propertyId: ctx.propertyId,
      scope: 'site',
      pages: publishedPageCount,
      releaseId: release.id,
      hash: release.hash,
    },
  });
  return release;
}

// ── Single-item safe writers (the Builder MCP silica tools) ───────────────────
//
// `sync()` is a WHOLE-SITE reconcile. An MCP tool that authors one page — or one
// theme edit — at a time must never build a single-item payload and call `sync()`
// directly. These wrappers load the CURRENT site, splice in the one change, and sync
// the whole result back, so a single-item write is safe by construction. They reuse
// `load`/`sync` verbatim — no reconciliation logic is duplicated here.
//
// Each wrapper also SYNTHESIZES the matching silica op (docs/126 §4.5) so an agent's
// write folds into a co-editor's open canvas LIVE via `applyRemoteOps`, exactly like a
// human edit — a new page relays as `page.create`, a removal as `page.delete`, a theme
// as `theme.set`. A change with no faithful delta op (replacing an existing page BODY or
// the FRAME — no `page.setRoot` exists, and the re-stamped tree shares no node ids to
// diff) carries a `reloadHint` instead: the co-editor is prompted to reload that page,
// never force-overwritten. The returned {@link SilicaWriteChange} tells the transport
// (api-mcp) what to broadcast.

/** The empty site a property with no silica pages yet starts from. */
function emptySite(): StoredSilicaSite {
  return { pages: [] };
}

/** What one scripted (MCP) write did, for the transport to relay to co-editors
 *  (docs/126 §4.5). `relay` is the just-appended op batch (batchId + seq + ops) — the
 *  transport emits it as an ordinary `ops:relay`, so a co-editor folds it in through the
 *  exact same `applyRemoteOps` path a human edit takes; null when nothing live-appliable
 *  was appended. `reloadHints` names the pages — or the `'frame'` sentinel — whose content
 *  was REPLACED with no faithful op, so a co-editor is prompted to reload them rather than
 *  have their own in-progress edits overwritten. */
export interface SilicaWriteChange {
  relay: SiteSyncResult['relay'];
  reloadHints: string[];
}

/** Sync a spliced whole-site payload from a scripted writer, appending any synthesized
 *  ops under a fresh idempotency batch, and report what a co-editor should do about it.
 *  Centralizes the op/batch plumbing so each wrapper only decides its op + reload hint. */
async function syncScripted(
  ctx: PropertyContext,
  site: object,
  opts: { ops?: BuilderOpEnvelope[]; reloadHints?: string[] } = {}
): Promise<SilicaWriteChange> {
  const ops = opts.ops ?? [];
  const { relay } = await sync(
    ctx,
    {
      ...site,
      ...(ops.length > 0 ? { ops, batchId: newOpBatch() } : {}),
    },
    // An agent's MCP write — labels the draft version in the history so the owner can see
    // which saves the assistant made.
    { versionSource: 'agent' }
  );
  return { relay, reloadHints: opts.reloadHints ?? [] };
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
): Promise<{ id: string; change: SilicaWriteChange }> {
  const current = (await load(ctx)) ?? emptySite();
  const id = input.id ?? defaultMakeId();
  const root = stampTree(pageBody(input.sections));
  const nextPage: SilicaPage = { id, name: input.name, slug: input.slug, root };
  const exists = current.pages.some((p) => p.id === id);
  const pages = exists
    ? current.pages.map((p) => (p.id === id ? nextPage : p))
    : [...current.pages, nextPage];
  // A NEW page relays as `page.create` — the reducer `pages.push`es it, so it folds into
  // a co-editor's canvas without touching their other pages. REPLACING an existing body
  // has no faithful delta op (fresh ids, no `page.setRoot`), so it carries a reload hint.
  const change = exists
    ? await syncScripted(ctx, { ...current, pages }, { reloadHints: [id] })
    : await syncScripted(ctx, { ...current, pages }, { ops: [pageCreateOp(nextPage)] });
  return { id, change };
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
): Promise<SilicaWriteChange | null> {
  const current = await load(ctx);
  if (!current) return null;
  const pages = current.pages.map((p) => (p.id === pageId ? { ...p, root } : p));
  if (pages.every((p, i) => p === current.pages[i])) return null; // no such page — nothing to write
  // A whole-root replace has no live delta op — a co-editor reloads this page.
  return syncScripted(ctx, { ...current, pages }, { reloadHints: [pageId] });
}

/** Remove ONE page, leaving the rest of the site untouched. A silica `Site`
 *  cannot have zero pages, so removing the last one is refused with a clear
 *  message rather than left to fail inside `sync`'s schema validation. */
export async function removePage(
  ctx: PropertyContext,
  pageId: string
): Promise<SilicaWriteChange | null> {
  const current = await load(ctx);
  if (!current) return null;
  const pages = current.pages.filter((p) => p.id !== pageId);
  if (pages.length === current.pages.length) return null;
  if (pages.length === 0) {
    throw new BuilderValidationError(
      `Cannot remove page ${pageId} — it is the site's only page. A site needs at least one page; replace its content with upsert_silica_page instead of deleting it.`
    );
  }
  // State the deletion EXPLICITLY: `sync` no longer removes a page just because it is
  // absent from the payload (that would delete pages a concurrent operator/agent added
  // and this snapshot never saw). `deletedPageIds` names the one page this call removes;
  // every other page — including any the operator authored meanwhile — is left intact.
  // It relays as `page.delete`, so a co-editor's canvas drops the page live.
  return syncScripted(
    ctx,
    { ...current, pages, deletedPageIds: [pageId] },
    { ops: [pageDeleteOp(pageId)] }
  );
}

/** Replace the site's FRAME (chrome) — the shared navbar/Outlet/footer every
 *  page renders through — leaving pages/theme/symbols untouched. The frame tree is
 *  reached only by node ops, and a scripted whole-frame swap has no faithful delta, so
 *  a co-editor is prompted to reload the frame rather than have theirs overwritten. */
export async function setFrame(
  ctx: PropertyContext,
  input: { root: SilicaNode }
): Promise<SilicaWriteChange> {
  const current = (await load(ctx)) ?? emptySite();
  requireAtLeastOnePage(current);
  return syncScripted(ctx, { ...current, frame: { root: input.root } }, { reloadHints: ['frame'] });
}

/** Replace the site's authored THEME (and optionally its saved-theme library),
 *  leaving pages/frame/symbols untouched. Passing `savedThemes` REPLACES the
 *  whole library (including `[]` to clear it); omitting it leaves the existing
 *  library alone, mirroring `sync`'s own nullish-vs-absent contract. Relays as
 *  `theme.set` (+ `savedThemes.set`) — both fold into a co-editor's canvas live. */
export async function setTheme(
  ctx: PropertyContext,
  input: { theme: SilicaTheme; savedThemes?: SilicaTheme[] }
): Promise<SilicaWriteChange> {
  const current = (await load(ctx)) ?? emptySite();
  requireAtLeastOnePage(current);
  const ops: BuilderOpEnvelope[] = [themeSetOp(input.theme)];
  if (input.savedThemes !== undefined) ops.push(savedThemesSetOp(input.savedThemes));
  return syncScripted(
    ctx,
    {
      ...current,
      theme: input.theme,
      ...(input.savedThemes !== undefined ? { savedThemes: input.savedThemes } : {}),
    },
    { ops }
  );
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
    const pages = allPages.filter((p) => hasStagedTree(p, 'published'));
    if (pages.length === 0) return null;
    const [layout, site] = await Promise.all([
      tx.builderLayout.findFirst({ where: { propertyId: ctx.propertyId, isActive: true } }),
      tx.builderSite.findUnique({ where: { propertyId: ctx.propertyId } }),
    ]);
    const symbols = stagedSymbols(site, 'published');
    const theme = stagedTheme(site, 'published');
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

// ── Blueprint capture (docs/118 Phase 3) ─────────────────────────────────────
// The read half of the blueprint capture path: a whole authored site enriched with
// the per-page domain columns (`kind`/`recordType`/`isDefault`/SEO) that `load` and
// `getPublishedSite` drop because silica's flat `Page` doesn't model them. The
// api-rest capture orchestration projects this straight into a `SiteDecl` via
// `@sparx/blueprints`' `captureSite`, so a captured collection template keeps
// binding to its record type on reinstall.

/** One page as the capture path needs it — the source silica body `root` PLUS the
 *  domain columns. Structurally mirrors `@sparx/blueprints`' `CapturedPageInput` so
 *  the projector consumes it directly, without this package importing that one. */
export interface CapturablePage {
  id: string;
  name: string;
  slug: string | null;
  root: SilicaNode;
  kind: BuilderPageKind;
  recordType: string | null;
  isDefault: boolean;
  seoTitle: string | null;
  seoDescription: string | null;
  canonical: string | null;
  ogImage: string | null;
  noindex: boolean;
}

export interface CapturableSite {
  pages: CapturablePage[];
  frame?: { root: SilicaNode };
  theme?: SilicaTheme;
  symbols?: Record<string, SilicaSymbolDef>;
}

export interface CaptureSourceOptions {
  /** Which trees to read: the author's working `draft` (default — capture without
   *  publishing) or the last `published` snapshot. */
  source?: 'draft' | 'published';
}

/** Read the property's authored site for capture into a blueprint, or null when it
 *  has materialized no site for the requested source. Mirrors `load` /
 *  `getPublishedSite` but keeps every page's domain columns. */
export function getCapturableSite(
  ctx: PropertyContext,
  opts: CaptureSourceOptions = {}
): Promise<CapturableSite | null> {
  const published = opts.source === 'published';
  return withTenant(ctx, async (tx) => {
    const allPages = await tx.builderPage.findMany({
      where: { propertyId: ctx.propertyId },
      orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
    });
    const pages = allPages.filter(published ? (p) => hasStagedTree(p, 'published') : isSilica);
    if (pages.length === 0) return null;
    const [layout, site] = await Promise.all([
      tx.builderLayout.findFirst({ where: { propertyId: ctx.propertyId, isActive: true } }),
      tx.builderSite.findUnique({ where: { propertyId: ctx.propertyId } }),
    ]);

    const frameTree = published ? layout?.silicaPublishedTree : layout?.silicaDraftTree;
    const symbols = symbolsOf(published ? site?.silicaPublishedSymbols : site?.silicaDraftSymbols);
    const theme =
      (published
        ? (site?.silicaPublishedTheme as SilicaTheme | null | undefined)
        : (site?.silicaDraftTheme as SilicaTheme | null | undefined)) ?? undefined;

    return {
      pages: pages.map((r) => ({
        id: r.id,
        name: r.name,
        slug: r.slug,
        root: asNode(published ? r.silicaPublishedTree : r.silicaDraftTree),
        // Normalized rather than cast: the row column and the zod union share values,
        // but a plain comparison typechecks without asserting Prisma's type.
        kind: r.kind === 'collection' ? 'collection' : 'singleton',
        recordType: r.recordType,
        isDefault: r.isDefault,
        seoTitle: r.seoTitle,
        seoDescription: r.seoDescription,
        canonical: r.canonical,
        ogImage: r.ogImage,
        noindex: r.noindex,
      })),
      ...(frameTree != null ? { frame: { root: asNode(frameTree) } } : {}),
      ...(theme ? { theme } : {}),
      ...(Object.keys(symbols).length > 0 ? { symbols } : {}),
    };
  });
}
