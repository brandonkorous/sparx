// Commerce data for the Builder render path (docs/98 Pillar 7 — the store-builder
// fix). A page that PINS a product (entity binding) or REPEATS a collection
// (collection source) needs the real, FULL products (options + variants + images)
// hydrated by id at render time, parked under the reserved `__pins` / `__sources`
// roots the shared `resolveBinding` reads. This is the storefront analogue of the
// editor's commerce preview; both shape the same roots so canvas == live.
//
// Split out of builder-data.ts so that file stays focused on CMS + site chrome;
// it owns `productToBuilderRecord` (the full PublicProduct → BuilderProduct map),
// which builder-data re-exports for the PDP collection-template path.

import {
  PINS_ROOT,
  SOURCES_ROOT,
  collectBindingRefs,
  collectionSourceKey,
  entityPinKey,
  type BuilderNode,
  type DataSources,
} from '@wizeworks/builder-schemas';
import type { BuilderProduct } from '@wizeworks/builder-render';

import {
  getCategoryRecordsFull,
  getCollectionRecordsFull,
  getProductsFull,
  type PublicEntityRecord,
  type PublicProduct,
} from './commerce';
import { mediaUrl } from './media';

/** Map a full PublicProduct into the BuilderProduct a pinned/looped product binds:
 *  the `item.*` leaf fields (id/handle/title/price/description/images/sku) PLUS
 *  options + variants (cents preserved) so the Tier-2 buy-box resolves a selected
 *  variant. One object serves both roles — field reads AND the ProductForm. */
export function productToBuilderRecord(
  p: PublicProduct,
  tenantSlug: string,
  currency: string
): BuilderProduct {
  return {
    id: p.id,
    handle: p.handle,
    title: p.title,
    price: p.priceMinCents != null ? p.priceMinCents / 100 : null,
    compareAtPrice: p.compareAtCents != null ? p.compareAtCents / 100 : null,
    description: p.description ?? '',
    images: p.images
      .map((img) => ({
        url: mediaUrl(img.mediaAssetId, tenantSlug) ?? '',
        alt: img.alt ?? p.title,
      }))
      .filter((i) => i.url !== ''),
    sku: p.variants.find((v) => v.isDefault)?.sku ?? p.variants[0]?.sku ?? '',
    currency,
    priceMinCents: p.priceMinCents,
    priceMaxCents: p.priceMaxCents,
    options: p.options.map((o) => ({
      id: o.id,
      name: o.name,
      displayType: o.displayType,
      values: o.values.map((v) => ({ id: v.id, value: v.value, swatchHex: v.swatchHex })),
    })),
    variants: p.variants.map((v) => ({
      id: v.id,
      sku: v.sku,
      title: v.title,
      priceCents: v.priceCents,
      compareAtPriceCents: v.compareAtPriceCents,
      isDefault: v.isDefault,
      inStock: v.inStock,
      available: v.available,
      optionValueIds: v.optionValueIds,
    })),
    // Typed attributes (docs/143) — parity with the silica record so the legacy
    // builder-render canvas resolves the same `attributes.<key>` / attributeSections
    // refs a pinned/looped product page binds.
    attributes: p.attributes ?? {},
    attributeSections: p.attributeSections ?? [],
  };
}

/** Map a collection / category OWN-record into the `item.*` fields a record-display
 *  pin exposes (docs/98 Pillar 7): name / handle / description plus a resolved hero
 *  `image` ({ url, alt } | null). Distinct from the product map — a banner pinned to
 *  a category reads ITS fields, not a product's. */
function entityRecordToBuilder(
  rec: PublicEntityRecord,
  tenantSlug: string
): Record<string, unknown> {
  const url = rec.heroMediaId ? mediaUrl(rec.heroMediaId, tenantSlug) : null;
  return {
    id: rec.id,
    name: rec.name,
    handle: rec.handle,
    description: rec.description ?? '',
    image: url ? { url, alt: rec.name } : null,
  };
}

/** Resolve every commerce ref a tree binds (docs/98 Pillar 7): the products it pins
 *  by id (`__pins['product:<id>']`), the collection/category RECORDS it pins for
 *  record-display (`__pins['collection:<id>']` / `__pins['category:<id>']`), and the
 *  product arrays its collection sources load (`__sources[<sourceKey>]`). Each fetch
 *  resolves independently; a failure degrades to an absent record rather than failing
 *  the page. Returns a partial `root` the caller merges over its other data. */
export async function loadCommerceData(
  tenantSlug: string,
  tree: BuilderNode,
  currency: string
): Promise<DataSources> {
  const refs = collectBindingRefs(tree);
  const productPinIds = refs.entities.filter((e) => e.entity === 'product').map((e) => e.id);
  const collectionPinIds = refs.entities.filter((e) => e.entity === 'collection').map((e) => e.id);
  const categoryPinIds = refs.entities.filter((e) => e.entity === 'category').map((e) => e.id);
  if (
    productPinIds.length === 0 &&
    collectionPinIds.length === 0 &&
    categoryPinIds.length === 0 &&
    refs.sources.length === 0
  ) {
    return {};
  }

  const pins: Record<string, unknown> = {};
  const sources: Record<string, unknown> = {};
  const tasks: Promise<void>[] = [];

  // Entity product pins — one batched fetch (order doesn't matter; keyed by id).
  if (productPinIds.length > 0) {
    tasks.push(
      getProductsFull(tenantSlug, { ids: productPinIds }).then((products) => {
        for (const p of products) {
          pins[entityPinKey('product', p.id)] = productToBuilderRecord(p, tenantSlug, currency);
        }
      })
    );
  }

  // Collection / category RECORD pins (record-display) — one batched fetch each.
  if (collectionPinIds.length > 0) {
    tasks.push(
      getCollectionRecordsFull(tenantSlug, collectionPinIds).then((recs) => {
        for (const r of recs) {
          pins[entityPinKey('collection', r.id)] = entityRecordToBuilder(r, tenantSlug);
        }
      })
    );
  }
  if (categoryPinIds.length > 0) {
    tasks.push(
      getCategoryRecordsFull(tenantSlug, categoryPinIds).then((recs) => {
        for (const r of recs) {
          pins[entityPinKey('category', r.id)] = entityRecordToBuilder(r, tenantSlug);
        }
      })
    );
  }

  // Collection sources — one fetch each (collection id / category id / whole catalog).
  for (const s of refs.sources) {
    tasks.push(
      getProductsFull(tenantSlug, {
        collection: s.from === 'collection' ? s.id : undefined,
        category: s.from === 'category' ? s.id : undefined,
        limit: s.limit ?? 24,
        // The author's order and tag filter (slice 23), sent to the API rather than
        // applied here: sorting an already-capped page of 24 reorders those 24 instead
        // of choosing the top 24, which is a different list wearing the right label.
        ...(s.sort ? { sort: s.sort } : {}),
        ...(s.tag ? { tag: s.tag } : {}),
      }).then((products) => {
        sources[collectionSourceKey(s)] = products.map((p) =>
          productToBuilderRecord(p, tenantSlug, currency)
        );
      })
    );
  }

  await Promise.all(tasks);
  const root: DataSources = {};
  if (Object.keys(pins).length > 0) root[PINS_ROOT] = pins;
  if (Object.keys(sources).length > 0) root[SOURCES_ROOT] = sources;
  return root;
}
