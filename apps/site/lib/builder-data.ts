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

import type { BuilderNode, DataSources } from '@sparx/builder-schemas';

import { publicGet, type ApiEntry, type BlogPostBody } from './content';
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

// A CMS entry's `body` IS the field map (keys match the content type's schema
// fields), so `item.<field>` resolves directly against it.
async function listEntries(tenantSlug: string, type: string): Promise<ApiEntry[]> {
  return publicGet<ApiEntry[]>(
    '/v1/public/content/entries',
    { tenant: tenantSlug, type, limit: 24 },
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

/** Map a published blog_post entry into the single in-scope record a `cms.blog_post`
 *  collection template binds (`blog_post.*`): title + excerpt, the rich-text body
 *  doc passed through verbatim (the Prose leaf serializes it on render), the
 *  featured-image asset id resolved to a `{ url, alt }`, and a human-readable
 *  published date. The CMS analogue of productToBuilderRecord. */
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

  // docs/98 Pillar 7: hydrate the products a pin / collection source binds (under
  // the reserved __pins / __sources roots) alongside the CMS + all-products sources.
  tasks.push(
    loadCommerceData(tenantSlug, tree, currency)
      .then((commerceRoot) => {
        Object.assign(root, commerceRoot);
      })
      .catch(() => undefined)
  );

  for (const type of cmsTypes) {
    tasks.push(
      listEntries(tenantSlug, type)
        .then((entries) =>
          setAtPath(
            root,
            `cms.${type}`,
            entries.map((e) => resolveEntryBodyAssets(e.body, tenantSlug))
          )
        )
        .catch(() => setAtPath(root, `cms.${type}`, []))
    );
  }
  if (commerce) {
    tasks.push(
      listProducts(tenantSlug, { perPage: 24 })
        .then(({ items }) =>
          setAtPath(
            root,
            'commerce.product',
            items.map((p) => mapProduct(p, tenantSlug))
          )
        )
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
