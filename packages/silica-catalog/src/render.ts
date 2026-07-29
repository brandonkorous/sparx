// The ONE silica render primitive — the seam that makes canvas == storefront
// structural (docs/118 §1.1). Both the storefront (`apps/site`) and the publish
// pipeline turn a stored silica `Site` into production HTML through this, exactly
// the way the builder canvas renders a live document — one resolution walk, one
// projection, so what an author sees is byte-faithfully what a visitor gets.
//
// The pipeline, in dependency order:
//   1. flattenSymbols — inline every saved-component INSTANCE to a fresh clone of
//      its master (symbols are an authoring concept; output is plain markup).
//   2. composeFrame  — drop the page body into the shared frame's single Outlet
//      (the header/nav/footer chrome wrapping every page). No frame → bare body.
//   3. resolveTree   — substitute `data:value` nodes with resolved values and
//      expand `data:collection` nodes one-clone-per-item, via the host's
//      SYNCHRONOUS resolver (sparx's `createSilicaResolver` over pre-loaded data).
//      Absent a host → the tree passes through unchanged (a static page).
//   4. dropEmptyUrlAttrs — remove `href=""` / `src=""` left by a binding that
//      resolved to nothing. A product with no URL must degrade to a plain card,
//      not to an anchor that silently reloads the page; see `attr-binding.ts`.
//   5. responsiveImages — offer the browser the width ladder for every sparx-hosted
//      image. Must run LAST, after resolution: a product card's image source comes
//      from the record, so before step 3 there is no URL to build a `srcset` from.
//   6. toHtml        — the framework-free HTML projection; `data-sui-*` markers on
//      behavior/action nodes are lowered for the client behavior runtime to wire.
//
// Pure + framework-free (silicaui-html only), so it runs on the server (RSC /
// publish) with no React dependency and stays the single source of render truth.

import { dropEmptyUrlAttrs } from './attr-binding';
import { responsiveImages } from './responsive-images';
import {
  composeFrame,
  flattenSymbols,
  resolveTree,
  toHtml,
  type DataScope,
  type Node,
  type ResolveHost,
  type Site,
  type SymbolDef,
  type ToHtmlOptions,
} from '@wizeworks/silicaui-html';

export interface RenderSilicaPageOptions {
  /** The synchronous data resolver — sparx's `createSilicaResolver` over the
   *  page's pre-loaded product/CMS/site data. Omit for a fully static page
   *  (no bindings), where the tree renders as authored. */
  host?: ResolveHost;
  /** The initial data scope (a collection-template page passes its in-scope
   *  record here as `{ item }`, so the page body's `item.*` refs resolve). */
  scope?: DataScope;
  /** Passed through to `toHtml` (e.g. `ids` for the preview canvas). */
  html?: ToHtmlOptions;
}

/** Compose (frame ⊕ body), flatten symbols, resolve bindings, and project one
 *  tree to an HTML string — the shared render step behind both a single page and
 *  a whole-site export. */
function renderComposedTree(
  pageRoot: Node,
  frameRoot: Node | undefined,
  symbols: Record<string, SymbolDef>,
  opts: RenderSilicaPageOptions
): string {
  const body = flattenSymbols(pageRoot, symbols);
  const composed = frameRoot ? composeFrame(flattenSymbols(frameRoot, symbols), body) : body;
  const resolved = opts.host ? resolveTree(composed, opts.host, opts.scope) : composed;
  return toHtml(responsiveImages(dropEmptyUrlAttrs(resolved)), opts.html);
}

/** Render ONE page of a site to the full production HTML a visitor to its route
 *  receives — the page body composed inside the shared frame, with bindings
 *  resolved against `opts.host`. Returns undefined for an unknown page id. */
export function renderSilicaPage(
  site: Site,
  pageId: string,
  opts: RenderSilicaPageOptions = {}
): string | undefined {
  const page = site.pages.find((p) => p.id === pageId);
  if (!page) return undefined;
  return renderComposedTree(page.root, site.frame?.root, site.symbols ?? {}, opts);
}

/** Render a stored page body directly (the storefront's usual entry — it fetches
 *  one page's tree + the active frame by slug/record, not a whole in-memory Site).
 *  Frame + symbols are optional; a bare page renders without chrome. */
export function renderSilicaBody(
  pageRoot: Node,
  opts: RenderSilicaPageOptions & { frame?: Node; symbols?: Record<string, SymbolDef> } = {}
): string {
  const { frame, symbols, ...rest } = opts;
  return renderComposedTree(pageRoot, frame, symbols ?? {}, rest);
}

/** One rendered page: its identity plus the composed HTML — the whole-site export
 *  the publish pipeline maps to routes. */
export interface RenderedSilicaPage {
  id: string;
  name: string;
  slug: string;
  html: string;
}

/** Render EVERY page of a site to composed HTML (the publish/export path). The
 *  host is shared across pages; a per-record collection page still resolves one
 *  page at a time upstream, so this is the static/singleton export. */
export function renderSilicaSite(
  site: Site,
  opts: RenderSilicaPageOptions = {}
): RenderedSilicaPage[] {
  const symbols = site.symbols ?? {};
  return site.pages.map((p) => ({
    id: p.id,
    name: p.name,
    slug: p.slug,
    html: renderComposedTree(p.root, site.frame?.root, symbols, opts),
  }));
}
