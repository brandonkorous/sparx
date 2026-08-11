// Real-data loader for the Builder render path (docs/44 §3, Slice A.2). Walks a
// published node tree, collects the data sources it binds to, fetches the real
// records via the existing public endpoints, and shapes them into the `root`
// the shared resolver (`resolvePath`) reads — the real-record analogue of the
// editor's `buildPreviewData`.
//
// Scope: ARRAY sources — `cms.<type>` (collection) + `commerce.product` — cover
// singleton pages that iterate / pick `[0]`. For per-record COLLECTION templates
// (docs/44 §3 B) the caller passes the in-scope `record` ({ key:'product', value })
// which is injected at `root.product` / `root.page` / `root.blog_post` so the
// tree's `product.*` / `page.*` bindings resolve to that one record. `crm.list`
// still resolves empty until its loader lands.

import {
  PINS_ROOT,
  SOURCES_ROOT,
  collectBindingRefs,
  entityPinKey,
  type BuilderNode,
  type DataSources,
} from '@sparx/builder-schemas';

import { getEntriesByIds, publicGet, type ApiEntry, type BlogPostBody } from './content';
import { listProducts, type PublicProductListItem } from './commerce';
import { mediaUrl } from './media';
import type { ResolvedSite } from './site-context';
import { loadCommerceData, productToBuilderRecord } from './builder-commerce-data';

// The full PublicProduct → BuilderProduct map now lives with the commerce loader
// (builder-commerce-data); re-export it so the PDP collection-template path keeps
// importing it from '@/lib/builder-data'.
export { productToBuilderRecord };

function walkBindings(node: BuilderNode, visit: (path: string) => void): void {
  if (node.binding?.path) visit(node.binding.path);
  for (const child of node.children ?? []) walkBindings(child, visit);
}

/** The sources a tree binds to that we can resolve to real records here. */
function neededSources(tree: BuilderNode): { cmsTypes: Set<string>; commerce: boolean } {
  const cmsTypes = new Set<string>();
  let commerce = false;
  walkBindings(tree, (path) => {
    if (path.startsWith('item') || path === 'index') return;
    const root = path.split('[')[0] ?? path; // strip a trailing [n]
    if (root.startsWith('cms.')) {
      const type = root.slice('cms.'.length).split('.')[0];
      if (type) cmsTypes.add(type);
    } else if (root === 'commerce.product' || root.startsWith('commerce.product.')) {
      commerce = true;
    }
  });
  return { cmsTypes, commerce };
}

/** Assign `value` at a dotted key, creating nested objects (`cms.blog_post`
 *  → root.cms.blog_post). Mirrors the editor's buildPreviewData. */
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

/**
 * How many records a bound COLLECTION renders (docs/127 §8) — one named number rather
 * than a bare `24` inlined per fetch. At the catalog sizes this platform targets, a
 * silent cap is data loss: the extra records simply never appear, with no pagination
 * and no signal to the shopper or the author.
 */
const COLLECTION_PAGE_SIZE = 24;

// A CMS entry's `body` IS the field map (keys match the content type's schema
// fields), so `item.<field>` resolves directly against it. Fetches ONE MORE than it
// renders so truncation is detectable — the endpoint returns a bare array, so n+1
// coming back is the only available "there are more" signal.
async function listEntries(tenantSlug: string, type: string): Promise<ApiEntry[]> {
  return publicGet<ApiEntry[]>(
    '/v1/public/content/entries',
    { tenant: tenantSlug, type, limit: COLLECTION_PAGE_SIZE + 1 },
    { tag: `entries:${tenantSlug}:${type}` }
  );
}

// The Commerce source schema is code-defined (title/price/images/…); map the
// public product shape onto it. Cents → dollars; the primary image id → a URL.
function mapProduct(p: PublicProductListItem, tenantSlug: string): Record<string, unknown> {
  const img = mediaUrl(p.primaryImageId, tenantSlug);
  return {
    id: p.id,
    handle: p.handle,
    title: p.title,
    price: p.priceMinCents != null ? p.priceMinCents / 100 : null,
    compareAtPrice: p.compareAtCents != null ? p.compareAtCents / 100 : null,
    description: p.description ?? '',
    images: img ? [{ url: img, alt: p.title }] : [],
    sku: '',
  };
}

// A published date → a readable "Month D, YYYY". Blank for a missing/invalid date.
function formatPublishedDate(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(d);
}

/** Project an entry's BYLINE — author persona + taxonomy — into the flat, bindable
 *  fields a masthead / feed card reads (`authorName`, `authorAvatar`, `authorBio`,
 *  `category`, `categorySlug`, `tags`).
 *
 *  These come from the `author` / `terms` relations the PUBLIC content reads now
 *  `include` (packages/cms `PUBLIC_ENTRY_BYLINE_INCLUDE`); an entry read without them
 *  (or a type with no author/taxonomy) projects empty, so a template that binds a
 *  byline degrades to nothing rather than erroring. `category` is the first
 *  `blog_category` term (fallback: the first non-tag term); `tags` are the
 *  `blog_tag` terms — the WordPress rubric/tags split every publisher template wants. */
function projectByline(
  entry: Pick<ApiEntry, 'author' | 'terms'>,
  tenantSlug: string
): Record<string, unknown> {
  const author = entry.author ?? null;
  const avatarUrl = author?.avatar_asset_id ? mediaUrl(author.avatar_asset_id, tenantSlug) : null;
  const terms = entry.terms ?? [];
  const tagTerms = terms.filter((t) => t.taxonomy_key === 'blog_tag');
  const primaryCategory =
    terms.find((t) => t.taxonomy_key === 'blog_category') ??
    terms.find((t) => t.taxonomy_key !== 'blog_tag') ??
    null;
  return {
    authorName: author?.display_name ?? '',
    authorAvatar: avatarUrl ? { url: avatarUrl, alt: author?.display_name ?? '' } : null,
    authorBio: author?.bio ?? '',
    category: primaryCategory?.name ?? '',
    categorySlug: primaryCategory?.slug ?? '',
    tags: tagTerms.map((t) => t.name),
  };
}

/** Map a published blog_post entry into the single in-scope record a `cms.blog_post`
 *  collection template binds (`blog_post.*`): title + excerpt, the rich-text body
 *  doc passed through verbatim (the Prose leaf serializes it on render), the
 *  featured-image asset id resolved to a `{ url, alt }`, a human-readable published
 *  date, and the byline (author + category + tags). The CMS analogue of
 *  productToBuilderRecord. */
export function postToBuilderRecord(
  entry: ApiEntry<BlogPostBody>,
  tenantSlug: string
): Record<string, unknown> {
  const body = entry.body ?? {};
  const title = typeof body.title === 'string' ? body.title : '';
  const featured = typeof body.featuredImage === 'string' ? body.featuredImage : null;
  const url = mediaUrl(featured, tenantSlug);
  return {
    title,
    excerpt: typeof body.excerpt === 'string' ? body.excerpt : '',
    body: body.body ?? null,
    featuredImage: url ? { url, alt: title } : null,
    date: formatPublishedDate(entry.published_at),
    ...projectByline(entry, tenantSlug),
  };
}

/** Resolve a list entry's body for the iterate/list context (`item.*`). Asset
 *  fields are stored as a media-id string; resolve the conventional `featuredImage`
 *  to a `{ url, alt }` so an `<ImageDisplay bind="item.featuredImage">` renders —
 *  the list analogue of postToBuilderRecord (which does this for the single PDP
 *  record). Untouched bodies pass through. */
function resolveEntryBodyAssets(
  body: Record<string, unknown> | null | undefined,
  tenantSlug: string
): Record<string, unknown> {
  const b = { ...(body ?? {}) };
  if (typeof b.featuredImage === 'string') {
    const url = mediaUrl(b.featuredImage, tenantSlug);
    const alt = typeof b.title === 'string' ? b.title : '';
    b.featuredImage = url ? { url, alt } : null;
  }
  return b;
}

/** The route a `cms.<type>` collection CARD links to — mirrors silica-data's `entryUrl`
 *  so this (builder-preview) path links a journal/index card the SAME way the live silica
 *  storefront does. Only `blog_post` has a per-record detail route (`app/blog/[slug]`);
 *  other content types render inline and carry no destination, so their card `url` is `''`
 *  and the anchor stays un-clickable rather than pointing every card at the static index
 *  placeholder (`/blog`), which 404s. Keep in sync with `silica-data.ts` `entryUrl`. */
function cmsEntryUrl(type: string, slug: string | null | undefined): string {
  if (!slug) return '';
  return type === 'blog_post' ? `/blog/${slug}` : '';
}

/** Hydrate the CMS entries a tree PINS by id (docs/98 Pillar 7 record-display) into
 *  `__pins['cms:<id>']` — the entry body with asset fields resolved, so a section
 *  pinned to a blog post reads `item.title` / `item.body` / `item.featuredImage`.
 *  One batched fetch for all pins; a missing/unpublished entry doesn't render. */
async function loadCmsPins(tenantSlug: string, tree: BuilderNode): Promise<DataSources> {
  const ids = collectBindingRefs(tree)
    .entities.filter((e) => e.entity === 'cms')
    .map((e) => e.id);
  if (ids.length === 0) return {};
  // ONE request for every pin (docs/127 §7), matching how the commerce loader batches
  // its product pins. This was a fetch per pin.
  const entries = await getEntriesByIds(tenantSlug, ids);
  const pins: Record<string, unknown> = {};
  for (const id of ids) {
    const entry = entries.get(id);
    if (entry) pins[entityPinKey('cms', id)] = resolveEntryBodyAssets(entry.body, tenantSlug);
  }
  return Object.keys(pins).length > 0 ? { [PINS_ROOT]: pins } : {};
}

/** Merge a partial resolver root into `root`, deep-merging the reserved `__pins` /
 *  `__sources` maps so the commerce loader's pins and the CMS loader's pins coexist
 *  (a plain Object.assign would clobber one writer's pin map with the other's). */
function mergeDataRoots(root: DataSources, partial: DataSources): void {
  for (const [k, v] of Object.entries(partial)) {
    const reserved = k === PINS_ROOT || k === SOURCES_ROOT;
    const existing = root[k];
    if (reserved && existing && typeof existing === 'object' && v && typeof v === 'object') {
      Object.assign(existing as Record<string, unknown>, v as Record<string, unknown>);
    } else {
      root[k] = v;
    }
  }
}

/** Fetch every source the tree binds to and return the resolver `root`. A
 *  failed fetch degrades that source to empty rather than failing the page.
 *  `record` (collection templates) injects a single in-scope record at its
 *  object key (`product`, `page`, `blog_post`) so `<key>.*` bindings resolve.
 *  `currency` is the site's default — used to format the products a pinned/looped
 *  commerce binding hydrates (docs/98 Pillar 7). */
export async function loadBuilderData(
  tenantSlug: string,
  tree: BuilderNode,
  record?: { key: string; value: unknown },
  currency = 'USD'
): Promise<DataSources> {
  const { cmsTypes, commerce } = neededSources(tree);
  const root: DataSources = {};
  const tasks: Promise<void>[] = [];

  // docs/98 Pillar 7: hydrate the records a tree pins/iterates under the reserved
  // __pins / __sources roots — products + collection/category records (commerce) and
  // CMS entries — merged (not clobbered) so both pin writers coexist.
  tasks.push(
    loadCommerceData(tenantSlug, tree, currency)
      .then((commerceRoot) => mergeDataRoots(root, commerceRoot))
      .catch(() => undefined)
  );
  tasks.push(
    loadCmsPins(tenantSlug, tree)
      .then((cmsRoot) => mergeDataRoots(root, cmsRoot))
      .catch(() => undefined)
  );

  for (const type of cmsTypes) {
    tasks.push(
      listEntries(tenantSlug, type)
        .then((entries) => {
          const shown = entries.slice(0, COLLECTION_PAGE_SIZE);
          setAtPath(
            root,
            `cms.${type}`,
            // Body fields (`item.title`, `item.featuredImage`, …) PLUS the byline
            // (`item.authorName`, `item.category`, `item.tags`) so a feed card renders
            // a real WordPress-style row, not just a headline. Byline is empty for a
            // type with no author/taxonomy, so non-editorial feeds are unaffected.
            shown.map((e) => ({
              ...resolveEntryBodyAssets(e.body, tenantSlug),
              ...projectByline(e, tenantSlug),
              // The card's own slug + destination, so a `cms.<type>` index card can bind its
              // `<a href>` to `item.url` and deep-link the post (blog_post → /blog/<slug>)
              // instead of every card falling back to the static `/blog` placeholder. Mirrors
              // silica-data's `toSilicaEntry`.
              slug: e.slug ?? '',
              url: cmsEntryUrl(type, e.slug),
            }))
          );
          // n+1 came back → more exist. Bindable, so a template can say so instead of
          // the list just ending (docs/127 §8).
          const hasMore = entries.length > COLLECTION_PAGE_SIZE;
          setAtPath(root, `cms.${type}HasMore`, hasMore);
          if (hasMore) {
            console.warn(
              `[builder-data] cms.${type}: showing ${shown.length} entries, more exist — ` +
                `no pagination on the storefront yet (docs/127 §8).`
            );
          }
        })
        .catch(() => setAtPath(root, `cms.${type}`, []))
    );
  }
  if (commerce) {
    tasks.push(
      listProducts(tenantSlug, { perPage: COLLECTION_PAGE_SIZE })
        .then(({ items, total }) => {
          const products = items.map((p) => mapProduct(p, tenantSlug));
          setAtPath(root, 'commerce.product', products);
          // The list endpoint DOES report a total here, so the exact count is bindable
          // ("Showing 24 of 137") rather than just a boolean (docs/127 §8).
          setAtPath(root, 'commerce.productTotal', total);
          setAtPath(root, 'commerce.productHasMore', total > products.length);
          if (total > products.length) {
            console.warn(
              `[builder-data] product catalog: showing ${products.length} of ${total} — ` +
                `the rest are not rendered and there is no pagination yet (docs/127 §8).`
            );
          }
        })
        .catch(() => setAtPath(root, 'commerce.product', []))
    );
  }

  await Promise.all(tasks);
  // The in-scope record for a collection template (e.g. root.product = the one
  // product). Set last; its key never collides with the array sources above
  // (`product` vs `commerce.product`).
  if (record) setAtPath(root, record.key, record.value);
  return root;
}

// ── Site layout data (docs/45 §4) ────────────────────────────────────────────
// The chrome binds to the `site` sources for brand identity + social links —
// platform-sourced data the Builder keeps no parallel copy of. Navigation is NOT
// here: it's Builder-owned (docs/57), carried on the NavMenu node's own
// `props.links` (migrated off the old CMS menus by 20260706_nav_into_builder).

// The tenant's social links → the `{ platform, url }[]` the SocialLinks leaf
// binds. Already the right shape; just drop any blank/malformed entries.
function socialsToItems(
  socials: { platform: string; url: string }[]
): { platform: string; url: string }[] {
  return socials.filter(
    (s) => typeof s?.platform === 'string' && typeof s?.url === 'string' && s.url.trim().length > 0
  );
}

/** Build the `site` resolver root for the layout renderer: brand identity + social
 *  links from the resolved site, plus the site's appearance settings. Navigation
 *  is Builder-owned (docs/57) — it lives on the NavMenu node, not here.
 *
 *  `appearance` carries the published appearance policy + the SSR-resolved initial
 *  mode, so the Builder `ThemeToggle` node can auto-hide unless both themes are
 *  offered (`policy === 'toggle'`) and paint the right icon before hydration. */
export function loadSiteData(
  site: ResolvedSite,
  appearance?: { policy: string; initial: 'light' | 'dark' }
): DataSources {
  const root: DataSources = {};

  const logo = mediaUrl(site.theme?.logoMediaId ?? null, site.slug);
  setAtPath(root, 'site.identity', {
    name: site.name,
    tagline: '',
    logo: logo ? { url: logo, alt: site.name } : null,
  });

  setAtPath(root, 'site.social', socialsToItems(site.socials));

  if (appearance) {
    setAtPath(root, 'site.appearance', {
      policy: appearance.policy,
      initial: appearance.initial,
    });
  }

  return root;
}
