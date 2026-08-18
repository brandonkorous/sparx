// Printful adapter — connects to the Printful REST API (v1) to import a
// merchant's sync products, submit orders for print-on-demand fulfillment, and
// sync shipment tracking. Printful is made-to-order, so there is no finite
// stock to sync (checkInventory returns null per SKU).
//
// We target v1 deliberately: it is stable and fully documented, whereas v2 is
// still beta with unverified order/sync-product surfaces. The adapter is shaped
// so the order/catalog calls can move to v2 endpoint-by-endpoint later.
//
// credentials shape (PrintfulCredentials):
//   apiToken — private token from Printful → Settings → Developers
//   storeId  — optional; required only for account-level (multi-store) tokens
//
// Printful wraps every v1 response in `{ code, result, error }`; `unwrap()`
// pulls out `result`.
//
// Cost vs. retail: a v1 sync variant carries the merchant's `retail_price`
// (our MSRP) but NOT Printful's charge. We resolve the cost (and size/color
// options) from the catalog variant (`GET /products/variant/{id}`), cached per
// variant id to stay within the 120 req/min limit.
//
// POD seam (docs/14 §10 — authoring deferred): print files attach to the sync
// variant (`files[]`) and to order lines. We import finished sync products and
// reference them by `sync_variant_id`; a future "design in sparx" flow would
// add `files`/`placements` to the order line without reshaping this path.

import type {
  Credentials,
  InventoryMap,
  NormalizedProduct,
  NormalizedProductVariant,
  Order,
  SupplierAdapter,
  SupplierOrderResult,
  TrackingInfo,
} from '../types.js';

export interface PrintfulCredentials {
  apiToken: string;
  storeId?: string;
}

const BASE_URL = 'https://api.printful.com';

interface PrintfulEnvelope<T> {
  code: number;
  result: T;
  error?: { message?: string };
  paging?: { total: number; offset: number; limit: number };
}

interface PrintfulSyncProductSummary {
  id: number;
  name: string;
  thumbnail_url?: string;
}

interface PrintfulFile {
  type: string;
  preview_url?: string;
}

interface PrintfulSyncVariant {
  id: number;
  name: string;
  sku?: string;
  variant_id: number; // catalog variant id
  retail_price: string; // decimal string, merchant's retail price
  product?: { image?: string };
  files?: PrintfulFile[];
}

interface PrintfulSyncProductDetail {
  sync_product: PrintfulSyncProductSummary & { description?: string };
  sync_variants: PrintfulSyncVariant[];
}

interface PrintfulCatalogVariant {
  id: number;
  price: string; // decimal string — Printful's charge (our cost)
  size?: string;
  color?: string;
}

interface PrintfulShipment {
  carrier?: string;
  service?: string;
  tracking_number?: string;
  tracking_url?: string;
}

interface PrintfulOrder {
  id: number;
  status: string;
  shipments?: PrintfulShipment[];
}

function dollarsToCents(value: string | undefined): number {
  const n = parseFloat(value ?? '');
  return isNaN(n) ? 0 : Math.round(n * 100);
}

export class PrintfulAdapter implements SupplierAdapter {
  private readonly creds: PrintfulCredentials;
  // Catalog variant lookups are stable; cache to avoid refetching the same
  // variant across many sync variants in one sync.
  private readonly catalogVariantCache = new Map<number, PrintfulCatalogVariant | null>();

  constructor(credentials: Credentials) {
    this.creds = credentials as unknown as PrintfulCredentials;
  }

  private headers(): Record<string, string> {
    const h: Record<string, string> = {
      Authorization: `Bearer ${this.creds.apiToken}`,
      'Content-Type': 'application/json',
    };
    if (this.creds.storeId) h['X-PF-Store-Id'] = this.creds.storeId;
    return h;
  }

  private async get<T>(path: string, timeoutMs = 30_000): Promise<PrintfulEnvelope<T>> {
    const res = await fetch(`${BASE_URL}${path}`, {
      headers: this.headers(),
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) throw new Error(`Printful GET ${path} failed: ${res.status}`);
    return (await res.json()) as PrintfulEnvelope<T>;
  }

  async authenticate(_credentials: Credentials): Promise<boolean> {
    if (!this.creds.apiToken) return false;
    try {
      const res = await fetch(`${BASE_URL}/stores`, {
        headers: this.headers(),
        signal: AbortSignal.timeout(10_000),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  async *syncCatalog(_since?: Date): AsyncGenerator<NormalizedProduct> {
    let offset = 0;
    const limit = 100;

    while (true) {
      const list = await this.get<PrintfulSyncProductSummary[]>(
        `/store/products?offset=${offset}&limit=${limit}`
      );
      const summaries = list.result ?? [];
      if (summaries.length === 0) break;

      for (const summary of summaries) {
        const detail = await this.get<PrintfulSyncProductDetail>(`/store/products/${summary.id}`);
        yield await this.normalize(detail.result);
      }

      const total = list.paging?.total ?? offset + summaries.length;
      offset += limit;
      if (offset >= total) break;
    }
  }

  /** Fetch (and cache) a catalog variant for cost + size/color options. */
  private async getCatalogVariant(variantId: number): Promise<PrintfulCatalogVariant | null> {
    if (this.catalogVariantCache.has(variantId)) {
      return this.catalogVariantCache.get(variantId) ?? null;
    }
    try {
      const res = await this.get<{ variant: PrintfulCatalogVariant }>(
        `/products/variant/${variantId}`,
        15_000
      );
      const variant = res.result?.variant ?? null;
      this.catalogVariantCache.set(variantId, variant);
      return variant;
    } catch {
      this.catalogVariantCache.set(variantId, null);
      return null;
    }
  }

  private async normalize(detail: PrintfulSyncProductDetail): Promise<NormalizedProduct> {
    const { sync_product, sync_variants } = detail;

    const variants: NormalizedProductVariant[] = [];
    for (const v of sync_variants) {
      const catalog = await this.getCatalogVariant(v.variant_id);
      const options: Record<string, string> = {};
      if (catalog?.size) options['size'] = catalog.size;
      if (catalog?.color) options['color'] = catalog.color;

      const imageUrls = [
        ...(v.files ?? []).map((f) => f.preview_url).filter((u): u is string => Boolean(u)),
        ...(v.product?.image ? [v.product.image] : []),
      ];

      variants.push({
        // Orders reference sync variants by their numeric id (`sync_variant_id`),
        // so the id — NOT the human SKU — is the routing token submitOrder parses.
        supplierSku: String(v.id),
        title: v.name,
        options,
        costPriceCents: dollarsToCents(catalog?.price),
        msrpCents: dollarsToCents(v.retail_price) || null,
        inventoryQuantity: null, // POD — made to order
        weight: null, // not reliably available per variant in v1
        imageUrls,
      });
    }

    return {
      supplierProductId: String(sync_product.id),
      title: sync_product.name,
      description: sync_product.description ?? null,
      category: null,
      tags: [],
      imageUrls: sync_product.thumbnail_url ? [sync_product.thumbnail_url] : [],
      variants,
      raw: detail as unknown as Record<string, unknown>,
    };
  }

  async submitOrder(order: Order): Promise<SupplierOrderResult> {
    const addr = order.shippingAddress;
    const body = {
      external_id: order.sparxOrderId,
      shipping: 'STANDARD',
      recipient: {
        name: addr.name,
        address1: addr.line1,
        address2: addr.line2 ?? '',
        city: addr.city,
        state_code: addr.region ?? '',
        country_code: addr.countryCode,
        zip: addr.postalCode,
        phone: addr.phone ?? '',
      },
      items: order.lineItems.map((li) => ({
        sync_variant_id: Number(li.supplierSku),
        quantity: li.quantity,
      })),
    };

    try {
      const res = await fetch(`${BASE_URL}/orders?confirm=1`, {
        method: 'POST',
        headers: this.headers(),
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(30_000),
      });
      const data = (await res.json()) as PrintfulEnvelope<PrintfulOrder>;
      if (!res.ok || !data.result?.id) {
        return {
          supplierOrderId: `printful-fail-${order.sparxOrderId}`,
          status: 'failed',
          errorMessage: data.error?.message ?? `Printful API error: ${res.status}`,
        };
      }
      return { supplierOrderId: String(data.result.id), status: 'submitted' };
    } catch (err) {
      return {
        supplierOrderId: `printful-fail-${order.sparxOrderId}`,
        status: 'failed',
        errorMessage: err instanceof Error ? err.message : 'Network error',
      };
    }
  }

  async getTrackingUpdate(supplierOrderId: string): Promise<TrackingInfo> {
    const data = await this.get<PrintfulOrder>(`/orders/${supplierOrderId}`, 15_000);
    const order = data.result;
    const shipment = order.shipments?.[0];

    return {
      supplierOrderId,
      trackingNumber: shipment?.tracking_number ?? null,
      trackingUrl: shipment?.tracking_url ?? null,
      carrier: shipment?.carrier ?? null,
      status: mapStatus(order.status),
      events: [],
    };
  }

  async checkInventory(skus: string[]): Promise<InventoryMap> {
    // POD — products are made to order; report "no finite stock" (null) per SKU.
    const result: InventoryMap = {};
    for (const sku of skus) result[sku] = null;
    return result;
  }
}

function mapStatus(status: string): TrackingInfo['status'] {
  switch (status) {
    case 'fulfilled':
    case 'partial':
      return 'shipped';
    case 'canceled':
    case 'failed':
      return 'exception';
    default:
      // draft | pending | inprocess | onhold | …
      return 'pending';
  }
}
