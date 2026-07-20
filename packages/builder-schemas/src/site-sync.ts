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
});
export type SiteSyncPageInput = z.infer<typeof SiteSyncPageInput>;

/** A silica `Theme` — `{ name, tokens, dark?, mode? }`, where `tokens`/`dark` are
 *  the `--*` custom-property maps verbatim. Validated structurally (silica owns the
 *  shape); stored opaquely and projected straight to CSS. Exported for reuse (see
 *  `SilicaTreeInput` above for why this is `z.looseObject`, not `z.custom`). */
export const SilicaThemeInput = z.looseObject({
  tokens: z.record(z.string(), z.unknown()),
}) as unknown as z.ZodType<SilicaTheme>;

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
  symbols: z.record(z.string(), z.unknown()).nullish(),
  theme: SilicaThemeInput.nullish(),
  // The saved-theme library (silicaui 0.16). Structural per-theme validation via
  // the same opaque `SilicaThemeInput`; persisted as draft-only authoring state.
  savedThemes: z.array(SilicaThemeInput).nullish(),
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
