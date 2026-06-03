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

import { publicGet, type ApiEntry } from './content';
import { listProducts, type PublicProduct, type PublicProductListItem } from './commerce';
import { getNavByLocation, type NavNode } from './site';
import { mediaUrl } from './media';
import type { ResolvedTenant } from './tenant';
import type { BuilderProduct } from '../components/builder-commerce';

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
    title: p.title,
    price: p.priceMinCents != null ? p.priceMinCents / 100 : null,
    compareAtPrice: p.compareAtCents != null ? p.compareAtCents / 100 : null,
    description: p.description ?? '',
    images: img ? [{ url: img, alt: p.title }] : [],
    sku: '',
  };
}

/** Map a full PublicProduct into the BuilderProduct the collection template
 *  binds: the `product.*` leaf fields (title/price/description/images/sku) PLUS
 *  options + variants (cents preserved) so the Tier-2 buy-box resolves a selected
 *  variant. The single in-scope record for a `commerce.product` collection page. */
export function productToBuilderRecord(
  p: PublicProduct,
  tenantSlug: string,
  currency: string
): BuilderProduct {
  return {
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
      priceCents: v.priceCents,
      compareAtPriceCents: v.compareAtPriceCents,
      isDefault: v.isDefault,
      inStock: v.inStock,
      available: v.available,
      optionValueIds: v.optionValueIds,
    })),
  };
}

/** Fetch every source the tree binds to and return the resolver `root`. A
 *  failed fetch degrades that source to empty rather than failing the page.
 *  `record` (collection templates) injects a single in-scope record at its
 *  object key (`product`, `page`, `blog_post`) so `<key>.*` bindings resolve. */
export async function loadBuilderData(
  tenantSlug: string,
  tree: BuilderNode,
  record?: { key: string; value: unknown }
): Promise<DataSources> {
  const { cmsTypes, commerce } = neededSources(tree);
  const root: DataSources = {};
  const tasks: Promise<void>[] = [];

  for (const type of cmsTypes) {
    tasks.push(
      listEntries(tenantSlug, type)
        .then((entries) =>
          setAtPath(
            root,
            `cms.${type}`,
            entries.map((e) => e.body)
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
// The chrome (header/footer) binds to the `site` sources. Unlike page data,
// these reference the platform's EXISTING stores (brand identity, CMS nav, the
// tenant's site settings) — the Builder keeps no parallel copy. Nested nav is
// flattened to the top level for v1 (docs/45 §7); `site.social` maps the
// tenant's site-wide social links (Tenant.socials, carried in the public tenant
// payload) to `{ platform, url }[]`.

function navToItems(nodes: NavNode[]): { label: string; url: string }[] {
  return nodes.map((n) => ({ label: n.label, url: n.href }));
}

// The tenant's social links → the `{ platform, url }[]` the SocialLinks leaf
// binds. Already the right shape; just drop any blank/malformed entries.
function socialsToItems(
  socials: { platform: string; url: string }[]
): { platform: string; url: string }[] {
  return socials.filter(
    (s) => typeof s?.platform === 'string' && typeof s?.url === 'string' && s.url.trim().length > 0
  );
}

/** Build the `site` resolver root for the layout renderer: brand identity from
 *  the resolved tenant, header/footer nav from the CMS navigation menus, social
 *  links from the tenant's site settings. */
export async function loadSiteData(tenant: ResolvedTenant): Promise<DataSources> {
  const root: DataSources = {};

  const logo = mediaUrl(tenant.theme?.logoMediaId ?? null, tenant.slug);
  setAtPath(root, 'site.identity', {
    name: tenant.name,
    tagline: '',
    logo: logo ? { url: logo, alt: tenant.name } : null,
  });

  // getNavByLocation already degrades to [] on failure / no menu.
  const [header, footer] = await Promise.all([
    getNavByLocation(tenant.slug, 'header'),
    getNavByLocation(tenant.slug, 'footer'),
  ]);
  setAtPath(root, 'site.primaryNav', navToItems(header));
  setAtPath(root, 'site.footerNav', navToItems(footer));
  setAtPath(root, 'site.social', socialsToItems(tenant.socials));

  return root;
}
