// Real-data loader for the silica render path (docs/118 Stage 6). The silica
// analogue of `lib/builder-data.ts`: it walks a PUBLISHED silica tree for the
// platform sources it binds (`collectSilicaSourceNeeds`), fetches the real records
// through the storefront's existing public fetchers, shapes them into the resolver
// `root`, and returns the synchronous `ResolveHost` the render primitive
// (`renderSilicaBody`) resolves bindings against.
//
// The record SHAPES follow the silica commerce composites' scope-relative refs
// (@sparx/silica-catalog `commerce.ts`): a product card binds `image` / `title` /
// `price` / `compareAtPrice` / `description`, so a product record carries exactly
// those keys. `price` binds the raw number; the host `format` renders currency —
// formatting is host territory, never baked into the tree.

import {
  PINS_ROOT,
  collectSilicaSourceNeeds,
  createSilicaResolver,
  defaultSilicaFormat,
  entityPinKey,
  type DataSources,
  type NodeBinding,
  type SilicaNode,
  type SilicaResolver,
} from '@sparx/builder-schemas';

import { listProducts, type PublicProductListItem } from './commerce';
import { getEntryById, publicGet, type ApiEntry } from './content';
import { mediaUrl } from './media';

/** A product in the shape the silica commerce composites bind (scope-relative
 *  refs). `image` is a `{ url, alt }` object; the host `format` unwraps it to the
 *  `<img src>` string. `price`/`compareAtPrice` are raw dollars — the host formats
 *  currency. */
function toSilicaProduct(p: PublicProductListItem, tenantSlug: string): Record<string, unknown> {
  const url = mediaUrl(p.primaryImageId, tenantSlug);
  return {
    id: p.id,
    handle: p.handle,
    title: p.title,
    price: p.priceMinCents != null ? p.priceMinCents / 100 : null,
    compareAtPrice: p.compareAtCents != null ? p.compareAtCents / 100 : null,
    description: p.description ?? '',
    image: url ? { url, alt: p.title } : null,
  };
}

// A CMS entry's `body` IS its field map; resolve the conventional `featuredImage`
// media-id to a `{ url, alt }` so an image ref renders (mirrors builder-data's
// resolveEntryBodyAssets, but as the silica scope-relative record).
function toSilicaEntry(
  body: Record<string, unknown> | null | undefined,
  tenantSlug: string
): Record<string, unknown> {
  const b = { ...(body ?? {}) };
  if (typeof b.featuredImage === 'string') {
    const url = mediaUrl(b.featuredImage, tenantSlug);
    b.featuredImage = url ? { url, alt: typeof b.title === 'string' ? b.title : '' } : null;
  }
  return b;
}

async function listEntries(tenantSlug: string, type: string): Promise<ApiEntry[]> {
  return publicGet<ApiEntry[]>(
    '/v1/public/content/entries',
    { tenant: tenantSlug, type, limit: 24 },
    { tag: `entries:${tenantSlug}:${type}` }
  );
}

/** Assign `value` at a dotted key, creating nested objects (`cms.blog_post`
 *  → root.cms.blog_post). Mirrors builder-data's setAtPath. */
function setAtPath(root: DataSources, dottedKey: string, value: unknown): void {
  const segs = dottedKey.split('.');
  let cursor = root as Record<string, unknown>;
  for (let i = 0; i < segs.length - 1; i += 1) {
    const seg = segs[i] ?? '';
    const next = cursor[seg];
    if (typeof next !== 'object' || next === null) cursor[seg] = {};
    cursor = cursor[seg] as Record<string, unknown>;
  }
  cursor[segs[segs.length - 1] ?? ''] = value;
}

/** A currency-aware host formatter: unwrap image objects + render `price` fields as
 *  the site's currency (falling back to the shared `$` formatter's number path). */
function makeFormat(currency: string, locale: string) {
  const fmt = new Intl.NumberFormat(locale, { style: 'currency', currency });
  return (value: unknown, binding: NodeBinding): unknown => {
    if (typeof value === 'number' && /price/i.test(binding.path ?? '')) return fmt.format(value);
    return defaultSilicaFormat(value, binding);
  };
}

/** The `site.*` chrome root — brand identity + social links the shared frame
 *  (navbar/footer) binds. The silica analogue of `lib/builder-data.ts`'s
 *  `loadSiteData`: platform-sourced data the builder keeps no parallel copy of, so
 *  it's always supplied (not tree-derived). */
export interface SilicaSiteData {
  name: string;
  logoUrl?: string | null;
  tagline?: string | null;
  socials?: { platform: string; url: string }[];
}

function siteRoot(site: SilicaSiteData): DataSources {
  const root: DataSources = {};
  setAtPath(root, 'site.identity', {
    name: site.name,
    tagline: site.tagline ?? '',
    logo: site.logoUrl ? { url: site.logoUrl, alt: site.name } : null,
  });
  setAtPath(
    root,
    'site.social',
    (site.socials ?? []).filter((s) => s?.url && s.url.trim().length > 0)
  );
  return root;
}

/** Fetch every source the silica tree binds and return the synchronous
 *  `ResolveHost` the render primitive resolves against. A failed fetch degrades
 *  that source to empty rather than failing the page. `record` (a collection
 *  template's in-scope record) injects a single object at its key so `<key>.*`
 *  refs resolve; `site` supplies the chrome's brand identity + socials (always,
 *  since the frame binds `site.*` regardless of what the tree walk detects);
 *  `currency`/`locale` drive price formatting. */
export async function buildSilicaHost(
  tenantSlug: string,
  tree: SilicaNode,
  opts: {
    record?: { key: string; value: unknown };
    site?: SilicaSiteData;
    currency?: string;
    locale?: string;
  } = {}
): Promise<SilicaResolver> {
  const { currency = 'USD', locale = 'en-US', record, site } = opts;
  const needs = collectSilicaSourceNeeds(tree);
  const root: DataSources = site ? siteRoot(site) : {};
  const tasks: Promise<void>[] = [];

  if (needs.commerce || needs.productPins.length > 0) {
    tasks.push(
      listProducts(tenantSlug, { perPage: 24 })
        .then(({ items }) => {
          const products = items.map((p) => toSilicaProduct(p, tenantSlug));
          if (needs.commerce) setAtPath(root, 'commerce.product', products);
          // Product pins (docs/98 Pillar 7) → __pins['commerce:<id>'], indexed from
          // the same list so a pinned card resolves without a second fetch.
          if (needs.productPins.length > 0) {
            const byId = new Map(products.map((p) => [p.id as string, p]));
            const pins = (root[PINS_ROOT] as Record<string, unknown> | undefined) ?? {};
            for (const id of needs.productPins) {
              const hit = byId.get(id);
              if (hit) pins[entityPinKey('commerce', id)] = hit;
            }
            root[PINS_ROOT] = pins;
          }
        })
        .catch(() => setAtPath(root, 'commerce.product', []))
    );
  }

  for (const type of needs.cmsTypes) {
    tasks.push(
      listEntries(tenantSlug, type)
        .then((entries) =>
          setAtPath(
            root,
            `cms.${type}`,
            entries.map((e) => toSilicaEntry(e.body, tenantSlug))
          )
        )
        .catch(() => setAtPath(root, `cms.${type}`, []))
    );
  }

  for (const id of needs.cmsPins) {
    tasks.push(
      getEntryById(tenantSlug, id)
        .then((entry) => {
          if (!entry) return;
          const pins = (root[PINS_ROOT] as Record<string, unknown> | undefined) ?? {};
          pins[entityPinKey('cms', id)] = toSilicaEntry(entry.body, tenantSlug);
          root[PINS_ROOT] = pins;
        })
        .catch(() => undefined)
    );
  }

  await Promise.all(tasks);

  // The in-scope record for a collection template (e.g. root.product = the one
  // product). Its key never collides with the array source (`product` vs
  // `commerce.product`).
  if (record) setAtPath(root, record.key, record.value);

  return createSilicaResolver({ root, format: makeFormat(currency, locale) });
}
