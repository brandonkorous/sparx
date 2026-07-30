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
  /**
   * How many records each bound source must actually LOAD, keyed by source root.
   *
   *   a number → no consumer on this page needs more than this many;
   *   `null`   → at least one consumer is UNBOUNDED, so fetch the normal amount.
   *
   * This is what makes an author's `limit` (silicaui 0.38) worth setting. The engine
   * already trims the repeat at render, so without this a landing page showing 4
   * products still fetched 24 and threw 20 away — correct on screen, wasteful in the
   * query, and exactly the thing the tenant asked not to happen.
   *
   * The MAXIMUM wins when several repeats share a source, because one fetch feeds them
   * all: a page with a 4-up strip and a 12-up carousel over `commerce.featured` must
   * load 12, and the engine then trims each repeat to its own number. Taking the
   * minimum would silently starve the larger block.
   *
   * `null` is deliberately sticky — once anything unbounded binds a source, no later
   * limit can re-bound it. A value ref that reads the array whole (`commerce.product`
   * bound to a count, say) has no limit to declare and so reads as unbounded, which is
   * the safe direction: over-fetching renders correctly, under-fetching loses records.
   */
  limits: Record<string, number | null>;
}

/** A silica node's data marker, if any — `{ kind, ref }` set by `bind`/`repeat`/
 *  `action`. Typed loosely here because the marker rides an opaque `data` field. */
interface DataMarker {
  kind?: string;
  ref?: string;
  /** silicaui 0.38: how many items this repeat renders. Only meaningful on a
   *  `collection` marker; the engine applies it, we use it to fetch no more. */
  limit?: number;
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
/**
 * Fold one repeat's `limit` into the running per-source maximum.
 *
 * A non-integer, a zero or a negative is treated as NO limit, matching what the engine
 * itself does with the field (`applyCollectionLimit` ignores anything that isn't a
 * positive integer). Agreeing with the engine matters more than validating here: if the
 * two disagreed we would fetch to a number the renderer refuses to honour, and the block
 * would come up short with nothing in the tree to explain why.
 */
function noteLimit(needs: SilicaSourceNeeds, key: string, limit: number | undefined): void {
  const prev = needs.limits[key];
  if (prev === null) return; // already unbounded — sticky, nothing can re-bound it
  if (limit == null || !Number.isInteger(limit) || limit < 1) {
    needs.limits[key] = null;
    return;
  }
  needs.limits[key] = prev === undefined ? limit : Math.max(prev, limit);
}

function recordNeed(ref: string, needs: SilicaSourceNeeds, limit?: number): void {
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
    noteLimit(needs, 'commerce.product', limit);
  } else if (root === 'commerce.featured') {
    needs.commerce = true;
    needs.products.featured = true;
    noteLimit(needs, root, limit);
  } else if (root === 'commerce.new') {
    needs.commerce = true;
    needs.products.fresh = true;
    noteLimit(needs, root, limit);
  } else if (root === 'commerce.related') {
    needs.commerce = true;
    needs.products.related = true;
    noteLimit(needs, root, limit);
  } else if (root === 'commerce.category' || root.startsWith('commerce.category.')) {
    // `commerce.category.<collectionId>` — the id names WHICH collection's products.
    needs.commerce = true;
    const id = root.slice('commerce.category.'.length);
    if (id) {
      needs.products.categories.push(id);
      noteLimit(needs, root, limit);
    }
  } else if (root.startsWith('cms.')) {
    const type = root.slice('cms.'.length).split('.')[0];
    if (type) {
      needs.cmsTypes.push(type);
      noteLimit(needs, `cms.${type}`, limit);
    }
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
    limits: {},
  };
  const seenCms = new Set<string>();
  const seenProductPins = new Set<string>();
  const seenCmsPins = new Set<string>();

  const visit = (node: SilicaNode): void => {
    const marker = markerOf(node);
    if (marker && (marker.kind === 'value' || marker.kind === 'collection') && marker.ref) {
      // Only a `collection` marker can carry a limit. A `value` ref passes `undefined`,
      // which `noteLimit` reads as unbounded — right, because a value bind against a
      // source reads it whole and no repeat is trimming anything on its behalf.
      recordNeed(marker.ref, needs, marker.kind === 'collection' ? marker.limit : undefined);
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
