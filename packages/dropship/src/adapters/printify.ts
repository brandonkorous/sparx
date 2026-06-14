// Printify adapter — connects to the Printify REST API (v1) to import a
// merchant's shop products, submit orders for print-on-demand fulfillment, and
// sync shipment tracking. Printify is made-to-order, so there is no finite
// stock to sync (checkInventory returns null per SKU).
//
// credentials shape (PrintifyCredentials):
//   apiToken — Personal Access Token (Printify → My account → Connections)
//   shopId   — optional; resolved to the first shop when omitted
//
// Printify API docs: https://developers.printify.com
//
// Variant reference: Printify orders require BOTH a product id and a variant id
// per line, but the SupplierAdapter order carries a single `supplierSku`. So we
// encode the supplier reference as `"{productId}:{variantId}"` at catalog time
// and split it back apart in submitOrder.
//
// POD seam (docs/14 §10 — authoring deferred): print files live on the Printify
// product, attached when the merchant designs it in Printify. We import the
// finished product; nothing about this path blocks a future "design in Sparx →
// publish to Printify" flow, which would add print areas to the order line.

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

export interface PrintifyCredentials {
  apiToken: string;
  shopId?: string;
}

const BASE_URL = 'https://api.printify.com/v1';

interface PrintifyShop {
  id: number;
  title: string;
  sales_channel: string;
}

interface PrintifyOptionValue {
  id: number;
  title: string;
}

interface PrintifyOption {
  name: string;
  type: string;
  values: PrintifyOptionValue[];
}

interface PrintifyVariant {
  id: number;
  sku: string;
  cost: number; // integer cents — what Printify charges (our cost)
  price: number; // integer cents — configured retail price (our MSRP)
  title: string;
  grams: number;
  is_enabled: boolean;
  options: number[]; // option-value ids, resolved via product.options
}

interface PrintifyImage {
  src: string;
  variant_ids: number[];
  is_default: boolean;
}

interface PrintifyProduct {
  id: string;
  title: string;
  description: string;
  tags?: string[];
  options?: PrintifyOption[];
  variants: PrintifyVariant[];
  images: PrintifyImage[];
}

interface PrintifyShipment {
  carrier: string;
  number: string;
  url: string;
}

interface PrintifyOrder {
  id: string;
  status: string;
  shipments?: PrintifyShipment[];
}

export class PrintifyAdapter implements SupplierAdapter {
  private readonly creds: PrintifyCredentials;
  private resolvedShopId: string | null = null;

  constructor(credentials: Credentials) {
    this.creds = credentials as unknown as PrintifyCredentials;
    if (this.creds.shopId) this.resolvedShopId = this.creds.shopId;
  }

  private headers(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.creds.apiToken}`,
      'Content-Type': 'application/json',
      // Printify rejects requests without a User-Agent.
      'User-Agent': 'Sparx/1.0 (+https://sparx.works)',
    };
  }

  /** Resolve the shop id: use the configured one, else the account's first shop. */
  private async getShopId(): Promise<string> {
    if (this.resolvedShopId) return this.resolvedShopId;
    const res = await fetch(`${BASE_URL}/shops.json`, {
      headers: this.headers(),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) throw new Error(`Printify shops fetch failed: ${res.status}`);
    const shops = (await res.json()) as PrintifyShop[];
    const first = shops[0];
    if (!first) throw new Error('Printify account has no shops');
    this.resolvedShopId = String(first.id);
    return this.resolvedShopId;
  }

  async authenticate(_credentials: Credentials): Promise<boolean> {
    if (!this.creds.apiToken) return false;
    try {
      const res = await fetch(`${BASE_URL}/shops.json`, {
        headers: this.headers(),
        signal: AbortSignal.timeout(10_000),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  async *syncCatalog(_since?: Date): AsyncGenerator<NormalizedProduct> {
    const shopId = await this.getShopId();
    let page = 1;
    const limit = 50;

    while (true) {
      const res = await fetch(
        `${BASE_URL}/shops/${shopId}/products.json?page=${page}&limit=${limit}`,
        { headers: this.headers(), signal: AbortSignal.timeout(30_000) }
      );
      if (!res.ok) throw new Error(`Printify products fetch failed: ${res.status}`);

      const body = (await res.json()) as {
        data?: PrintifyProduct[];
        current_page?: number;
        last_page?: number;
      };
      const products = body.data ?? [];
      if (products.length === 0) break;

      for (const p of products) {
        yield this.normalize(p);
      }

      const current = body.current_page ?? page;
      const last = body.last_page ?? page;
      if (current >= last) break;
      page++;
    }
  }

  private normalize(p: PrintifyProduct): NormalizedProduct {
    // option-value id → "Option name: value title" lookup for variant options.
    const valueById = new Map<number, { name: string; title: string }>();
    for (const opt of p.options ?? []) {
      for (const val of opt.values) {
        valueById.set(val.id, { name: opt.name, title: val.title });
      }
    }

    const variants: NormalizedProductVariant[] = p.variants
      .filter((v) => v.is_enabled !== false)
      .map((v) => {
        const options: Record<string, string> = {};
        for (const valId of v.options ?? []) {
          const resolved = valueById.get(valId);
          if (resolved) options[resolved.name] = resolved.title;
        }
        const variantImages = p.images
          .filter((img) => img.variant_ids.includes(v.id))
          .map((img) => img.src);
        return {
          // Composite supplier reference — see file header.
          supplierSku: `${p.id}:${v.id}`,
          title: v.title,
          options,
          costPriceCents: v.cost,
          msrpCents: v.price ?? null,
          inventoryQuantity: null, // POD — made to order
          weight: v.grams ?? null,
          imageUrls: variantImages,
        };
      });

    return {
      supplierProductId: p.id,
      title: p.title,
      description: p.description ?? null,
      category: null,
      tags: p.tags ?? [],
      imageUrls: p.images.map((img) => img.src),
      variants,
      raw: p as unknown as Record<string, unknown>,
    };
  }

  async submitOrder(order: Order): Promise<SupplierOrderResult> {
    let shopId: string;
    try {
      shopId = await this.getShopId();
    } catch (err) {
      return {
        supplierOrderId: `printify-fail-${order.sparxOrderId}`,
        status: 'failed',
        errorMessage: err instanceof Error ? err.message : 'Could not resolve Printify shop',
      };
    }

    const line_items = order.lineItems.map((li) => {
      const [productId, variantId] = li.supplierSku.split(':');
      return {
        product_id: productId,
        variant_id: Number(variantId),
        quantity: li.quantity,
      };
    });

    const addr = order.shippingAddress;
    const [firstName, ...rest] = addr.name.trim().split(/\s+/);
    const body = {
      external_id: order.sparxOrderId,
      label: order.sparxOrderNumber,
      line_items,
      shipping_method: 1, // 1 = standard
      send_shipping_notification: false,
      address_to: {
        first_name: firstName || addr.name,
        last_name: rest.join(' ') || '-',
        phone: addr.phone ?? '',
        country: addr.countryCode,
        region: addr.region ?? '',
        address1: addr.line1,
        address2: addr.line2 ?? '',
        city: addr.city,
        zip: addr.postalCode,
      },
    };

    try {
      const res = await fetch(`${BASE_URL}/shops/${shopId}/orders.json`, {
        method: 'POST',
        headers: this.headers(),
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(30_000),
      });
      const data = (await res.json()) as { id?: string } & Record<string, unknown>;
      if (!res.ok || !data.id) {
        return {
          supplierOrderId: `printify-fail-${order.sparxOrderId}`,
          status: 'failed',
          errorMessage:
            (typeof data.error === 'string' ? data.error : undefined) ??
            `Printify API error: ${res.status}`,
        };
      }

      // Created as a draft — push to production so it is actually fulfilled.
      const sendRes = await fetch(
        `${BASE_URL}/shops/${shopId}/orders/${data.id}/send_to_production.json`,
        { method: 'POST', headers: this.headers(), signal: AbortSignal.timeout(30_000) }
      );
      if (!sendRes.ok) {
        // The order exists but is not yet in production (recoverable).
        return {
          supplierOrderId: data.id,
          status: 'pending',
          errorMessage: `Printify order created but not sent to production: ${sendRes.status}`,
        };
      }

      return { supplierOrderId: data.id, status: 'submitted' };
    } catch (err) {
      return {
        supplierOrderId: `printify-fail-${order.sparxOrderId}`,
        status: 'failed',
        errorMessage: err instanceof Error ? err.message : 'Network error',
      };
    }
  }

  async getTrackingUpdate(supplierOrderId: string): Promise<TrackingInfo> {
    const shopId = await this.getShopId();
    const res = await fetch(`${BASE_URL}/shops/${shopId}/orders/${supplierOrderId}.json`, {
      headers: this.headers(),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) throw new Error(`Printify order fetch failed: ${res.status}`);

    const data = (await res.json()) as PrintifyOrder;
    const shipment = data.shipments?.[0];

    return {
      supplierOrderId,
      trackingNumber: shipment?.number ?? null,
      trackingUrl: shipment?.url ?? null,
      carrier: shipment?.carrier ?? null,
      status: mapStatus(data.status),
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
    case 'partially-fulfilled':
      return 'shipped';
    case 'canceled':
      return 'exception';
    default:
      // pending | on-hold | in-production | payment-not-received | …
      return 'pending';
  }
}
