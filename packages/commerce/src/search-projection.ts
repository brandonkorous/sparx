// Product → ProductSearchDocument projection.
//
// The commerce-indexer worker calls this every time a product, variant,
// fitment, or inventory level changes. Reads through @sparx/db's
// withTenant() so the RLS context is set the same way as every other
// commerce service call.
//
// The shape is dictated by packages/search/src/schemas/products.ts —
// keep them in sync; a missing/typo'd field is a runtime failure at
// `documents().upsert()`.

import {
  GLOBAL_SITE_SCOPE,
  type CustomerSearchDocument,
  type OrderSearchDocument,
  type ProductSearchDocument,
} from '@sparx/search';
import { withTenant } from '@sparx/db';

import type { ServiceContext } from './errors';
import { mediaPublicUrl } from './media-url';

export interface ProjectionResult {
  /** Null when the product no longer exists (caller should delete from index). */
  document: ProductSearchDocument | null;
}

/**
 * Project a single product into its search document. Returns null when
 * the product is gone (deleted or archived past retention) — the caller
 * should `deleteProduct(tenantId, productId)` from the index in that
 * case. Archived but still-present products are intentionally still
 * projected (with status='archived') so admin searches can find them.
 */
export async function projectProduct(
  ctx: ServiceContext,
  productId: string,
  /** Optional best-seller rank (1 = best). Threaded in by reindex, which
   *  computes it once per tenant from order-item quantities so the default
   *  sort (_text_match,best_seller_rank,updated_at) is meaningful. Omitted on
   *  the single-event path — a product write doesn't shift global rank. */
  bestSellerRank?: number
): Promise<ProjectionResult> {
  const projection = await withTenant(ctx, async (tx) => {
    const product = await tx.product.findFirst({
      where: { id: productId, deletedAt: null },
      include: {
        variants: {
          where: { deletedAt: null },
          select: {
            id: true,
            sku: true,
            priceCents: true,
            isDefault: true,
          },
        },
        fitments: {
          select: {
            category: { select: { name: true } },
            item: { select: { name: true } },
            variant: { select: { name: true } },
            rangeMin: true,
            rangeMax: true,
          },
        },
        categoryLinks: { select: { categoryId: true } },
        collectionLinks: { select: { collectionId: true } },
        // Model B site scope (docs/49 §3) — which web properties this product is
        // visible on. Empty ⇒ global (all sites).
        propertyLinks: { select: { propertyId: true } },
        images: {
          // The product hero: the explicit primary wins, else the first
          // product-level image by position (parity with productService.list).
          where: { variantId: null },
          orderBy: [{ isPrimary: 'desc' }, { position: 'asc' }],
          take: 1,
          select: { mediaAssetId: true },
        },
      },
    });

    if (!product) return null;

    // Settings are per-site now (docs/49 Phase 6b); the search index is tenant-wide
    // (one collection per tenant), so index products in the tenant's PRIMARY site's
    // currency — the canonical tenant default.
    const primary = await tx.property.findFirst({
      where: { isPrimary: true },
      select: { id: true },
    });
    const settings = primary
      ? await tx.storefrontSettings.findUnique({
          where: { tenantId_propertyId: { tenantId: ctx.tenantId, propertyId: primary.id } },
          select: { defaultCurrency: true },
        })
      : null;

    const activeVariants = product.variants;
    const priceCentsList = activeVariants.map((v) => v.priceCents);

    // Fall back to the product's denormalized price range when there are
    // no active variants. A product with no variants is itself the "one
    // variant" — the dashboard's create flow stamps priceMinCents on the
    // product row in that case.
    const priceMinCents =
      priceCentsList.length > 0 ? Math.min(...priceCentsList) : (product.priceMinCents ?? 0);
    const priceMaxCents =
      priceCentsList.length > 0
        ? Math.max(...priceCentsList)
        : (product.priceMaxCents ?? priceMinCents);

    // Fitment denormalized. Distinct L1/L2/L3 name lists power the
    // storefront facets without a join. The field names stay
    // `fitment_makes/models/engines` for storage-format stability across
    // the indexer — they're generic buckets at the index layer. Range
    // pairs flatten into a numeric list (year for vehicle, weight for
    // pet, etc.); open-ended ranges are capped to a sensible window.
    const categories = new Set<string>();
    const items = new Set<string>();
    const variants = new Set<string>();
    const rangeValues = new Set<number>();
    for (const f of product.fitments) {
      categories.add(f.category.name);
      if (f.item) items.add(f.item.name);
      if (f.variant) variants.add(f.variant.name);
      const lo = f.rangeMin === null ? 0 : Number(f.rangeMin);
      const hi = f.rangeMax === null ? (lo > 0 ? lo + 30 : 0) : Number(f.rangeMax);
      if (lo > 0 && hi >= lo) {
        for (let y = lo; y <= Math.min(hi, lo + 50); y++) rangeValues.add(y);
      }
    }

    const firstImageAssetId = product.images[0]?.mediaAssetId;
    let firstImageKey: string | undefined;
    if (firstImageAssetId) {
      const asset = await tx.mediaAsset.findFirst({
        where: { id: firstImageAssetId, deletedAt: null },
        select: { key: true },
      });
      firstImageKey = asset?.key;
    }

    const doc: ProductSearchDocument = {
      id: `${ctx.tenantId}:${product.id}`,
      tenant_id: ctx.tenantId,
      product_id: product.id,
      title: product.title,
      description: product.description ?? undefined,
      handle: product.handle,
      status: product.status as 'draft' | 'active' | 'archived',
      product_type: product.productType ?? undefined,
      vendor: product.vendor ?? undefined,
      tags: product.tags.length > 0 ? product.tags : undefined,
      category_ids:
        product.categoryLinks.length > 0
          ? product.categoryLinks.map((l) => l.categoryId)
          : undefined,
      collection_ids:
        product.collectionLinks.length > 0
          ? product.collectionLinks.map((l) => l.collectionId)
          : undefined,
      // Model B (docs/49 §3): global products get the GLOBAL_SITE_SCOPE sentinel
      // so they match every site's storefront filter; scoped products carry their
      // property ids and match only those sites.
      property_ids:
        product.propertyLinks.length > 0
          ? product.propertyLinks.map((l) => l.propertyId)
          : [GLOBAL_SITE_SCOPE],
      price_min_cents: priceMinCents,
      price_max_cents: priceMaxCents,
      in_stock: product.inStock,
      currency: settings?.defaultCurrency ?? 'USD',
      skus:
        activeVariants.length > 0
          ? activeVariants.map((v) => v.sku).filter((s): s is string => !!s)
          : undefined,
      fitment_makes: categories.size > 0 ? [...categories] : undefined,
      fitment_models: items.size > 0 ? [...items] : undefined,
      fitment_engines: variants.size > 0 ? [...variants] : undefined,
      fitment_years: rangeValues.size > 0 ? [...rangeValues] : undefined,
      image_url: firstImageKey ? mediaPublicUrl(firstImageKey) : undefined,
      created_at: Math.floor(product.createdAt.getTime() / 1000),
      updated_at: Math.floor(product.updatedAt.getTime() / 1000),
      best_seller_rank: bestSellerRank,
    };

    return doc;
  });

  return { document: projection };
}

/**
 * Project many products in one call. The indexer batches by tenant so
 * the RLS context flips once per batch, not per row. When `ranks` is supplied
 * (reindex path), each product's best-seller rank is stamped into its doc.
 */
export async function projectProducts(
  ctx: ServiceContext,
  productIds: string[],
  ranks?: Map<string, number>
): Promise<ProductSearchDocument[]> {
  const out: ProductSearchDocument[] = [];
  for (const id of productIds) {
    const { document } = await projectProduct(ctx, id, ranks?.get(id));
    if (document) out.push(document);
  }
  return out;
}

/**
 * Compute best-seller ranks for a tenant: products ordered by total quantity
 * sold (sum of order-item quantities), most-sold first → rank 1. Returns a
 * `productId → rank` map. Products with no sales are absent (rank stays
 * undefined → they sort after ranked ones under the default sort). Used by
 * the reindex path; cheap enough to run once per full rebuild.
 */
export async function computeBestSellerRanks(ctx: ServiceContext): Promise<Map<string, number>> {
  return withTenant(ctx, async (tx) => {
    const grouped = await tx.orderItem.groupBy({
      by: ['productId'],
      where: { productId: { not: null } },
      _sum: { quantity: true },
    });
    const ranked = grouped
      .filter((g): g is typeof g & { productId: string } => g.productId !== null)
      .map((g) => ({ productId: g.productId, qty: g._sum.quantity ?? 0 }))
      .filter((g) => g.qty > 0)
      .sort((a, b) => b.qty - a.qty);
    const map = new Map<string, number>();
    ranked.forEach((r, i) => map.set(r.productId, i + 1));
    return map;
  });
}

// ─── Customers ───────────────────────────────────────────────────────
//
// Customers + orders are CRM-spine tables, but their projections live here
// alongside products because the commerce-indexer worker (the only caller)
// already imports @sparx/commerce, and @sparx/commerce already depends on
// @sparx/search for the document types. Keeping all three projections in
// one module avoids adding @sparx/search to @sparx/crm. The shapes are
// dictated by packages/search/src/schemas/{customers,orders}.ts — keep
// them in sync.

export interface CustomerProjectionResult {
  /** Null when the customer no longer exists (soft-deleted) — caller deletes. */
  document: CustomerSearchDocument | null;
}

/**
 * Project a single customer into its search document. Returns null when the
 * customer is soft-deleted or gone, in which case the caller should
 * `deleteCustomer(tenantId, customerId)`. The denormalized commerce stats
 * (total_spent, order_count, last_order_at) are stored columns maintained by
 * the order-events consumer, so we read them straight off the row.
 */
export async function projectCustomer(
  ctx: ServiceContext,
  customerId: string
): Promise<CustomerProjectionResult> {
  const document = await withTenant(ctx, async (tx) => {
    const customer = await tx.customer.findFirst({
      where: { id: customerId, deletedAt: null },
    });
    if (!customer) return null;

    const name = [customer.firstName, customer.lastName].filter(Boolean).join(' ').trim();
    // full_name is required + non-empty in the Typesense schema; fall back
    // through company → email → placeholder. `??` won't do — these are
    // empty-string-or-null, and an empty string must fall through.
    const fullName = firstNonEmpty(name, customer.company, customer.email) ?? '(no name)';

    const doc: CustomerSearchDocument = {
      id: `${ctx.tenantId}:${customer.id}`,
      tenant_id: ctx.tenantId,
      // Membership site (docs/58 D2) — drives the dashboard Customers Site
      // filter. Absent for legacy rows with no property.
      property_id: customer.propertyId ?? undefined,
      customer_id: customer.id,
      full_name: fullName,
      email: customer.email ?? '',
      phone: customer.phone ?? undefined,
      company: customer.company ?? undefined,
      type: customer.type as 'prospect' | 'retail' | 'b2b',
      b2b_account_id: customer.b2bAccountId ?? undefined,
      tags: customer.tags.length > 0 ? customer.tags : undefined,
      total_spent_cents: Math.round(Number(customer.totalSpent) * 100),
      order_count: customer.orderCount,
      last_order_at: customer.lastOrderAt
        ? Math.floor(customer.lastOrderAt.getTime() / 1000)
        : undefined,
      created_at: Math.floor(customer.createdAt.getTime() / 1000),
    };
    return doc;
  });

  return { document };
}

/** First non-empty (trimmed) string from the candidates, or undefined. Used
 *  for required search fields where a null OR an empty column must fall
 *  through to the next candidate (so `??` alone won't do). */
function firstNonEmpty(...values: (string | null | undefined)[]): string | undefined {
  for (const v of values) {
    if (v && v.trim().length > 0) return v;
  }
  return undefined;
}

/** Project many customers in one call (reindex batches by tenant). */
export async function projectCustomers(
  ctx: ServiceContext,
  customerIds: string[]
): Promise<CustomerSearchDocument[]> {
  const out: CustomerSearchDocument[] = [];
  for (const id of customerIds) {
    const { document } = await projectCustomer(ctx, id);
    if (document) out.push(document);
  }
  return out;
}

// ─── Orders ──────────────────────────────────────────────────────────

export interface OrderProjectionResult {
  /** Null when the order no longer exists — caller deletes from the index. */
  document: OrderSearchDocument | null;
}

/**
 * Project a single order into its search document. Returns null when the
 * order is gone (caller deletes from the index). Orders aren't soft-deleted,
 * so null here means a hard delete or a not-yet-committed read. Line items
 * supply the searchable title/SKU arrays; the customer relation supplies the
 * denormalized name/email/b2b fields so order search matches on the buyer.
 */
export async function projectOrder(
  ctx: ServiceContext,
  orderId: string
): Promise<OrderProjectionResult> {
  const document = await withTenant(ctx, async (tx) => {
    const order = await tx.order.findUnique({
      where: { id: orderId },
      include: {
        items: { select: { name: true, sku: true } },
        customer: {
          select: { firstName: true, lastName: true, email: true, b2bAccountId: true },
        },
      },
    });
    if (!order) return null;

    const customerName = [order.customer?.firstName, order.customer?.lastName]
      .filter(Boolean)
      .join(' ')
      .trim();
    const itemTitles = order.items.map((i) => i.name).filter((s): s is string => !!s);
    const itemSkus = order.items.map((i) => i.sku).filter((s): s is string => !!s);

    const doc: OrderSearchDocument = {
      id: `${ctx.tenantId}:${order.id}`,
      tenant_id: ctx.tenantId,
      // Origin site (docs/58 D1) — drives the dashboard Orders Site filter.
      // Absent when the order's origin is unknown.
      property_id: order.propertyId ?? undefined,
      order_id: order.id,
      order_number: order.orderNumber,
      customer_id: order.customerId,
      customer_name: customerName || undefined,
      customer_email: order.customer?.email ?? undefined,
      b2b_account_id: order.customer?.b2bAccountId ?? undefined,
      channel: order.channel ?? 'admin',
      status: order.status,
      payment_status: order.paymentStatus,
      // fulfillment_status isn't an Order column (it lives per-OrderFulfillment).
      // Derive a coarse value from the order lifecycle so order search can
      // facet on it; finer-grained per-fulfillment state stays out of search.
      fulfillment_status:
        order.status === 'fulfilled' || order.status === 'delivered' ? order.status : undefined,
      item_titles: itemTitles.length > 0 ? itemTitles : undefined,
      item_skus: itemSkus.length > 0 ? itemSkus : undefined,
      // Order has no `tags` column — omit (the schema field is optional).
      total_cents: Math.round(Number(order.total) * 100),
      currency: order.currency,
      placed_at: Math.floor(order.placedAt.getTime() / 1000),
    };
    return doc;
  });

  return { document };
}

/** Project many orders in one call (reindex batches by tenant). */
export async function projectOrders(
  ctx: ServiceContext,
  orderIds: string[]
): Promise<OrderSearchDocument[]> {
  const out: OrderSearchDocument[] = [];
  for (const id of orderIds) {
    const { document } = await projectOrder(ctx, id);
    if (document) out.push(document);
  }
  return out;
}

// ─── Reindex id enumeration ──────────────────────────────────────────
//
// The reindex worker pages a tenant's entity ids (cheap id-only reads),
// then projects + bulk-upserts in bounded chunks. Soft-deleted rows are
// excluded so the index only ever holds live documents; the worker drops
// stale docs separately when asked.

/** All non-deleted product ids for the tenant (reindex enumeration). */
export async function listProductIdsForTenant(ctx: ServiceContext): Promise<string[]> {
  return withTenant(ctx, async (tx) => {
    const rows = await tx.product.findMany({ where: { deletedAt: null }, select: { id: true } });
    return rows.map((r) => r.id);
  });
}

/** All non-deleted customer ids for the tenant (reindex enumeration). */
export async function listCustomerIdsForTenant(ctx: ServiceContext): Promise<string[]> {
  return withTenant(ctx, async (tx) => {
    const rows = await tx.customer.findMany({ where: { deletedAt: null }, select: { id: true } });
    return rows.map((r) => r.id);
  });
}

/** All order ids for the tenant (orders aren't soft-deleted). */
export async function listOrderIdsForTenant(ctx: ServiceContext): Promise<string[]> {
  return withTenant(ctx, async (tx) => {
    const rows = await tx.order.findMany({ select: { id: true } });
    return rows.map((r) => r.id);
  });
}
