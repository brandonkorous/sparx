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

import {
  listCollectionProducts,
  listProducts,
  type PublicCollection,
  type PublicProduct,
  type PublicProductListItem,
} from './commerce';
import { getEntriesByIds, publicGet, type ApiEntry } from './content';
import { mediaUrl } from './media';

/** How many products the `commerce.featured` rail shows at most — a curated
 *  handful, never the whole catalog (the whole-catalog grid binds `commerce.product`). */
const FEATURED_LIMIT = 8;

/**
 * How many records a bound COLLECTION grid renders (docs/127 §8).
 *
 * This was a bare `24` inlined at each fetch. At the catalog sizes this platform
 * targets that is not a page size, it is silent data loss: a tenant with 137 products
 * saw 24 of them, the storefront showed no pagination, and nothing anywhere said the
 * other 113 existed — not to the shopper, not to the author, not to a log.
 *
 * Named here so there is ONE number, and paired with the `*Total` / `*HasMore` roots
 * below so the truncation is at least VISIBLE while real pagination is designed.
 */
const COLLECTION_PAGE_SIZE = 24;

/** Publish "how many there really are" alongside a truncated list, so a template can
 *  bind `commerce.productTotal` / `commerce.productHasMore` ("Showing 24 of 137",
 *  "View all") instead of the list silently ending. Also logs the truncation: an
 *  author who never binds those still leaves a trail worth finding. */
function setListMeta(
  root: DataSources,
  key: string,
  shown: number,
  total: number,
  label: string
): void {
  setAtPath(root, `${key}Total`, total);
  setAtPath(root, `${key}HasMore`, total > shown);
  if (total > shown) {
    console.warn(
      `[silica-data] ${label}: showing ${shown} of ${total} — the rest are not rendered ` +
        `and the storefront offers no pagination yet (docs/127 §8).`
    );
  }
}

/** A product in the shape the silica commerce composites bind (scope-relative
 *  refs). `image` is a `{ url, alt }` object; the host `format` unwraps it to the
 *  `<img src>` string. `price`/`compareAtPrice` are raw dollars — the host formats
 *  currency. */
function toSilicaProduct(p: PublicProductListItem, tenantSlug: string): Record<string, unknown> {
  const url = mediaUrl(p.primaryImageId, tenantSlug);
  // A signed-in B2B viewer's price wins over retail — reusing the existing
  // compareAtPrice strikethrough mechanic (a sale-price pattern) to show it: `price`
  // becomes their price, `compareAtPrice` becomes the retail price it replaces. An
  // anonymous/retail viewer's `yourPriceCents` is always null, so this is a no-op for
  // the common case.
  const price = p.yourPriceCents ?? p.priceMinCents;
  const compareAtPrice = p.yourPriceCents != null ? p.priceMinCents : p.compareAtCents;
  return {
    id: p.id,
    handle: p.handle,
    title: p.title,
    price: price != null ? price / 100 : null,
    compareAtPrice: compareAtPrice != null ? compareAtPrice / 100 : null,
    description: p.description ?? '',
    image: url ? { url, alt: p.title } : null,
    // Bound by the buy box's hidden field, so its <form> submit carries a real
    // cart line. Empty string (not null) when the product has no live variant:
    // the hidden input renders `value=""`, the field is `required`, and the
    // browser blocks the submit before silica's form behavior dispatches.
    variantId: p.defaultVariantId ?? '',
    // The card's destination. `bindAttr` lifts this into the `<a href>`; an empty
    // value renders an un-clickable card rather than a link to nowhere.
    url: p.handle ? `/products/${p.handle}` : '',
  };
}

/** The single in-scope `product` record a silica `commerce.product` collection
 *  template (the PDP) binds — the full-product analogue of `toSilicaProduct` (which
 *  shapes a list card). The buy box resolves `title` / `price` / `compareAtPrice` /
 *  `description` / `image` for THIS product and rides `variantId` (the default
 *  variant) in its add-to-cart form's hidden field. `image` is `{ url, alt }`; the
 *  host `format` unwraps it to `<img src>`. Exported for the PDP route. */
export function productToSilicaRecord(
  p: PublicProduct,
  tenantSlug: string
): Record<string, unknown> {
  const primary = p.images[0];
  const url = primary ? mediaUrl(primary.mediaAssetId, tenantSlug) : null;
  const defaultVariant = p.variants.find((v) => v.isDefault) ?? p.variants[0];
  // The default variant's viewer-resolved price wins over retail (same
  // strikethrough reuse as toSilicaProduct above) — the buy box only ever shows
  // the default variant's price, so it reads that variant's yourPriceCents rather
  // than the list-level one (which is contract-price-only, for card fidelity).
  const variantYourPrice = defaultVariant?.yourPriceCents ?? null;
  const price = variantYourPrice ?? p.priceMinCents;
  const compareAtPrice = variantYourPrice != null ? p.priceMinCents : p.compareAtCents;
  return {
    id: p.id,
    handle: p.handle,
    title: p.title,
    price: price != null ? price / 100 : null,
    compareAtPrice: compareAtPrice != null ? compareAtPrice / 100 : null,
    description: p.description ?? '',
    image: url ? { url, alt: primary?.alt ?? p.title } : null,
    // The add-to-cart form's hidden field; empty string (not null) when the product
    // has no live variant, so `onAction`'s empty-variant guard blocks the submit.
    variantId: defaultVariant?.id ?? '',
    url: p.handle ? `/products/${p.handle}` : '',
  };
}

/** The single in-scope `collection` record a silica `commerce.collection` template
 *  binds — the collection's own fields PLUS its products pre-shaped onto a `products`
 *  list, so the detail template's grid repeats a scope-relative `products` ref (only
 *  THIS collection's items, never the whole catalog). Each product is the list-card
 *  shape (`toSilicaProduct`) so a card resolves image/title/price and links to its
 *  PDP. Exported for the collections route. */
export function collectionToSilicaRecord(
  collection: PublicCollection,
  products: PublicProductListItem[],
  tenantSlug: string
): Record<string, unknown> {
  const heroUrl = collection.heroMediaId ? mediaUrl(collection.heroMediaId, tenantSlug) : null;
  return {
    name: collection.name,
    description: collection.description ?? '',
    image: heroUrl ? { url: heroUrl, alt: collection.name } : null,
    products: products.map((p) => toSilicaProduct(p, tenantSlug)),
  };
}

// The route a CMS collection card links to. Only `blog_post` has a per-record
// detail route (`apps/site/app/blog/[slug]`); other content types render inline and
// carry no destination, so their card `url` resolves to `''` and `bindAttr` leaves
// the anchor un-clickable rather than pointing it at a 404.
function entryUrl(type: string, slug: string | null | undefined): string {
  if (!slug) return '';
  return type === 'blog_post' ? `/blog/${slug}` : '';
}

// A CMS entry's `body` IS its field map; resolve the conventional `featuredImage`
// media-id to a `{ url, alt }` so an image ref renders (mirrors builder-data's
// resolveEntryBodyAssets, but as the silica scope-relative record). The entry-level
// `slug` and a computed `url` are merged IN so a repeat card can bind its `<a href>`
// to `cms.<type>.url` — without this the collection is `body`-only and every card in a
// journal index points at the same static href (the bug that made every post link to
// the index). Mirrors the commerce card's `url: /products/${handle}` projection.
function toSilicaEntry(
  entry: Pick<ApiEntry, 'body' | 'slug' | 'published_at'>,
  tenantSlug: string,
  type: string
): Record<string, unknown> {
  const b = { ...(entry.body ?? {}) };
  if (typeof b.featuredImage === 'string') {
    const url = mediaUrl(b.featuredImage, tenantSlug);
    b.featuredImage = url ? { url, alt: typeof b.title === 'string' ? b.title : '' } : null;
  }
  b.slug = entry.slug ?? '';
  b.url = entryUrl(type, entry.slug);
  // The publish date lives on the ROW, not in the body, so a card that wants to date
  // itself has nothing to bind without this. Pre-formatted for display: a binding
  // resolves to a string and there is no formatter in the tree to turn an ISO stamp
  // into something a reader wants to see.
  b.publishedAt = entry.published_at ?? '';
  b.publishedOn = entry.published_at ? formatEntryDate(entry.published_at) : '';
  return b;
}

/** `2026-07-18T…` → `18 July 2026`. Locale-fixed on purpose: the storefront renders
 *  on the server, so a locale-derived format would vary by deploy region rather than
 *  by reader. */
function formatEntryDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

// Fetches ONE MORE than it renders (docs/127 §8). The entries endpoint returns a bare
// array through `publicGet`, so there is no total to read — but asking for n+1 and
// seeing n+1 come back is a definitive "there are more", which is the fact the
// storefront actually needs. The extra row is sliced off before rendering.
async function listEntries(tenantSlug: string, type: string): Promise<ApiEntry[]> {
  return publicGet<ApiEntry[]>(
    '/v1/public/content/entries',
    { tenant: tenantSlug, type, limit: COLLECTION_PAGE_SIZE + 1 },
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
  /** The dark-background logo. The tenant sets it in Site settings alongside the
   *  light one; without it here, a dark-themed site has no way to bind it. */
  logoDarkUrl?: string | null;
  tagline?: string | null;
  socials?: { platform: string; url: string }[];
}

function siteRoot(site: SilicaSiteData): DataSources {
  const root: DataSources = {};
  setAtPath(root, 'site.identity', {
    name: site.name,
    // `null`, NOT '' — an empty string is a KNOWN-but-empty value, which the
    // resolver fills over the authored content (blanking the node). `null` on a
    // tenant with no tagline set reads as unset and leaves the authoring intact.
    tagline: site.tagline ?? null,
    logo: site.logoUrl ? { url: site.logoUrl, alt: site.name } : null,
    logoDark: site.logoDarkUrl ? { url: site.logoDarkUrl, alt: site.name } : null,
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

  // The Products block binds ONE product source per instance; the collector reports
  // which are on the page (docs/118). Each is its own fetch, run in parallel. The
  // in-scope PDP product is excluded from every BOUNDED rail (they're cross-sell).
  const p = needs.products;
  const currentProductId =
    record?.key === 'product' ? (record.value as { id?: string } | undefined)?.id : undefined;
  const notCurrent = (i: PublicProductListItem) => i.id !== currentProductId;
  /** Exclude the current product, cap to a handful, shape as cards — the bounded rail. */
  const bounded = (items: PublicProductListItem[]) =>
    items
      .filter(notCurrent)
      .slice(0, FEATURED_LIMIT)
      .map((i) => toSilicaProduct(i, tenantSlug));

  // Base catalog fetch (default sort) — the whole-catalog grid, the featured slice,
  // and product pins all read from ONE list.
  if (p.catalog || p.featured || needs.productPins.length > 0) {
    tasks.push(
      listProducts(tenantSlug, { perPage: COLLECTION_PAGE_SIZE })
        .then(({ items, total }) => {
          const products = items.map((i) => toSilicaProduct(i, tenantSlug));
          if (p.catalog) {
            setAtPath(root, 'commerce.product', products);
            setListMeta(root, 'commerce.product', products.length, total, 'product catalog');
          }
          if (p.featured) {
            // "Featured" = products the merchant tagged `featured` (a no-schema curation
            // signal on the existing `tags` field); newest-few fallback so the rail is
            // never an empty heading when nothing is tagged yet.
            const flagged = items.filter((i) =>
              i.tags?.some((t) => t.toLowerCase() === 'featured')
            );
            setAtPath(root, 'commerce.featured', bounded(flagged.length > 0 ? flagged : items));
          }
          if (needs.productPins.length > 0) {
            // Product pins (docs/98 Pillar 7) → __pins['commerce:<id>'], indexed from
            // the same list so a pinned card resolves without a second fetch.
            const byId = new Map(products.map((c) => [c.id as string, c]));
            const pins = (root[PINS_ROOT] as Record<string, unknown> | undefined) ?? {};
            for (const id of needs.productPins) {
              const hit = byId.get(id);
              if (hit) pins[entityPinKey('commerce', id)] = hit;
            }
            root[PINS_ROOT] = pins;
          }
        })
        .catch(() => {
          if (p.catalog) setAtPath(root, 'commerce.product', []);
          if (p.featured) setAtPath(root, 'commerce.featured', []);
        })
    );
  }

  // Newest — the "New" rail. Also the fallback source for the "Related" rail until the
  // public product API exposes a product's collection membership (see index-active-work).
  if (p.fresh || p.related) {
    tasks.push(
      listProducts(tenantSlug, { sort: 'newest', perPage: FEATURED_LIMIT + 1 })
        .then(({ items }) => {
          if (p.fresh) setAtPath(root, 'commerce.new', bounded(items));
          if (p.related) setAtPath(root, 'commerce.related', bounded(items));
        })
        .catch(() => {
          if (p.fresh) setAtPath(root, 'commerce.new', []);
          if (p.related) setAtPath(root, 'commerce.related', []);
        })
    );
  }

  // Category rails — one fetch per bound collection handle (`commerce.category.<handle>`).
  // A category grid shows the collection's full page (not the rail cap), current excluded.
  for (const handle of p.categories) {
    tasks.push(
      listCollectionProducts(tenantSlug, handle)
        .then(({ items }) =>
          setAtPath(
            root,
            `commerce.category.${handle}`,
            items.filter(notCurrent).map((i) => toSilicaProduct(i, tenantSlug))
          )
        )
        .catch(() => setAtPath(root, `commerce.category.${handle}`, []))
    );
  }

  for (const type of needs.cmsTypes) {
    tasks.push(
      listEntries(tenantSlug, type)
        .then((entries) => {
          const shown = entries.slice(0, COLLECTION_PAGE_SIZE);
          setAtPath(
            root,
            `cms.${type}`,
            shown.map((e) => toSilicaEntry(e, tenantSlug, type))
          );
          // n+1 came back → there is at least one more. No exact total available here,
          // so `*Total` is deliberately not set rather than guessed.
          const hasMore = entries.length > COLLECTION_PAGE_SIZE;
          setAtPath(root, `cms.${type}HasMore`, hasMore);
          if (hasMore) {
            console.warn(
              `[silica-data] cms.${type}: showing ${shown.length} entries, more exist — ` +
                `the storefront offers no pagination yet (docs/127 §8).`
            );
          }
        })
        .catch(() => setAtPath(root, `cms.${type}`, []))
    );
  }

  // ONE request for every CMS pin (docs/127 §7) — this was a fetch per pin, while the
  // product pins directly above derive from the already-fetched catalog list.
  if (needs.cmsPins.length > 0) {
    tasks.push(
      getEntriesByIds(tenantSlug, needs.cmsPins)
        .then((entries) => {
          const pins = (root[PINS_ROOT] as Record<string, unknown> | undefined) ?? {};
          for (const id of needs.cmsPins) {
            const entry = entries.get(id);
            if (entry)
              pins[entityPinKey('cms', id)] = toSilicaEntry(entry, tenantSlug, entry.type_key);
          }
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
