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
 *  string `kind`) — silica owns the full shape and typed it, so `z.custom` keeps
 *  the real `SilicaNode` type while sparx stores the tree opaquely. Exported so
 *  other opaque-silica-shape validators (e.g. the MCP silica tools) reuse the
 *  exact same check instead of redefining it. */
export const SilicaTreeInput = z.custom<SilicaNode>(
  (v) => typeof v === 'object' && v !== null && typeof (v as { kind?: unknown }).kind === 'string',
  { message: 'Expected a silica-html Node (an object with a string `kind`)' }
);

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
 *  `SilicaTreeInput` above). */
export const SilicaThemeInput = z.custom<SilicaTheme>(
  (v) =>
    typeof v === 'object' &&
    v !== null &&
    typeof (v as { tokens?: unknown }).tokens === 'object' &&
    (v as { tokens?: unknown }).tokens !== null,
  { message: 'Expected a silica Theme (an object with a `tokens` map)' }
);

/** The whole extracted site — the debounced `onChange` payload. `frame`/`symbols`/
 *  `theme` are optional (a site can have no chrome, no saved components, and an
 *  unedited brand-derived theme). Every part is persisted; nothing is discarded. */
export const SiteSyncInput = z.object({
  pages: z.array(SiteSyncPageInput).min(1),
  frame: z.object({ root: SilicaTreeInput }).nullish(),
  symbols: z.record(z.string(), z.unknown()).nullish(),
  theme: SilicaThemeInput.nullish(),
  // The saved-theme library (silicaui 0.16). Structural per-theme validation via
  // the same opaque `SilicaThemeInput`; persisted as draft-only authoring state.
  savedThemes: z.array(SilicaThemeInput).nullish(),
});
export type SiteSyncInput = z.infer<typeof SiteSyncInput>;

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
 *  — the storefront then renders the tenant's brand-derived theme instead. */
export interface PublishedSilicaFrameDto {
  frame: SilicaFrame | null;
  symbols: Record<string, SilicaSymbolDef>;
  theme: SilicaTheme | null;
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
