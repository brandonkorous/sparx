// The silica-native site persistence contract (docs/118 Stage 3) — the wire shape
// the dashboard's `<Builder onChange>` PUTs and `siteService.sync` reconciles.
//
// silica's `<Builder>` hands the host the WHOLE `Site` on every edit
// (`editor.extractSite()`): its pages (each a routable body tree), the shared
// frame (chrome), and the site-global saved-component symbols. sparx decomposes
// that back into its own store — one `BuilderPage` row per page, the active
// `BuilderLayout` for the frame — so the per-page domain columns (recordType,
// SEO, collection-template semantics, per-site scoping) that silica's flat `Page`
// doesn't model are preserved.
//
// The node trees are silica's `Node` shape — OPAQUE to sparx (silica's own engine
// authored + validated them; sparx never parses a `ref`). So the trees validate
// structurally here (a non-null object), exactly as the sparx `BuilderNode` trees
// were only ever validated at the boundary, never in the DB.

import { z } from 'zod';
import type {
  Frame as SilicaFrame,
  Node as SilicaNode,
  Page as SilicaPage,
  Site as SilicaSite,
  SymbolDef as SilicaSymbolDef,
  Theme as SilicaTheme,
} from '@wizeworks/silicaui-html';

// Re-export the silica document types under sparx-namespaced aliases so consumers
// (`siteService`, the dashboard host) get them without a direct silicaui-html
// dependency edge of their own.
export type { SilicaFrame, SilicaNode, SilicaPage, SilicaSite, SilicaSymbolDef, SilicaTheme };

/** The STORED half of a silica `Site` — everything sparx persists: pages + frame +
 *  the site-global `theme` and `symbols` (docs/118). `siteService.load` returns
 *  this; the dashboard composes a full `Site` for `<Builder>`.
 *
 *  `theme` is NULL until an author edits the theme in the builder. In that case the
 *  dashboard falls back to the tenant's BRAND-DERIVED theme (`compiledToSilicaTheme`)
 *  and the storefront to `buildSilicaThemeCss` — so brand stays the default and an
 *  authored theme is an explicit override that wins once saved. It is never
 *  discarded. */
export interface StoredSilicaSite {
  pages: SilicaPage[];
  frame?: SilicaFrame;
  /** The NAMED layouts (silicaui 0.37 `Site.frames`) — every layout in the property's
   *  catalog EXCEPT the live one, which is `frame` above. Keyed by `BuilderLayout.id`,
   *  which is what `builder_pages.frame_id` stores, so a page's pointer means the same
   *  thing to the engine and to the storefront without a translation table. */
  frames?: Record<string, SilicaFrame>;
  symbols?: Record<string, SilicaSymbolDef>;
  theme?: SilicaTheme;
  /** The site's saved-theme LIBRARY (silica `Site.savedThemes`, silicaui 0.16) —
   *  the author's "This site" theme presets. Authoring state only (the storefront
   *  renders just the active `theme`), so it's persisted as a draft and never
   *  published. Absent until the author saves their first theme. */
  savedThemes?: SilicaTheme[];
}

/** A silica node tree, validated structurally (a non-null object carrying a
 *  string `kind`) — silica owns the full shape and typed it, so this keeps the
 *  real `SilicaNode` type (via the cast) while sparx stores the tree opaquely.
 *  Exported so other opaque-silica-shape validators (e.g. the MCP silica tools)
 *  reuse the exact same check instead of redefining it.
 *
 *  `z.looseObject`, not `z.custom` — a `z.custom` schema has no JSON Schema
 *  representation (Zod v4 throws "Custom types cannot be represented in JSON
 *  Schema" converting it), which broke the MCP server's `tools/list` for every
 *  tool taking a silica tree (upsert_silica_page/set_silica_frame/…) — the
 *  standard discovery call any real MCP client makes before ever calling a tool,
 *  so no client could see ANY of the server's tools, not just these three. A
 *  loose object requiring the same `kind: string` field is structurally
 *  equivalent and Zod can represent it. */
export const SilicaTreeInput = z.looseObject({
  kind: z.string(),
}) as unknown as z.ZodType<SilicaNode>;

/** One page in a synced site: silica's `Page` (id + name + slug + body root). The
 *  `id` is the sparx `BuilderPage` row id (silica keeps it stable across edits);
 *  a page silica just added carries a fresh uuid, which becomes a new row. */
export const SiteSyncPageInput = z.object({
  id: z.string().min(1),
  name: z.string(),
  slug: z.string(),
  root: SilicaTreeInput,
  /**
   * Which chrome wraps this page (docs/silicaui/01 §5), carried on the page it belongs to so the
   * engine's OWN per-page layout picker persists.
   *
   * FOUR states, because "say nothing" and "say default" have to be different:
   *
   *   absent    → this payload does not speak about chrome; the stored choice STANDS.
   *   `null`    → the site default. What the picker's "Default layout" means.
   *   `'none'`  → bare, no header or footer. The picker's "No layout (bare page)".
   *   a uuid    → that layout.
   *
   * The absent case is the guard `symbols` and `theme` already carry, and it matters
   * here for the same reason: an MCP writer or the blueprint installer sends pages
   * without a chrome opinion, and reading that silence as "default" would quietly reset
   * every landing page on the site to wearing a header.
   *
   * The engine spells the first two as `undefined` / `null` on `Page.frameId`; the host
   * maps them onto this on the way out, since JSON cannot carry `undefined`.
   */
  frameId: z
    .union([z.literal('none'), z.string().uuid()])
    .nullish()
    .optional(),
});
export type SiteSyncPageInput = z.infer<typeof SiteSyncPageInput>;

/** A silica `Theme` — `{ name, tokens, dark?, mode? }`, where `tokens`/`dark` are
 *  the `--*` custom-property maps verbatim. Validated structurally (silica owns the
 *  shape); stored opaquely and projected straight to CSS. Exported for reuse (see
 *  `SilicaTreeInput` above for why this is `z.looseObject`, not `z.custom`). */
export const SilicaThemeInput = z.looseObject({
  tokens: z.record(z.string(), z.unknown()),
}) as unknown as z.ZodType<SilicaTheme>;

/** One tree an op addresses (silicaui `OpTarget`). `page`/`symbol` always carry an id;
 *  `site` never does; `frame` carries one OPTIONALLY. The server reads this to key the
 *  op log by owner without understanding the op itself.
 *
 *  The frame id arrived with silicaui 0.37's NAMED LAYOUTS: absent still means the site's
 *  default shell, a string names one of `Site.frames`. Accepting it is not cosmetic —
 *  `z.object` STRIPS unknown keys, so leaving it out would silently drop the id and file
 *  every named-layout edit against the default frame. The history for two different
 *  shells would then be one interleaved log that no undo could untangle. */
export const BuilderOpTarget = z.union([
  z.object({ scope: z.literal('page'), id: z.string().min(1) }),
  z.object({ scope: z.literal('frame'), id: z.string().min(1).optional() }),
  z.object({ scope: z.literal('symbol'), id: z.string().min(1) }),
  z.object({ scope: z.literal('site') }),
]);
export type BuilderOpTarget = z.infer<typeof BuilderOpTarget>;

/**
 * One op, validated at the ENVELOPE only (silicaui 0.30 `Op` — docs/126 §2).
 *
 * The server persists ops verbatim and only needs `target` (which tree — for the
 * history index) and `kind` (which operation — for "every text edit" style queries).
 * Everything else is stored opaquely via `z.looseObject`. This is deliberate decoupling:
 * silicaui owns the op vocabulary, and adding a new op kind must never require a server
 * schema change to keep recording history. The engine-side `Op` union (imported into the
 * dashboard from `@wizeworks/silicaui-builder/react`) is the authority on the full shape;
 * the wire only pins the two fields the log is keyed on.
 */
export const BuilderOpEnvelope = z.looseObject({
  target: BuilderOpTarget,
  kind: z.string().min(1).max(32),
});
export type BuilderOpEnvelope = z.infer<typeof BuilderOpEnvelope>;

/** The whole extracted site — the debounced `onChange` payload. `frame`/`symbols`/
 *  `theme` are optional (a site can have no chrome, no saved components, and an
 *  unedited brand-derived theme). Every part is persisted; nothing is discarded. */
export const SiteSyncInput = z.object({
  pages: z.array(SiteSyncPageInput).min(1),
  /**
   * The COMPLETE page roster, in order, when `pages` carries only the pages whose
   * bodies actually changed (docs/126 Phase 0).
   *
   * The engine hands the host the entire `Site` on every edit, and the host wrote all
   * of it back on every 700ms autosave burst — so a one-character heading edit on a
   * 12-page site rewrote 12 JSONB columns, and two authors editing different pages
   * silently reverted each other because each payload was the whole site.
   *
   * With a roster, `pages` narrows to just the changed bodies while deletion and
   * ordering still resolve against the full set. Omit it and `pages` IS the roster —
   * the original whole-site semantics, which is what the MCP writers and the blueprint
   * installer still send.
   */
  pageIds: z.array(z.string().min(1)).nullish(),
  /**
   * The pages the caller EXPLICITLY removed — the only deletions a sync performs
   * (docs/126 §4.4). Deletion is an intent the client states, NEVER inferred from a
   * page's absence from `pages`/`pageIds`.
   *
   * The reason is the concurrent-authoring model: an operator keeps the studio open
   * while an agent writes over MCP. A page missing from an autosave roster is equally
   * "the operator deleted it" and "the agent just created a page this client never
   * loaded" — indistinguishable from the roster alone. Treating absence as deletion is
   * what let one autosave wipe every page an agent had authored a moment earlier. So an
   * absent page is PRESERVED; only ids named here are deleted (intersected with what
   * actually exists, so a stale entry is a harmless no-op).
   *
   * Omit it (or send `[]`) to delete nothing — the safe default every non-deleting
   * caller uses (the MCP page/frame/theme writers, which only ever touch what they name).
   * The one exception is a wholesale swap (`allowReplace` — blueprint install / reset),
   * where the roster IS authoritative and this field is ignored.
   */
  deletedPageIds: z.array(z.string().min(1)).nullish(),
  /**
   * Optimistic-concurrency precondition (docs/126 Phase 1): the `updatedAt` the client
   * last saw, per page id, as ISO strings.
   *
   * There is otherwise NO concurrency control on a builder tree — no version column,
   * no ETag, no lock. Two authors on one site each hold a full in-memory `Site`, so
   * whoever autosaves last silently reverts the other, including on pages they never
   * opened. Phase 0 shrinks that blast radius to the pages actually sent; this makes
   * the collision detectable instead of silent.
   *
   * A page whose stored `updatedAt` is newer than the sent one is REJECTED rather than
   * overwritten. Omit the map entirely for last-write-wins (MCP writers, the blueprint
   * installer, and any caller that legitimately owns the whole site).
   */
  pageUpdatedAt: z.record(z.string(), z.string()).nullish(),
  frame: z.object({ root: SilicaTreeInput }).nullish(),
  /**
   * The NAMED layouts (silicaui 0.37's `Site.frames`) — alternative shells a page can
   * be pointed at, keyed by layout id. The site's DEFAULT shell is `frame` above and is
   * deliberately NOT a member of this map, mirroring the engine: one shell, one place.
   *
   * `name` rides along because a layout's label is author-facing state the engine owns
   * (`frame.rename` is an op), and `editable` because `Frame.editable` is persisted
   * site state.
   *
   * ABSENT means "this payload says nothing about layouts" and leaves every stored one
   * alone — the same guard `symbols` carries, and for the same reason: a caller that
   * never loaded them must not be able to erase them.
   */
  frames: z
    .record(
      z.string().min(1),
      z.object({
        root: SilicaTreeInput,
        name: z.string().min(1).max(255).nullish(),
        editable: z.boolean().nullish(),
      })
    )
    .nullish(),
  /**
   * Layouts to REMOVE, named explicitly — never inferred from absence.
   *
   * Exactly the lesson `deletedPageIds` records (docs/126 §4.4): the engine hands back
   * the whole `Site`, so a client holding a stale copy would otherwise delete a layout a
   * concurrent writer had just added. Absence is silence; only this list deletes.
   *
   * Deleting the ACTIVE layout is refused — the site would have no default shell.
   */
  deletedFrameIds: z.array(z.string().min(1)).nullish(),
  symbols: z.record(z.string(), z.unknown()).nullish(),
  theme: SilicaThemeInput.nullish(),
  // The saved-theme library (silicaui 0.16). Structural per-theme validation via
  // the same opaque `SilicaThemeInput`; persisted as draft-only authoring state.
  savedThemes: z.array(SilicaThemeInput).nullish(),
  /**
   * The causal-ordered ops the engine emitted for THIS batch of edits (silicaui 0.30's
   * `onChange(site, ops, meta)` — docs/126 Phase 2). Appended to the op log alongside
   * the snapshot write, never in place of it: the snapshot stays authoritative, this is
   * the history + (future) realtime-relay stream.
   *
   * Omitted by every non-engine caller (MCP writers, blueprint installer) — they mutate
   * the snapshot directly and have no op stream, which is correct: the log records what
   * the collaborative editor did, and a scripted write has no author interleaving to
   * reconcile.
   */
  ops: z.array(BuilderOpEnvelope).nullish(),
  /**
   * The sequence number the client was at before these ops (`meta.baseSeq`). The server
   * assigns each op the next per-property seq and returns the new high-water mark so the
   * client can `ackSeq()` it. Present iff `ops` is.
   */
  baseSeq: z.number().int().nonnegative().nullish(),
  /**
   * A client-generated id for this flush's ops, so a retried save is idempotent — the
   * server refuses a batch it has already recorded rather than appending a second copy.
   * Present iff `ops` is; the client mints a fresh one per flush.
   */
  batchId: z.string().min(1).max(64).nullish(),
});
export type SiteSyncInput = z.infer<typeof SiteSyncInput>;

/** What the author has changed since they last published — the "your visitors are
 *  still seeing the old version" signal the studio surfaces.
 *
 *  A stored draft and a published tree are the SAME editor state at two points in
 *  time (publishing copies the draft verbatim), so this is a real comparison rather
 *  than a heuristic — and it stays honest across an edit-then-undo, where the tree
 *  comes back identical and the site correctly reads as fully published. */
export interface SitePublishState {
  /** True when ANY page, or the frame, differs from what visitors are served. */
  hasUnpublished: boolean;
  /** Pages whose body differs from the published one, INCLUDING pages never
   *  published at all (a new page no visitor can reach yet). */
  unpublishedPages: number;
  /** Whether the site chrome (header/footer) differs from the published frame. */
  frameUnpublished: boolean;
  /** When the site was last published; null if it never has been. */
  lastPublishedAt: string | null;
  /** True when nothing has EVER been published — visitors see no site at all,
   *  a materially different message from "your changes aren't live yet". */
  neverPublished: boolean;
}

// ── Publish history (docs/126 §5.3) ──────────────────────────────────────────
// Every publish seals an immutable RELEASE — the manifest of content-addressed
// trees that made up the whole site at that moment. The history is what makes a
// publish reversible, so these are the shapes the studio's history drawer reads.

/** One publish, as the history list shows it. */
export interface ReleaseSummaryDto {
  id: string;
  /** The content address of the manifest — the site's identity at this publish.
   *  Two publishes that changed nothing share a hash, which is how a no-op is
   *  recognized rather than shown as a distinct version. */
  hash: string;
  /** How many page bodies the release published. */
  pageCount: number;
  /** `publish` — an author pressed Publish. `restore` — this release reinstated an
   *  earlier one (rollback is itself a publish, so it appears in the history too). */
  source: string;
  /** For a `restore`, the release it reinstated. */
  restoredFromId: string | null;
  /** Null for a system publish (MCP, automation) with no human actor. */
  actorId: string | null;
  createdAt: string;
  /** True for the release visitors are being served right now — the newest one. */
  current: boolean;
}

/** What a restore actually did. Reported rather than assumed, because two of these
 *  numbers describe changes the author did not explicitly ask for (docs/126 §5.3). */
export interface RestoreResultDto {
  /** The NEW release the restore created — history is append-only, so restoring
   *  publishes the old manifest forward rather than rewinding. */
  releaseId: string;
  hash: string;
  /** Pages whose live version was rewritten from the restored release. */
  pagesRestored: number;
  /** Pages that were live but did not exist in the restored release — created
   *  afterwards, so the restore UNPUBLISHED them. Their drafts are untouched. */
  pagesUnpublished: number;
  /** Entries in the restored release whose page has since been deleted. Skipped:
   *  restoring must not resurrect something the author removed on purpose. */
  entriesSkipped: number;
}

// ── Where-used (docs/126 §5.4) ───────────────────────────────────────────────
// Answered from the derived node index rather than by walking every tree.

/** Where one tree references a thing. `ownerId` is a page/layout row id or a symbol
 *  key, per `ownerKind`; `count` is how many nodes in that tree reference it. */
export interface UsagePlacementDto {
  ownerKind: 'page' | 'layout' | 'symbol';
  ownerId: string;
  /** The author-facing name — the page/layout title, or the symbol key. Resolved
   *  server-side, because every consumer puts this in a sentence for a person. */
  label: string;
  count: number;
}

/** One node type present in the property's trees, with how often it occurs. Diff
 *  against the renderer's known set to find content that renders as nothing. */
export interface TypeCensusRowDto {
  type: string;
  count: number;
}

// ── Public storefront reads (docs/118 Stage 6, the render cutover) ────────────
// The published silica trees the storefront renders through `renderSilicaBody`.
// The frame (chrome) is read ONCE by the site layout; each route reads its page
// body. Both carry the site-global `symbols` so `flattenSymbols` can inline any
// saved-component instances they contain.

/** The published site FRAME + the site-global symbols + theme — everything the
 *  storefront layout needs in ONE read: the chrome shell it renders once (wrapping
 *  every routed page at its `Outlet`), the symbols any tree may inline, and the
 *  authored theme.
 *
 *  `frame` is null when the property has published no silica layout (the storefront
 *  keeps its legacy chrome). `theme` is null when no author theme has been published
 *  — the storefront then renders the tenant's brand-derived theme instead.
 *  `commerceEnabled` is whether the tenant's Commerce module is active — the ONLY
 *  module-state signal exposed publicly here, needed so the code-authored starter
 *  fallback (frame + home/shop/about/contact) never shows Shop/Cart/Orders chrome
 *  or a "Browse the shop" CTA to a tenant with no Commerce module (content and/or
 *  commerce — never assumed, per the platform's core framing). Only the PUBLIC
 *  storefront route computes it; other producers (the dashboard editor's own
 *  preview, `form-submit-service`) leave it undefined — callers that care default
 *  it to `true` (today's unconditional-Shop behavior), so it's opt-in, not a
 *  breaking change to any other consumer.
 *  `schedulingEnabled` is the same public module-state signal for the Scheduling
 *  module, driving the starter fallback's Book link + `/book` page. Unlike Commerce
 *  it defaults to `false` when undefined (scheduling is opt-in, no legacy behavior to
 *  preserve).
 *  `cmsEnabled` is the same signal for the CMS module, driving the starter fallback's
 *  Journal link + `/blog` index. Defaults to `false` like Scheduling. It was missing
 *  while the other two were here, which made a publisher-only tenant unreachable in
 *  their own chrome: posts rendered at `/blog/<slug>` with no index and no link. */
export interface PublishedSilicaFrameDto {
  frame: SilicaFrame | null;
  /**
   * `frame` is null because this PAGE asked for no chrome — not because the property
   * has published none (docs/silicaui/01 §5).
   *
   * The two are opposite instructions wearing the same `null`, and the storefront acts
   * on that difference: nothing published falls back to the code starter frame, so a
   * fresh tenant is live rather than blank, while a deliberately bare landing page must
   * render with no header and footer and get NO fallback. Without this flag the
   * fallback silently puts the chrome back on exactly the page built to avoid it.
   *
   * Only meaningful when `frame` is null; the server never sets it alongside a frame.
   */
  frameless?: boolean;
  symbols: Record<string, SilicaSymbolDef>;
  theme: SilicaTheme | null;
  commerceEnabled?: boolean;
  schedulingEnabled?: boolean;
  cmsEnabled?: boolean;
}

/** A published silica PAGE body + the meta the storefront titles/routes it by.
 *  `symbols` rides along (site-global, read from the active layout) so the body's
 *  symbol instances flatten at render. SEO mirrors the sparx `PublishedPageDto`
 *  fields (silica pages inherit the row's SEO columns until the inspector wires
 *  per-page SEO — docs/118 Stage 10). */
export interface PublishedSilicaPageDto {
  id: string;
  name: string;
  slug: string;
  kind: string;
  recordType: string | null;
  root: SilicaNode;
  symbols: Record<string, SilicaSymbolDef>;
  seoTitle: string | null;
  seoDescription: string | null;
  canonical: string | null;
  ogImage: string | null;
  noindex: boolean;
  publishedAt: string | null;
}
