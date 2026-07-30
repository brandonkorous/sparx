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
  COLLECTION_PAGE_ITEMS,
  PINS_ROOT,
  RAIL_MAX_ITEMS,
  collectSilicaSourceNeeds,
  createSilicaResolver,
  defaultSilicaFormat,
  entityPinKey,
  type DataSources,
  type NodeBinding,
  type SilicaNode,
  type SilicaResolver,
} from '@sparx/builder-schemas';
import { PLACEHOLDER_IMAGE } from '@sparx/silica-catalog';

import {
  listCollectionProducts,
  listProducts,
  type PublicCollection,
  type PublicProduct,
  type PublicProductListItem,
} from './commerce';
import { getEntriesByIds, publicGetPaged, type ApiEntry } from './content';
import { mediaUrl } from './media';

/** How many products a bounded rail shows at most — a curated handful, never the whole
 *  catalog (the whole-catalog grid binds `commerce.product`).
 *
 *  Re-exported from `@sparx/builder-schemas` rather than declared here: the EDITOR needs
 *  the same number to draw the right count of placeholder cards, and while it lived in
 *  this file the editor could only guess — it guessed three, so every rail previewed
 *  short. It is `DataSource.maxItems` on the rail sources now, and this is that. */
const FEATURED_LIMIT = RAIL_MAX_ITEMS;

/**
 * How many records a bound COLLECTION grid renders PER PAGE (docs/127 §8).
 *
 * This was a bare `24` inlined at each fetch, and it was not a page size — it was
 * silent data loss. A tenant with 137 products saw 24 of them, the storefront showed
 * no pagination, and nothing anywhere said the other 113 existed: not to the shopper,
 * not to the author, not to a log. It is a real page size now (slice 23): the rest of
 * the catalog is reachable at `?page=2`, and the `site.pagination` core renders the
 * links that get you there.
 *
 * Shared with the editor for the same reason as `FEATURED_LIMIT` above — a grid that
 * shows 24 previewed as 3.
 */
const COLLECTION_PAGE_SIZE = COLLECTION_PAGE_ITEMS;

/**
 * What a bound collection on this page is showing, and how to move it.
 *
 * The storefront hands this to the `site.pagination` host core, which is where the
 * links are actually rendered — a bound tree cannot express "no Previous link on page
 * one", so the platform renders that part in React (the same reasoning that made the
 * brand mark a host core; see `host-nodes.ts`).
 */
export interface ListPaging {
  /** The root key this describes — `commerce.product`, `cms.blog_post`. */
  source: string;
  /**
   * The URL query parameter that moves this list.
   *
   * `page` when it is the only paginated list on the page, which is nearly always —
   * a plain `?page=2` is what a reader bookmarks and a search engine crawls. A page
   * carrying TWO bound collections (a product grid and a journal index) cannot share
   * one parameter without moving both at once, so each takes a suffixed one instead.
   */
  param: string;
  page: number;
  perPage: number;
  /** How many records exist. `null` where the source cannot tell us — the CMS entries
   *  endpoint counts only when asked by page number, so a cursor-walked list has no
   *  total and the pager says "Next" rather than "of 9". */
  total: number | null;
  totalPages: number | null;
  /** True when there is at least one more page. Always knowable, even where `total`
   *  is not — which is why the pager is built on this and not on the total. */
  hasMore: boolean;
}

/** The resolver plus what it paginated. Two values because the render walk and the
 *  pagination core need different halves of the same fetch, and re-deriving either
 *  from the other is how they end up disagreeing about what page you are on. */
export interface SilicaHost {
  resolver: SilicaResolver;
  paging: ListPaging[];
}

/** The URL-safe short name for a source key: `commerce.product` → `product`,
 *  `cms.blog_post` → `blog-post`. Only used when a page has more than one paginated
 *  list and they need to move independently. */
function pagingParamFor(source: string, alone: boolean): string {
  if (alone) return 'page';
  const last = source.split('.').pop() ?? source;
  return `page-${last.replace(/_/g, '-')}`;
}

/** Read a page number out of the route's search params. Anything that is not a
 *  positive integer is page one — a hand-edited `?page=banana` should show the first
 *  page, never an error. */
function pageFrom(
  params: Record<string, string | string[] | undefined> | undefined,
  param: string
): number {
  const raw = params?.[param];
  const value = Array.isArray(raw) ? raw[0] : raw;
  const n = Number.parseInt(value ?? '', 10);
  return Number.isFinite(n) && n >= 1 ? n : 1;
}

/** Publish the paging facts alongside the list itself, so a template can bind
 *  `commerce.productTotal` / `commerce.productHasMore` / `commerce.productFrom`
 *  ("Showing 25–48 of 137") without the pagination core, and the core can render real
 *  links with them. Every key is set even when there is one page — an absent ref
 *  resolves as "not found" and leaves authored placeholder text on the page. */
function setListMeta(root: DataSources, key: string, shown: number, paging: ListPaging): void {
  const from = shown === 0 ? 0 : (paging.page - 1) * paging.perPage + 1;
  setAtPath(root, `${key}Total`, paging.total);
  setAtPath(root, `${key}HasMore`, paging.hasMore);
  setAtPath(root, `${key}Page`, paging.page);
  setAtPath(root, `${key}Pages`, paging.totalPages);
  setAtPath(root, `${key}From`, from);
  setAtPath(root, `${key}To`, shown === 0 ? 0 : from + shown - 1);
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
    // Keep the { url, alt } shape even with no media (empty url) rather than null: the
    // host `format` maps an empty-url image to the placeholder tile, so an imageless
    // product renders "an image goes here" instead of the silica Image component's
    // broken-image glyph (see makeFormat).
    image: { url: url ?? '', alt: p.title },
    // Bound by the buy box's hidden field, so its <form> submit carries a real
    // cart line. Empty string (not null) when the product has no live variant:
    // the hidden input renders `value=""`, the field is `required`, and the
    // browser blocks the submit before silica's form behavior dispatches.
    variantId: p.defaultVariantId ?? '',
    // The card's destination, bound into the `<a href>`. An empty value renders an
    // un-clickable card rather than a link to nowhere — `dropEmptyUrlAttrs` removes
    // the `href=""` that the engine's `fillValue` would otherwise leave behind.
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
    // Empty-url object, never null — the host `format` turns it into the placeholder
    // tile (see makeFormat / toSilicaProduct).
    image: { url: url ?? '', alt: primary?.alt ?? p.title },
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
// carry no destination, so their card `url` resolves to `''` and `dropEmptyUrlAttrs`
// leaves the anchor un-clickable rather than pointing it at a 404.
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
    // Empty-url object, never null — the host `format` maps it to the placeholder tile
    // so a post with no featured image shows a neutral tile, not a broken-image glyph
    // (see makeFormat). An ABSENT featuredImage stays absent and keeps the card's own
    // authored placeholder via the unknown-ref path.
    b.featuredImage = { url: url ?? '', alt: typeof b.title === 'string' ? b.title : '' };
  }
  b.slug = entry.slug ?? '';
  b.url = entryUrl(type, entry.slug);
  // The publish date lives on the ROW, not in the body, so a card that wants to date
  // itself has nothing to bind without this. `date` (pre-formatted for display) is the
  // field the silica CMS composites bind — matching the single-record projection
  // (`postToBuilderRecord`), so the SAME `date` ref resolves on both a blog index card
  // and the post's detail masthead. `publishedAt` keeps the raw ISO for any datetime use.
  b.publishedAt = entry.published_at ?? '';
  b.date = entry.published_at ? formatEntryDate(entry.published_at) : '';
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

/** One page of a CMS type, with the total the numbered walk reports (slice 23 added
 *  `?page=` to the public entries endpoint precisely so a blog index can say "page 4
 *  of 9" in a URL a reader bookmarks and a crawler follows — a cursor cannot). */
async function listEntries(
  tenantSlug: string,
  type: string,
  page: number
): Promise<{ items: ApiEntry[]; total: number }> {
  const { data, meta } = await publicGetPaged<ApiEntry[]>(
    '/v1/public/content/entries',
    { tenant: tenantSlug, type, limit: COLLECTION_PAGE_SIZE, page },
    { tag: `entries:${tenantSlug}:${type}` }
  );
  return { items: data, total: meta.total ?? data.length };
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
    // An image/file field with no media resolves to an empty-url object (the projections
    // keep the { url, alt } shape rather than null so this is detectable here). silica's
    // `defaultSilicaFormat` maps it to `undefined` — which a raw <img> element treats as
    // "keep the authored src", but the silica Image COMPONENT (every card uses it) sets
    // `src = String(value ?? '')` = "" and renders the browser's broken-image glyph. Hand
    // it the shared placeholder tile so an imageless record reads as "an image goes here".
    if (value && typeof value === 'object' && 'url' in value && !(value as { url?: unknown }).url) {
      return PLACEHOLDER_IMAGE;
    }
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
 *  `ResolveHost` the render primitive resolves against, plus what it paginated.
 *  A failed fetch degrades that source to empty rather than failing the page.
 *  `record` (a collection template's in-scope record) injects a single object at its
 *  key so `<key>.*` refs resolve; `site` supplies the chrome's brand identity +
 *  socials (always, since the frame binds `site.*` regardless of what the tree walk
 *  detects); `currency`/`locale` drive price formatting; `searchParams` is the route's
 *  raw query, which is where the page number lives. */
export async function buildSilicaHost(
  tenantSlug: string,
  tree: SilicaNode,
  opts: {
    record?: { key: string; value: unknown };
    site?: SilicaSiteData;
    currency?: string;
    locale?: string;
    /** The route's search params, forwarded verbatim. Omitted → page one, which is
     *  the right answer for the frame and for any route with no list on it. */
    searchParams?: Record<string, string | string[] | undefined>;
  } = {}
): Promise<SilicaHost> {
  const { currency = 'USD', locale = 'en-US', record, site, searchParams } = opts;
  const needs = collectSilicaSourceNeeds(tree);
  const root: DataSources = site ? siteRoot(site) : {};
  const tasks: Promise<void>[] = [];

  // The Products block binds ONE product source per instance; the collector reports
  // which are on the page (docs/118). Each is its own fetch, run in parallel. The
  // in-scope PDP product is excluded from every BOUNDED rail (they're cross-sell).
  const p = needs.products;

  // WHICH LISTS ON THIS PAGE ARE PAGINATED, decided before any fetch, because the
  // answer decides the query parameter each one reads. Only the UNBOUNDED sources
  // qualify — the whole-catalog grid and every CMS type. The rails (featured / new /
  // related) and the category grids are deliberately capped curations: a "Featured"
  // strip with a Next button underneath it is not a feature, it is a curation that
  // forgot it was one.
  /**
   * How many records a source must LOAD — the author's `limit` when every repeat over it
   * declared one, otherwise the normal amount. `needs.limits` holds `null` for "something
   * unbounded binds this", which reads exactly like "no limit" here.
   *
   * Capped at the normal size so a limit can only ever shrink a request. An author typing
   * 500 into a four-item strip is asking for a slow page, not a big one — and the number
   * is a display choice, never a licence to widen a query the platform paginates.
   */
  const loadCount = (source: string, normal: number): number => {
    const limit = needs.limits[source];
    return typeof limit === 'number' ? Math.min(limit, normal) : normal;
  };

  /**
   * A list is PAGED only when it is unbounded. Giving a block an explicit count turns it
   * from "the catalog, in pages" into "these N products" — a curation — and a Next link
   * under a curation is the same mistake the rails were kept clear of. The block also
   * ships a pager core unconditionally on a catalog grid (see `productsBlock`), which
   * renders nothing when no paging is recorded, so limiting a grid quietly retires its
   * pager instead of leaving a broken one.
   */
  const isLimited = (source: string): boolean => typeof needs.limits[source] === 'number';

  const pagedSources = [
    ...(p.catalog && !isLimited('commerce.product') ? ['commerce.product'] : []),
    ...needs.cmsTypes.map((t) => `cms.${t}`).filter((key) => !isLimited(key)),
  ];
  const alone = pagedSources.length === 1;
  const paging: ListPaging[] = [];
  const requestedPage = (source: string): { param: string; page: number } => {
    const param = pagingParamFor(source, alone);
    return { param, page: pageFrom(searchParams, param) };
  };
  const currentProductId =
    record?.key === 'product' ? (record.value as { id?: string } | undefined)?.id : undefined;
  const notCurrent = (i: PublicProductListItem) => i.id !== currentProductId;
  /** Exclude the current product, cap to the rail's size, shape as cards. `cap` is the
   *  author's limit for THIS rail when they set one, so two rails over different sources
   *  can legitimately show different counts. */
  const bounded = (items: PublicProductListItem[], source: string) =>
    items
      .filter(notCurrent)
      .slice(0, loadCount(source, FEATURED_LIMIT))
      .map((i) => toSilicaProduct(i, tenantSlug));

  // A LIMITED catalog grid is not a paged list — it is "these N products" — so it never
  // asks for a page number and never records paging, which is what leaves its pager core
  // rendering nothing.
  const catalogLimited = p.catalog && isLimited('commerce.product');

  // Which page the catalog grid is on, and therefore whether the base fetch below can
  // still serve it. On page one — nearly always — it can, and this stays the single
  // request it has always been. A limited grid is always served by the base fetch.
  const catalogPage = p.catalog && !catalogLimited ? requestedPage('commerce.product') : null;
  const catalogOnBase = catalogLimited || catalogPage?.page === 1;

  /**
   * How many products the base fetch asks for.
   *
   * It shrinks to the author's limit ONLY when the catalog grid is the sole consumer.
   * "Featured" is computed by filtering this same list for a `featured` tag, and pins are
   * indexed out of it, so both need a real pool to draw from — narrowing the request to a
   * four-item strip would leave the rail picking from four products and looking broken in
   * a way no page on the site explains. The saving that matters (a landing page asking for
   * 4 instead of 24) is exactly the case where nothing else is reading the pool.
   */
  const basePoolShared = p.featured || needs.productPins.length > 0;
  const basePerPage = basePoolShared
    ? COLLECTION_PAGE_SIZE
    : loadCount('commerce.product', COLLECTION_PAGE_SIZE);

  /** Record what a catalog fetch actually returned, so the pager can move it. */
  const recordCatalogPaging = (shown: number, total: number): void => {
    if (!catalogPage) return;
    const totalPages = Math.max(1, Math.ceil(total / COLLECTION_PAGE_SIZE));
    const entry: ListPaging = {
      source: 'commerce.product',
      param: catalogPage.param,
      page: catalogPage.page,
      perPage: COLLECTION_PAGE_SIZE,
      total,
      totalPages,
      hasMore: catalogPage.page < totalPages,
    };
    paging.push(entry);
    setListMeta(root, 'commerce.product', shown, entry);
  };

  // Base catalog fetch (default sort, page one) — the featured slice and the product
  // pins always read from it, and so does the whole-catalog grid while the reader is
  // on page one. Deeper pages get their own request below: a "Featured" rail built
  // from page 3 of the catalog would be showing whatever happened to sort there,
  // which is not a curation at all.
  if (catalogOnBase || p.featured || needs.productPins.length > 0) {
    tasks.push(
      listProducts(tenantSlug, { perPage: basePerPage })
        .then(({ items, total }) => {
          const products = items.map((i) => toSilicaProduct(i, tenantSlug));
          if (catalogOnBase) {
            // A limited grid takes only what it renders. The base fetch may legitimately
            // hold more (the pool `basePerPage` kept for Featured), so trim here rather
            // than relying on the request size.
            setAtPath(
              root,
              'commerce.product',
              products.slice(0, loadCount('commerce.product', products.length))
            );
            recordCatalogPaging(products.length, total);
          }
          if (p.featured) {
            // "Featured" = products the merchant tagged `featured` (a no-schema curation
            // signal on the existing `tags` field); newest-few fallback so the rail is
            // never an empty heading when nothing is tagged yet.
            const flagged = items.filter((i) =>
              i.tags?.some((t) => t.toLowerCase() === 'featured')
            );
            setAtPath(
              root,
              'commerce.featured',
              bounded(flagged.length > 0 ? flagged : items, 'commerce.featured')
            );
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
          if (catalogOnBase) setAtPath(root, 'commerce.product', []);
          if (p.featured) setAtPath(root, 'commerce.featured', []);
        })
    );
  }

  // Page two and beyond — its own request, because the base fetch above is pinned to
  // page one for the rails that depend on it.
  if (catalogPage && !catalogOnBase) {
    tasks.push(
      listProducts(tenantSlug, { perPage: COLLECTION_PAGE_SIZE, page: catalogPage.page })
        .then(({ items, total }) => {
          const products = items.map((i) => toSilicaProduct(i, tenantSlug));
          setAtPath(root, 'commerce.product', products);
          recordCatalogPaging(products.length, total);
        })
        .catch(() => setAtPath(root, 'commerce.product', []))
    );
  }

  // Newest — the "New" rail. Also the fallback source for the "Related" rail until the
  // public product API exposes a product's collection membership (see index-active-work).
  if (p.fresh || p.related) {
    // `+ 1` so excluding the in-scope PDP product still leaves a full rail. The pool is
    // the LARGER of the two rails' needs, since one fetch serves both.
    const freshPool =
      Math.max(
        p.fresh ? loadCount('commerce.new', FEATURED_LIMIT) : 0,
        p.related ? loadCount('commerce.related', FEATURED_LIMIT) : 0
      ) + 1;
    tasks.push(
      listProducts(tenantSlug, { sort: 'newest', perPage: freshPool })
        .then(({ items }) => {
          if (p.fresh) setAtPath(root, 'commerce.new', bounded(items, 'commerce.new'));
          if (p.related) setAtPath(root, 'commerce.related', bounded(items, 'commerce.related'));
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
    const key = `commerce.category.${handle}`;
    tasks.push(
      listCollectionProducts(tenantSlug, handle)
        .then(({ items }) =>
          setAtPath(
            root,
            key,
            items
              .filter(notCurrent)
              .slice(0, loadCount(key, COLLECTION_PAGE_SIZE))
              .map((i) => toSilicaProduct(i, tenantSlug))
          )
        )
        .catch(() => setAtPath(root, `commerce.category.${handle}`, []))
    );
  }

  for (const type of needs.cmsTypes) {
    const key = `cms.${type}`;
    // A limited content list is a curation ("our three latest posts"), so like a limited
    // product grid it reads page one and records no paging.
    const limited = isLimited(key);
    const requested = limited ? null : requestedPage(key);
    tasks.push(
      listEntries(tenantSlug, type, requested?.page ?? 1)
        .then(({ items, total }) => {
          const shown = items.slice(0, loadCount(key, items.length));
          setAtPath(
            root,
            key,
            shown.map((e) => toSilicaEntry(e, tenantSlug, type))
          );
          if (!requested) return;
          const totalPages = Math.max(1, Math.ceil(total / COLLECTION_PAGE_SIZE));
          const entry: ListPaging = {
            source: key,
            param: requested.param,
            page: requested.page,
            perPage: COLLECTION_PAGE_SIZE,
            total,
            totalPages,
            hasMore: requested.page < totalPages,
          };
          paging.push(entry);
          setListMeta(root, key, shown.length, entry);
        })
        .catch(() => setAtPath(root, key, []))
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

  return {
    resolver: createSilicaResolver({ root, format: makeFormat(currency, locale) }),
    // Sorted so the order is the tree's, not whichever fetch finished first — the
    // pagination core picks a list by name, but a surface listing them should not
    // reshuffle between requests.
    paging: paging.sort((a, b) => a.source.localeCompare(b.source)),
  };
}
