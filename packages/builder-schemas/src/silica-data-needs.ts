// The storefront's data-need collector for silica trees (docs/118 Stage 6).
//
// The render cutover resolves a silica page's bindings against REAL records, the
// same way the sparx `loadBuilderData` walk did for sparx trees — but a silica
// node carries its binding as an opaque `data.ref` string, not a structured
// `node.binding`. This walks a silica tree, decodes every value/collection ref
// through the shared `binding-ref` codec, and reports which platform sources the
// storefront must fetch to fill the resolver root:
//   · `commerce`   — the tree binds the product catalog (a `commerce.product`
//                    collection, or a scoped `commerce.product.*` value).
//   · `cmsTypes`   — the content types it iterates (`cms.<type>` collections).
//   · `productPins`/`cmsPins` — the specific records it PINS by id (docs/98
//                    Pillar 7), hydrated under the reserved `__pins` root.
//
// React-free (silicaui-html types + the codec only), so the storefront's server
// loader and any future prerender share ONE need-collection pass — no drift.

import { decodeBindingRef } from './binding-ref';
import type { SilicaNode } from './site-sync';

/** Which PRODUCT sources a tree binds — the configurable Products block picks one
 *  per instance, so a page can bind several at once (a "Featured" rail + a "New"
 *  rail + a category grid). Each maps to a distinct storefront fetch; `catalog` is
 *  the whole-catalog grid, `categories` holds the collection ids of every
 *  `commerce.category.<id>` bound. */
export interface SilicaProductSources {
  catalog: boolean; // commerce.product — the whole catalog
  featured: boolean; // commerce.featured — merchant-flagged, bounded
  fresh: boolean; // commerce.new — newest first, bounded
  related: boolean; // commerce.related — same collection as the in-scope product
  categories: string[]; // ids from commerce.category.<id>
}

/** The platform sources a silica tree needs the storefront to fetch. */
export interface SilicaSourceNeeds {
  /** True when ANY product source is bound — the coarse "fetch commerce" gate kept
   *  for back-compat; `products` says exactly which. */
  commerce: boolean;
  products: SilicaProductSources;
  cmsTypes: string[];
  productPins: string[];
  cmsPins: string[];
}

/** A silica node's data marker, if any — `{ kind, ref }` set by `bind`/`repeat`/
 *  `action`. Typed loosely here because the marker rides an opaque `data` field. */
interface DataMarker {
  kind?: string;
  ref?: string;
}

function markerOf(node: SilicaNode): DataMarker | undefined {
  const data = (node as { data?: unknown }).data;
  // DataMarker is all-optional, so a narrowed `object` already satisfies it.
  if (data && typeof data === 'object') return data;
  return undefined;
}

function childrenOf(node: SilicaNode): SilicaNode[] {
  const kids = (node as { children?: unknown }).children;
  return Array.isArray(kids) ? (kids as SilicaNode[]) : [];
}

/** Classify one decoded ref into the accumulating need set. A scope-relative value
 *  ref (`title`, `price`) names no source and is ignored; only refs that name a
 *  platform source or pin a record contribute. */
function recordNeed(ref: string, needs: SilicaSourceNeeds): void {
  const binding = decodeBindingRef(ref);

  // Entity pin (docs/98 Pillar 7) — a specific record hydrated under __pins.
  if (binding.entity && binding.id) {
    if (binding.entity === 'commerce') needs.productPins.push(binding.id);
    else if (binding.entity === 'cms') needs.cmsPins.push(binding.id);
    return;
  }

  // A collection source (`{ from }`), or a bare/scoped path naming a top-level
  // source. The source's `from` names the same `commerce.product` / `cms.<type>`
  // key a bare path would.
  const path = binding.source?.from ?? binding.path;
  if (!path) return;
  if (path.startsWith('item') || path === 'index') return; // scope-relative — no source
  const root = path.split('[')[0] ?? path; // strip a trailing [n]
  // The configurable Products block binds ONE of these product sources per instance
  // (docs/118). Each is a distinct storefront fetch; `commerce` stays the coarse gate.
  if (root === 'commerce.product' || root.startsWith('commerce.product.')) {
    needs.commerce = true;
    needs.products.catalog = true;
  } else if (root === 'commerce.featured') {
    needs.commerce = true;
    needs.products.featured = true;
  } else if (root === 'commerce.new') {
    needs.commerce = true;
    needs.products.fresh = true;
  } else if (root === 'commerce.related') {
    needs.commerce = true;
    needs.products.related = true;
  } else if (root === 'commerce.category' || root.startsWith('commerce.category.')) {
    // `commerce.category.<collectionId>` — the id names WHICH collection's products.
    needs.commerce = true;
    const id = root.slice('commerce.category.'.length);
    if (id) needs.products.categories.push(id);
  } else if (root.startsWith('cms.')) {
    const type = root.slice('cms.'.length).split('.')[0];
    if (type) needs.cmsTypes.push(type);
  }
}

/** Walk a silica tree and collect every platform source it binds. The storefront
 *  loader fetches exactly these, shaping them into the resolver `root` the shared
 *  `createSilicaResolver` reads. */
export function collectSilicaSourceNeeds(tree: SilicaNode): SilicaSourceNeeds {
  const needs: SilicaSourceNeeds = {
    commerce: false,
    products: { catalog: false, featured: false, fresh: false, related: false, categories: [] },
    cmsTypes: [],
    productPins: [],
    cmsPins: [],
  };
  const seenCms = new Set<string>();
  const seenProductPins = new Set<string>();
  const seenCmsPins = new Set<string>();

  const visit = (node: SilicaNode): void => {
    const marker = markerOf(node);
    if (marker && (marker.kind === 'value' || marker.kind === 'collection') && marker.ref) {
      recordNeed(marker.ref, needs);
    }
    for (const child of childrenOf(node)) visit(child);
  };
  visit(tree);

  // De-dupe (a grid + a rail both name commerce.product; a type may repeat).
  needs.cmsTypes = needs.cmsTypes.filter((t) => !seenCms.has(t) && seenCms.add(t));
  needs.productPins = needs.productPins.filter(
    (id) => !seenProductPins.has(id) && seenProductPins.add(id)
  );
  needs.cmsPins = needs.cmsPins.filter((id) => !seenCmsPins.has(id) && seenCmsPins.add(id));
  const seenCat = new Set<string>();
  needs.products.categories = needs.products.categories.filter(
    (id) => !seenCat.has(id) && seenCat.add(id)
  );
  return needs;
}
