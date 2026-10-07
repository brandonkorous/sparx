// Where a picture is actually used — counted, never remembered (issue 381).
//
// `media_assets.usage_count` is a denormalised column that NOTHING has ever
// written. It defaults to 0 and stays 0, and three separate things trusted it:
//
//   · the library screen's "Used in" fact, which read "Not used anywhere yet"
//     over 37 of Devi's 87 pictures while they were on her live product pages
//     (2,406 across the whole database);
//   · both delete guards (`if (usageCount > 0) refuse`), which therefore could
//     never fire, so the console would let an owner delete a photograph that is
//     on a product page and say nothing;
//   · the media GC's eligibility test, which only hard-deletes rows already
//     soft-deleted — so the false counter turned the one thing standing between
//     a live photo and permanent deletion into a formality.
//
// The tests passed the whole time because they MOCK the count (`usageCount: 3`),
// proving the guard works when the number is right and never that it is.
//
// So this counts. A number computed from the rows that hold the references
// cannot drift from them, which a denormalised column maintained by hand at five
// call sites certainly would.

import { Prisma } from '@wizeworks/db';
import type { TxClient } from '@wizeworks/db';

/** What is using an asset, and how many of each. Only the sources that can be
 *  ANSWERED are counted — see `UNCOUNTED` below, which is why `total` is a
 *  floor rather than a complete tally. */
export interface AssetUsage {
  /** CMS entries whose body references it (`content_references`, kept by
   *  `syncReferences` on every entry write). */
  content: number;
  /** Product and variant photographs (`commerce_variant_images`). */
  products: number;
  /** Customer profile photos and files attached to a customer. */
  customers: number;
  /** Author byline avatars. */
  authors: number;
  /** Staff document attachments. */
  staffDocuments: number;
  /** Receipts and bills attached to an expense. */
  expenses: number;
  /** Site pages whose design shows it, by id or by its address. */
  sitePages: number;
  /** A site's header and footer (`builder_layouts`), the same way. */
  siteLayouts: number;
  /** The logo, the dark-background logo or the browser icon. */
  branding: number;
  /** A category's or a collection's picture. */
  catalog: number;
  /** Photographs a customer attached to a review. */
  reviews: number;
  /** Social posts that carry it. */
  socialPosts: number;
  /** Records that keep a file as evidence: returns, shipping labels, tax
   *  certificates, batch certificates, signed agreements, issued invoices,
   *  marketplace banners and part-finder icons. */
  otherRecords: number;
  /** The sum, which is what a guard and a screen both want. */
  total: number;
}

const EMPTY: AssetUsage = {
  content: 0,
  products: 0,
  customers: 0,
  authors: 0,
  staffDocuments: 0,
  expenses: 0,
  sitePages: 0,
  siteLayouts: 0,
  branding: 0,
  catalog: 0,
  reviews: 0,
  socialPosts: 0,
  otherRecords: 0,
  total: 0,
};

/** What is still not counted, so callers treat `total` as "at least this many".
 *
 *  Site pages and their header and footer WERE out of scope here, on a
 *  measurement of 1 of Juniper Row's 87 assets in a builder tree. That counted
 *  by id. A design that links a picture keeps its ADDRESS in the tree, and by
 *  address 20 of the 87 were on her pages, so the library called a picture on
 *  her home page "Not used anywhere" (issue 932). Pages and layouts are now
 *  scanned for the id and the address, and the brand, catalog, review, social
 *  and record columns that hold an asset id are counted too. What is left is a
 *  picture whose address appears only inside an email design, a saved section
 *  or a theme. */
export const UNCOUNTED = 'email designs, saved sections and themes';

/** Columns that hold one asset id, and the kind each counts toward. */
const ID_COLUMNS: readonly (readonly [string, string, keyof Omit<AssetUsage, 'total'>])[] = [
  ['tenant_brands', 'logo_light_media_id', 'branding'],
  ['tenant_brands', 'logo_dark_media_id', 'branding'],
  ['tenant_brands', 'favicon_media_id', 'branding'],
  ['commerce_product_categories', 'hero_media_id', 'catalog'],
  ['commerce_product_categories', 'icon_media_id', 'catalog'],
  ['commerce_product_collections', 'hero_media_id', 'catalog'],
  ['commerce_review_media', 'media_asset_id', 'reviews'],
  ['commerce_return_labels', 'label_media_id', 'otherRecords'],
  ['fulfillment_labels', 'label_media_id', 'otherRecords'],
  ['commerce_tax_exemptions', 'certificate_media_id', 'otherRecords'],
  ['inventory_lot_batches', 'coa_media_id', 'otherRecords'],
  ['commerce_contract_prices', 'signed_agreement_media_id', 'otherRecords'],
  ['billing_document_snapshots', 'pdf_media_id', 'otherRecords'],
  ['market_merchant_profiles', 'banner_media_id', 'otherRecords'],
  ['commerce_fitment_nodes', 'icon_media_id', 'otherRecords'],
];

interface RefRow {
  kind: keyof Omit<AssetUsage, 'total'>;
  id: string;
  n: number;
}

/**
 * The references no grouped Prisma count can reach: id columns on tables this
 * package has no model handle for, uuid and JSON arrays, and the designs of
 * site pages and layouts, which hold an id OR an address as plain JSON.
 *
 * One query. Pages are matched within the asset's own tenant, because a tree is
 * searched by text and an address (a stock photograph's URL) can be shared by
 * two businesses that both installed the same design.
 */
async function countOtherReferences(tx: TxClient, ids: readonly string[]): Promise<RefRow[]> {
  const assets = await tx.mediaAsset.findMany({
    where: { id: { in: [...ids] } },
    select: { id: true, key: true, tenantId: true },
  });
  if (assets.length === 0) return [];
  const assetIds = assets.map((a) => a.id);
  const keys = assets.map((a) => a.key);
  const tenants = assets.map((a) => a.tenantId);

  const idRefs = ID_COLUMNS.map(
    ([table, column, kind]) =>
      Prisma.sql`SELECT ${kind}::text AS kind, ${Prisma.raw(`"${column}"`)} AS id FROM ${Prisma.raw(`"${table}"`)} WHERE ${Prisma.raw(`"${column}"`)} = ANY(${assetIds}::uuid[])`
  );

  return tx.$queryRaw<RefRow[]>`
    WITH needles AS (
      SELECT * FROM unnest(${assetIds}::uuid[], ${keys}::text[], ${tenants}::uuid[]) AS n(id, key, tenant_id)
    ),
    pages AS MATERIALIZED (
      SELECT tenant_id,
             coalesce(draft_tree::text, '') || coalesce(published_tree::text, '') ||
             coalesce(silica_draft_tree::text, '') || coalesce(silica_published_tree::text, '') AS txt
      FROM builder_pages WHERE tenant_id = ANY(${tenants}::uuid[])
    ),
    layouts AS MATERIALIZED (
      SELECT tenant_id,
             coalesce(draft_tree::text, '') || coalesce(published_tree::text, '') ||
             coalesce(silica_draft_tree::text, '') || coalesce(silica_published_tree::text, '') AS txt
      FROM builder_layouts WHERE tenant_id = ANY(${tenants}::uuid[])
    ),
    refs(kind, id) AS (
      ${Prisma.join(idRefs, ' UNION ALL ')}
      UNION ALL
      SELECT 'socialPosts', unnest(media_asset_ids) FROM social_posts
        WHERE media_asset_ids && ${assetIds}::uuid[]
      UNION ALL
      SELECT 'otherRecords', (jsonb_array_elements_text(photo_media_ids))::uuid
        FROM commerce_return_inspections WHERE jsonb_typeof(photo_media_ids) = 'array'
      UNION ALL
      SELECT 'otherRecords', (jsonb_array_elements_text(media_asset_ids))::uuid
        FROM commerce_return_line_items WHERE jsonb_typeof(media_asset_ids) = 'array'
      UNION ALL
      SELECT 'sitePages', n.id FROM needles n JOIN pages p ON p.tenant_id = n.tenant_id
        WHERE position(n.id::text IN p.txt) > 0 OR position(n.key IN p.txt) > 0
      UNION ALL
      SELECT 'siteLayouts', n.id FROM needles n JOIN layouts l ON l.tenant_id = n.tenant_id
        WHERE position(n.id::text IN l.txt) > 0 OR position(n.key IN l.txt) > 0
    )
    SELECT kind, id::text AS id, count(*)::int AS n FROM refs
    WHERE id = ANY(${assetIds}::uuid[])
    GROUP BY kind, id
  `;
}

/** Usage for a set of assets, as a map keyed by asset id. Assets with no
 *  references are present with zeroes rather than absent, so a caller never has
 *  to tell "not used" apart from "not asked about".
 *
 *  Seven grouped queries for the whole set, not one per asset — this runs on the
 *  media library's list route, which pages 50 at a time. */
export async function countAssetUsage(
  tx: TxClient,
  assetIds: readonly string[]
): Promise<Map<string, AssetUsage>> {
  const usage = new Map<string, AssetUsage>();
  if (assetIds.length === 0) return usage;

  const ids = [...new Set(assetIds)];
  for (const id of ids) usage.set(id, { ...EMPTY });

  const bump = (id: string | null, field: keyof Omit<AssetUsage, 'total'>, n: number) => {
    if (!id) return;
    const row = usage.get(id);
    if (!row) return;
    row[field] += n;
    row.total += n;
  };

  const [content, products, avatars, customerDocs, authors, staffDocuments, expenses] =
    await Promise.all([
      tx.contentReference.groupBy({
        by: ['toAssetId'],
        where: { toAssetId: { in: ids } },
        _count: { _all: true },
      }),
      tx.variantImage.groupBy({
        by: ['mediaAssetId'],
        where: { mediaAssetId: { in: ids } },
        _count: { _all: true },
      }),
      tx.customer.groupBy({
        by: ['avatarMediaAssetId'],
        where: { avatarMediaAssetId: { in: ids } },
        _count: { _all: true },
      }),
      tx.customerDocument.groupBy({
        by: ['mediaAssetId'],
        where: { mediaAssetId: { in: ids } },
        _count: { _all: true },
      }),
      tx.author.groupBy({
        by: ['avatarAssetId'],
        where: { avatarAssetId: { in: ids } },
        _count: { _all: true },
      }),
      tx.staffDocument.groupBy({
        by: ['assetId'],
        where: { assetId: { in: ids } },
        _count: { _all: true },
      }),
      tx.financeExpenseAttachment.groupBy({
        by: ['assetId'],
        where: { assetId: { in: ids } },
        _count: { _all: true },
      }),
    ]);

  for (const r of content) bump(r.toAssetId, 'content', r._count._all);
  for (const r of products) bump(r.mediaAssetId, 'products', r._count._all);
  for (const r of avatars) bump(r.avatarMediaAssetId, 'customers', r._count._all);
  for (const r of customerDocs) bump(r.mediaAssetId, 'customers', r._count._all);
  for (const r of authors) bump(r.avatarAssetId, 'authors', r._count._all);
  for (const r of staffDocuments) bump(r.assetId, 'staffDocuments', r._count._all);
  for (const r of expenses) bump(r.assetId, 'expenses', r._count._all);
  for (const r of await countOtherReferences(tx, ids)) bump(r.id, r.kind, r.n);

  return usage;
}

/** One place that shows an asset, named, so a screen can open it. */
export interface PlaceUsingAsset {
  kind: 'product' | 'entry' | 'page' | 'layout';
  id: string;
  name: string;
  /** The site a page or a header and footer belongs to. A business can have
   *  several, and a page called "Home" says nothing until it says whose. Null
   *  for a product or an article. */
  site: string | null;
  /** That site's id, so a screen standing in another site can switch to it
   *  before opening the page. Opened from the wrong site, a page id resolves to
   *  nothing and the editor says the page "isn't here any more". */
  siteId: string | null;
}

/** How many of each kind are named. The count beside them is complete; this is
 *  the list a person can work through, and a picture on 300 products does not
 *  need 300 buttons. */
const NAMED_PER_KIND = 25;

/**
 * WHICH products, articles, site pages and headers and footers show one asset,
 * for its own page. The count says "2 product photos and 1 site page"; somebody
 * about to delete or replace the file needs to open each one (issue 932, and the
 * pane's gap since act 116). Pages are searched the way the count searches them:
 * the id or the address, within the asset's own business.
 */
export async function placesUsingAsset(tx: TxClient, assetId: string): Promise<PlaceUsingAsset[]> {
  const asset = await tx.mediaAsset.findFirst({
    where: { id: assetId },
    select: { id: true, key: true, tenantId: true },
  });
  if (!asset) return [];
  return tx.$queryRaw<PlaceUsingAsset[]>`
    (SELECT 'product' AS kind, p.id::text AS id, p.title AS name, NULL::text AS site, NULL::text AS "siteId"
       FROM commerce_products p
      WHERE p.deleted_at IS NULL
        AND p.id IN (SELECT product_id FROM commerce_variant_images WHERE media_asset_id = ${asset.id}::uuid)
      ORDER BY p.title LIMIT ${NAMED_PER_KIND})
    UNION ALL
    (SELECT 'entry', e.id::text, coalesce(nullif(e.body->>'title', ''), nullif(e.body->>'name', ''), e.slug, 'Untitled'), NULL, NULL
       FROM content_entries e
      WHERE e.deleted_at IS NULL
        AND e.id IN (SELECT from_entry_id FROM content_references WHERE to_asset_id = ${asset.id}::uuid)
      ORDER BY 3 LIMIT ${NAMED_PER_KIND})
    UNION ALL
    (SELECT 'page', p.id::text, p.name, s.name, s.id::text
       FROM builder_pages p JOIN properties s ON s.id = p.property_id
      WHERE p.tenant_id = ${asset.tenantId}::uuid
        AND (position(${asset.id} IN coalesce(p.draft_tree::text, '') || coalesce(p.published_tree::text, '') || coalesce(p.silica_draft_tree::text, '') || coalesce(p.silica_published_tree::text, '')) > 0
          OR position(${asset.key} IN coalesce(p.draft_tree::text, '') || coalesce(p.published_tree::text, '') || coalesce(p.silica_draft_tree::text, '') || coalesce(p.silica_published_tree::text, '')) > 0)
      ORDER BY 4, 3 LIMIT ${NAMED_PER_KIND})
    UNION ALL
    (SELECT 'layout', l.id::text, l.name, s.name, s.id::text
       FROM builder_layouts l JOIN properties s ON s.id = l.property_id
      WHERE l.tenant_id = ${asset.tenantId}::uuid
        AND (position(${asset.id} IN coalesce(l.draft_tree::text, '') || coalesce(l.published_tree::text, '') || coalesce(l.silica_draft_tree::text, '') || coalesce(l.silica_published_tree::text, '')) > 0
          OR position(${asset.key} IN coalesce(l.draft_tree::text, '') || coalesce(l.published_tree::text, '') || coalesce(l.silica_draft_tree::text, '') || coalesce(l.silica_published_tree::text, '')) > 0)
      ORDER BY 4, 3 LIMIT ${NAMED_PER_KIND})
  `;
}

/** Usage for one asset — the shape both delete guards want. */
export async function countOneAssetUsage(tx: TxClient, assetId: string): Promise<AssetUsage> {
  const map = await countAssetUsage(tx, [assetId]);
  return map.get(assetId) ?? { ...EMPTY };
}

/** "3 products and 1 page", for a refusal a person has to act on. An owner told
 *  only "still referenced by 4 entries" has nowhere to go; naming the KINDS tells
 *  them which screen to open to detach it. */
export function describeUsage(usage: AssetUsage): string {
  const parts: string[] = [];
  const add = (n: number, one: string, many: string) => {
    if (n > 0) parts.push(`${String(n)} ${n === 1 ? one : many}`);
  };
  add(usage.products, 'product photo', 'product photos');
  add(usage.content, 'page or article', 'pages and articles');
  add(usage.customers, 'customer record', 'customer records');
  add(usage.authors, 'author profile', 'author profiles');
  add(usage.staffDocuments, 'staff document', 'staff documents');
  add(usage.expenses, 'expense', 'expenses');
  add(usage.sitePages, 'site page', 'site pages');
  add(usage.siteLayouts, 'site header or footer', 'site headers and footers');
  add(usage.branding, 'logo or site icon', 'logos and site icons');
  add(usage.catalog, 'category or collection', 'categories and collections');
  add(usage.reviews, 'customer review', 'customer reviews');
  add(usage.socialPosts, 'social post', 'social posts');
  add(usage.otherRecords, 'other record', 'other records');
  if (parts.length === 0) return 'nothing';
  if (parts.length === 1) return parts[0]!;
  return `${parts.slice(0, -1).join(', ')} and ${parts.at(-1)!}`;
}
