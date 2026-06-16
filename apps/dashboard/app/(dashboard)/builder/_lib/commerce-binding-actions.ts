'use server';

// Commerce reads for the Builder's Data panel + canvas preview (docs/98 Pillar 7).
// The inspector pickers (pin a product / repeat a collection / a category) and the
// canvas's real-product overlay both call these. They read the PUBLIC commerce
// surface scoped by the tenant slug — the same endpoints + shapes the live
// storefront uses (apps/site/lib/commerce) — so the canvas resolves the exact same
// products the published site will, with no parallel mapping to drift.

import { api } from '@/lib/api-rest-client';
import {
  PINS_ROOT,
  SOURCES_ROOT,
  collectionSourceKey,
  entityPinKey,
  type BindingRefs,
  type DataSources,
} from '@sparx/builder-schemas';
import type { BuilderProduct } from '@sparx/builder-render';

import { getTenant, publicMediaUrl } from '../_brand/lib/api';

// ── Public read shapes (mirror apps/site/lib/commerce) ────────────────────────

interface PublicListItem {
  id: string;
  title: string;
  handle: string;
  primaryImageId: string | null;
  priceMinCents: number | null;
}
interface PublicNamed {
  id: string;
  name: string;
}
interface PublicOptionValue {
  id: string;
  value: string;
  swatchHex: string | null;
}
interface PublicOption {
  id: string;
  name: string;
  displayType: string;
  values: PublicOptionValue[];
}
interface PublicVariant {
  id: string;
  sku: string;
  title: string | null;
  priceCents: number;
  compareAtPriceCents: number | null;
  isDefault: boolean;
  inStock: boolean;
  available: number;
  optionValueIds: string[];
}
interface PublicFull {
  id: string;
  title: string;
  handle: string;
  description: string | null;
  priceMinCents: number | null;
  priceMaxCents: number | null;
  compareAtCents: number | null;
  options: PublicOption[];
  variants: PublicVariant[];
  images: { mediaAssetId: string; alt: string | null }[];
}

// ── Picker option shapes (what the inspector renders) ─────────────────────────

export interface ProductPick {
  id: string;
  title: string;
  thumbUrl: string | null;
}
export interface NamedPick {
  id: string;
  name: string;
}

async function tenantSlug(): Promise<string> {
  return (await getTenant()).slug;
}

/** Active products matching `q` (title/description) for the "pin a product" picker.
 *  Degrades to [] so the picker stays usable when commerce is empty/off. */
export async function searchProductsForBuilder(q?: string): Promise<ProductPick[]> {
  try {
    const slug = await tenantSlug();
    const params = new URLSearchParams({ tenant: slug, perPage: '24' });
    if (q?.trim()) params.set('q', q.trim());
    const { data } = await api.getPaged<PublicListItem[]>(
      `/v1/public/commerce/products?${params.toString()}`
    );
    return data.map((p) => ({
      id: p.id,
      title: p.title,
      thumbUrl: publicMediaUrl(p.primaryImageId, slug),
    }));
  } catch {
    return [];
  }
}

/** The tenant's collections for the "repeat from a collection" picker. */
export async function listCollectionsForBuilder(): Promise<NamedPick[]> {
  try {
    const slug = await tenantSlug();
    const data = await api.get<PublicNamed[]>(
      `/v1/public/commerce/collections?tenant=${encodeURIComponent(slug)}`
    );
    return data.map((c) => ({ id: c.id, name: c.name }));
  } catch {
    return [];
  }
}

/** The tenant's categories for the "repeat from a category" picker. */
export async function listCategoriesForBuilder(): Promise<NamedPick[]> {
  try {
    const slug = await tenantSlug();
    const data = await api.get<PublicNamed[]>(
      `/v1/public/commerce/categories?tenant=${encodeURIComponent(slug)}`
    );
    return data.map((c) => ({ id: c.id, name: c.name }));
  } catch {
    return [];
  }
}

// ── Full-product hydration (the canvas overlay) ───────────────────────────────

function toBuilderProduct(p: PublicFull, slug: string, currency: string): BuilderProduct {
  return {
    id: p.id,
    handle: p.handle,
    title: p.title,
    price: p.priceMinCents != null ? p.priceMinCents / 100 : null,
    compareAtPrice: p.compareAtCents != null ? p.compareAtCents / 100 : null,
    description: p.description ?? '',
    images: p.images
      .map((img) => ({
        url: publicMediaUrl(img.mediaAssetId, slug) ?? '',
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
  };
}

async function fetchFull(
  slug: string,
  opts: { ids?: string[]; collection?: string; category?: string; limit?: number }
): Promise<PublicFull[]> {
  const params = new URLSearchParams({ tenant: slug });
  if (opts.ids && opts.ids.length > 0) params.set('ids', opts.ids.join(','));
  if (opts.collection) params.set('collection', opts.collection);
  if (opts.category) params.set('category', opts.category);
  if (opts.limit) params.set('limit', String(opts.limit));
  return api.get<PublicFull[]>(`/v1/public/commerce/products/full?${params.toString()}`);
}

/** Hydrate the products a tree's pins + collection sources reference, shaped into
 *  the reserved `__pins` / `__sources` roots the shared resolver reads — so the
 *  editor canvas previews the REAL pinned/looped products (docs/98 Pillar 7), the
 *  same ones the published site resolves. `refs` come from `collectBindingRefs`
 *  (computed client-side, so only the small id list crosses the RPC boundary).
 *  Degrades to {} on any failure (the canvas falls back to the sample product). */
export async function hydrateCommerceForBuilder(
  refs: BindingRefs,
  currency = 'USD'
): Promise<DataSources> {
  try {
    const productPinIds = refs.entities.filter((e) => e.entity === 'product').map((e) => e.id);
    if (productPinIds.length === 0 && refs.sources.length === 0) return {};
    const slug = await tenantSlug();
    const pins: Record<string, unknown> = {};
    const sources: Record<string, unknown> = {};
    const tasks: Promise<void>[] = [];

    if (productPinIds.length > 0) {
      tasks.push(
        fetchFull(slug, { ids: productPinIds })
          .then((products) => {
            for (const p of products) {
              pins[entityPinKey('product', p.id)] = toBuilderProduct(p, slug, currency);
            }
          })
          .catch(() => undefined)
      );
    }
    for (const s of refs.sources) {
      tasks.push(
        fetchFull(slug, {
          collection: s.from === 'collection' ? s.id : undefined,
          category: s.from === 'category' ? s.id : undefined,
          limit: s.limit ?? 24,
        })
          .then((products) => {
            sources[collectionSourceKey(s)] = products.map((p) =>
              toBuilderProduct(p, slug, currency)
            );
          })
          .catch(() => undefined)
      );
    }
    await Promise.all(tasks);
    const root: DataSources = {};
    if (Object.keys(pins).length > 0) root[PINS_ROOT] = pins;
    if (Object.keys(sources).length > 0) root[SOURCES_ROOT] = sources;
    return root;
  } catch {
    return {};
  }
}
