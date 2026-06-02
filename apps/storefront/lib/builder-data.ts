// Real-data loader for the Builder render path (docs/44 §3, Slice A.2). Walks a
// published node tree, collects the data sources it binds to, fetches the real
// records via the existing public endpoints, and shapes them into the `root`
// the shared resolver (`resolvePath`) reads — the real-record analogue of the
// editor's `buildPreviewData`.
//
// Scope: ARRAY sources only — `cms.<type>` (collection) + `commerce.product`.
// These cover singleton pages that iterate / pick `[0]`. Object record sources
// (`blog_post.*`, `product.*`) and `crm.list` belong to per-record collection
// templates (Slice B) and resolve to empty here, so those nodes render their
// empty state rather than erroring.

import type { BuilderNode, DataSources } from '@sparx/builder-schemas';

import { publicGet, type ApiEntry } from './content';
import { listProducts, type PublicProductListItem } from './commerce';
import { mediaUrl } from './media';

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

/** Fetch every source the tree binds to and return the resolver `root`. A
 *  failed fetch degrades that source to empty rather than failing the page. */
export async function loadBuilderData(tenantSlug: string, tree: BuilderNode): Promise<DataSources> {
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
  return root;
}
